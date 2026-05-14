import cron from 'node-cron';

/**
 * TimeTrigger
 *
 * Quản lý time-based rules bằng cron jobs.
 * Khi rule được tạo/cập nhật, schedule cron job để trigger vào đúng thời điểm.
 * Khi rule bị xóa/tắt, unschedule job tương ứng.
 *
 * Dependency:
 *   - node-cron: để schedule jobs
 *   - RuleEngine: để evaluate khi cron trigger
 *
 * Cách dùng:
 *   const timeTrigger = new TimeTrigger(ruleEngine);
 *   timeTrigger.schedule(rule);  // khi tạo rule
 *   timeTrigger.unschedule(ruleId);  // khi xóa rule
 */
class TimeTrigger {
  /**
   * @param {object} ruleEngine - RuleEngine instance để evaluate time rules
   */
  constructor(ruleEngine) {
    if (!ruleEngine) throw new Error('TimeTrigger: ruleEngine is required');

    this._ruleEngine = ruleEngine;
    this._jobs = new Map(); // <ruleId, cronJob>
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  /**
   * Schedule một time-based rule.
   * Nếu rule đã có job cũ → unschedule trước.
   *
   * @param {object} rule - Rule document từ DB
   */
  schedule(rule) {
    const ruleId = String(rule._id);

    // Unschedule job cũ nếu có
    this.unschedule(ruleId);

    if (!rule.enabled || !this._isTimeBased(rule)) return;

    const cronExpr = this._buildCronExpression(rule.trigger);
    if (!cronExpr) {
      console.warn(`[TimeTrigger] Invalid cron for rule "${rule.name}":`, rule.trigger);
      return;
    }

    const job = cron.schedule(cronExpr, () => {
      this._onTrigger(rule);
    }, {
      timezone: rule.trigger.timezone || 'UTC', // hỗ trợ timezone
    });

    this._jobs.set(ruleId, job);
    console.log(`[TimeTrigger] Scheduled "${rule.name}" with cron: ${cronExpr}`);
  }

  /**
   * Unschedule job của rule.
   * @param {string} ruleId
   */
  unschedule(ruleId) {
    const job = this._jobs.get(String(ruleId));
    if (job) {
      job.destroy();
      this._jobs.delete(String(ruleId));
      console.log(`[TimeTrigger] Unscheduled rule ${ruleId}`);
    }
  }

  /**
   * Cleanup tất cả jobs (dùng khi shutdown server).
   */
  destroy() {
    for (const [ruleId, job] of this._jobs) {
      job.destroy();
    }
    this._jobs.clear();
    console.log('[TimeTrigger] All jobs destroyed');
  }

  // ─────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────

  /**
   * Khi cron trigger → gọi RuleEngine.evaluate với context time.
   */
  async _onTrigger(rule) {
    const context = {
      type: 'time',
      homeId: String(rule.homeId),
      ruleId: String(rule._id),
    };

    try {
      await this._ruleEngine.evaluate(context);
    } catch (err) {
      console.error(`[TimeTrigger] Rule "${rule.name}" error:`, err.message);
    }
  }

  /**
   * Build cron expression từ trigger object.
   *
   * Trigger schema:
   *   {
   *     type: 'time',
   *     cron: '0 9 * * 1-5',  // trực tiếp cron expression
   *     // hoặc
   *     schedule: {
   *       minute: '0',
   *       hour: '9',
   *       dayOfMonth: '*',
   *       month: '*',
   *       dayOfWeek: '1-5'
   *     }
   *   }
   */
  _buildCronExpression(trigger) {
    if (trigger.cron) {
      // Validate cron expression
      if (!cron.validate(trigger.cron)) return null;
      return trigger.cron;
    }

    if (trigger.schedule) {
      const { minute = '*', hour = '*', dayOfMonth = '*', month = '*', dayOfWeek = '*' } = trigger.schedule;
      const expr = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
      if (!cron.validate(expr)) return null;
      return expr;
    }

    return null;
  }

  _isTimeBased(rule) {
    return rule?.trigger?.type === 'time';
  }
}

export default TimeTrigger;