import CooldownManager from './cooldown.manager.js';
import ConditionEvaluator from './condition.evaluator.js';
import { ActionExecutor } from './action.executor.js';
import AutomationLogger from './automation.logger.js';

/**
 * RuleEngine
 *
 * Pipeline chính:
 *   evaluate(context)
 *     → 1. load rules phù hợp với context
 *     → 2. matchTrigger(rule, context)
 *     → 3. isInCooldown(rule)          ← skip nếu đang cooldown
 *     → 4. checkConditions(rule, context)
 *     → 5. executeActions(rule, context)
 *     → 6. setCooldown(rule)
 *     → 7. log kết quả
 *
 * RuleEngine không biết đến Socket.IO hay HTTP —
 * chỉ nhận context object và delegate sang các module chuyên biệt.
 */
class RuleEngine {
  /**
   * @param {object} opts
   * @param {Function} opts.getRulesByHomeId  - async (homeId) => Rule[]  — query từ DB
   * @param {object}  [opts.cooldown]         - CooldownManager instance (optional, tạo mới nếu không truyền)
   * @param {object}  [opts.condEval]         - ConditionEvaluator instance
   * @param {object}  [opts.actionExec]       - ActionExecutor instance
   * @param {object}  [opts.logger]           - AutomationLogger instance
   */
  constructor({ getRulesByHomeId, cooldown, condEval, actionExec, logger } = {}) {
    if (!getRulesByHomeId) throw new Error('RuleEngine: getRulesByHomeId is required');

    this._getRules    = getRulesByHomeId;
    this._cooldown    = cooldown    ?? new CooldownManager();
    this._condEval    = condEval    ?? new ConditionEvaluator();
    this._actionExec  = actionExec  ?? new ActionExecutor();
    this._logger      = logger      ?? new AutomationLogger();
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  /**
   * Điểm vào duy nhất. Gọi từ AutomationEngine mỗi khi có event.
   *
   * @param {object} context
   *   Sensor:  { type:'sensor', homeId, feed, value, rawValue, time }
   *   Alert:   { type:'alert',  homeId, feed, value, direction, threshold, time }
   *   Time:    { type:'time',   homeId, ruleId }   ← từ TimeTrigger
   */
  async evaluate(context) {
    const { homeId } = context;
    if (!homeId) return;

    let rules;
    try {
      rules = await this._getRules(homeId);
    } catch (err) {
      console.error('[RuleEngine] Failed to load rules:', err.message);
      return;
    }

    // Chạy song song từng rule — lỗi của rule này không ảnh hưởng rule khác
    await Promise.allSettled(
      rules
        .filter(r => r.enabled !== false)
        .map(rule => this._processRule(rule, context))
    );
  }

  // ─────────────────────────────────────────────
  // PRIVATE — pipeline
  // ─────────────────────────────────────────────

  async _processRule(rule, context) {
    const ruleId = String(rule._id ?? rule.id);
    const result = { ruleId, context, triggered: false, skippedReason: null, actionResults: [] };

    try {
      // ── Step 1: trigger match ────────────────
      if (!this._matchTrigger(rule.trigger, context)) {
        return; // không match → bỏ qua, không log
      }

      // ── Step 2: cooldown ─────────────────────
      if (this._cooldown.isInCooldown(ruleId)) {
        result.skippedReason = 'cooldown';
        await this._logger.log({ ...result, level: 'debug' });
        return;
      }

      // ── Step 3: conditions ───────────────────
      const condPass = this._checkConditions(rule.conditions ?? [], context);
      if (!condPass) {
        result.skippedReason = 'conditions_not_met';
        return; // conditions chưa đạt → không log spam
      }

      // ── Step 4: execute actions ──────────────
      result.triggered = true;
      result.actionResults = await this._executeActions(rule.actions ?? [], context);

      // ── Step 5: set cooldown ─────────────────
      const cooldownSec = rule.cooldown_seconds ?? 60;
      this._cooldown.set(ruleId, cooldownSec);

      console.log(`[RuleEngine] ✓ Rule "${rule.name}" triggered (home: ${context.homeId})`);

    } catch (err) {
      result.error = err.message;
      console.error(`[RuleEngine] ✗ Rule "${rule.name}" error:`, err.message);
    } finally {
      if (result.triggered || result.error) {
        await this._logger.log(result).catch(() => {}); // log không được crash engine
      }
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE — step implementations
  // ─────────────────────────────────────────────

  /**
   * Kiểm tra context có khớp với trigger của rule không.
   *
   * Trigger schema:
   *   { type: 'sensor', feed: 'iot-temp' }
   *   { type: 'alert',  feed: 'iot-temp', direction: 'above_max' }  ← direction optional
   *   { type: 'time',   ruleId: '<id>' }  ← TimeTrigger đã resolve, chỉ so ruleId
   */
  _matchTrigger(trigger, context) {
    if (!trigger) return false;
    if (trigger.type !== context.type) return false;

    switch (trigger.type) {
      case 'sensor':
        // feed phải khớp. Hỗ trợ wildcard '*' để match mọi feed
        return trigger.feed === '*' || trigger.feed === context.feed;

      case 'alert':
        if (trigger.feed && trigger.feed !== '*' && trigger.feed !== context.feed) return false;
        // direction là optional: nếu rule chỉ quan tâm 1 chiều
        if (trigger.direction && trigger.direction !== context.direction) return false;
        return true;

      case 'time':
        // TimeTrigger đã biết rule nào cần chạy, chỉ cần so ruleId
        return String(trigger.ruleId ?? context.ruleId) === String(context.ruleId);

      default:
        return false;
    }
  }

  /**
   * Tất cả conditions phải pass (AND logic).
   * Nếu không có condition nào → pass luôn (rule chỉ dựa vào trigger).
   */
  _checkConditions(conditions, context) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(cond => this._condEval.check(cond, context));
  }

  /**
   * Thực thi từng action tuần tự (để đảm bảo thứ tự delay/chain).
   * Trả về mảng kết quả để ghi log.
   */
  async _executeActions(actions, context) {
    const results = [];

    for (const action of actions) {
      try {
        const res = await this._actionExec.execute(action, context);
        results.push({ action, success: true, res });
      } catch (err) {
        results.push({ action, success: false, error: err.message });
        console.error(`[RuleEngine] Action failed (${action.type}):`, err.message);
        // Tiếp tục action tiếp theo dù action này lỗi
      }
    }

    return results;
  }
}

export default RuleEngine;