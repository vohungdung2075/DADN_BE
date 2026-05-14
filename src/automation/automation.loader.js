/**
 * AutomationLoader
 *
 * Cầu nối giữa database và automation engine.
 * Trách nhiệm:
 *   1. Load tất cả rules từ DB khi server start
 *   2. Phân loại rules → inject đúng chỗ (RuleEngine / TimeTrigger)
 *   3. Hot-reload khi rule được tạo / sửa / xóa qua REST API
 *      (Controller gọi loader.onRuleCreated/Updated/Deleted thay vì restart server)
 *
 * Dependency graph:
 *   AutomationLoader
 *     ├── Rule (Mongoose model)   — nguồn dữ liệu
 *     ├── RuleEngine              — nhận hàm getRulesByHomeId
 *     └── TimeTrigger             — nhận/unschedule time-based rules
 *
 * Cách dùng:
 *   const loader = new AutomationLoader({ Rule, ruleEngine, timeTrigger });
 *   await loader.load();   // gọi 1 lần khi server start
 *
 *   // Trong automationController.js sau khi save rule:
 *   await loader.onRuleCreated(rule);
 *   await loader.onRuleUpdated(rule);
 *   await loader.onRuleDeleted(ruleId);
 */
class AutomationLoader {
  /**
   * @param {object} opts
   * @param {object}   opts.Rule          - Mongoose Rule model
   * @param {object}   opts.ruleEngine    - RuleEngine instance
   * @param {object}   opts.timeTrigger   - TimeTrigger instance
   */
  constructor({ Rule, ruleEngine, timeTrigger }) {
    if (!Rule)        throw new Error('AutomationLoader: Rule model is required');
    if (!ruleEngine)  throw new Error('AutomationLoader: ruleEngine is required');
    if (!timeTrigger) throw new Error('AutomationLoader: timeTrigger is required');

    this._Rule        = Rule;
    this._ruleEngine  = ruleEngine;
    this._timeTrigger = timeTrigger;

    /**
     * Cache rules theo homeId để RuleEngine query nhanh (không cần hit DB mỗi event).
     * Map<homeId, Rule[]>
     *
     * Chỉ chứa sensor + alert rules — time rules do TimeTrigger tự quản lý.
     */
    this._cache = new Map();

    this._loaded = false;
  }

  // ─────────────────────────────────────────────
  // PUBLIC — lifecycle
  // ─────────────────────────────────────────────

  /**
   * Load toàn bộ rules từ DB, build cache, schedule time rules.
   * Gọi 1 lần duy nhất khi server start, sau khi DB connected.
   */
  async load() {
    console.log('[AutomationLoader] Loading rules from DB...');

    const rules = await this._Rule.find({ enabled: true }).lean();

    this._buildCache(rules);
    this._scheduleTimeRules(rules);

    // Inject hàm query vào RuleEngine — engine gọi hàm này mỗi khi evaluate
    this._ruleEngine._getRules = (homeId) => this._getByHomeId(homeId);

    this._loaded = true;
    console.log(`[AutomationLoader] Loaded ${rules.length} rules` +
      ` (${this._countByType(rules, 'time')} time-based,` +
      ` ${rules.length - this._countByType(rules, 'time')} sensor/alert).`);
  }

  // ─────────────────────────────────────────────
  // PUBLIC — hot-reload hooks (gọi từ Controller)
  // ─────────────────────────────────────────────

  /**
   * Gọi sau khi tạo rule mới.
   * @param {object} rule - Mongoose document hoặc plain object (sau .lean())
   */
  async onRuleCreated(rule) {
    if (!rule.enabled) return; // rule tắt không cần add vào cache
    this._addToCache(rule);
    if (this._isTimeBased(rule)) this._timeTrigger.schedule(rule);
    console.log(`[AutomationLoader] Rule created: "${rule.name}"`);
  }

  /**
   * Gọi sau khi update rule.
   * Xử lý đủ các trường hợp: đổi trigger type, bật/tắt, sửa cron.
   */
  async onRuleUpdated(rule) {
    const ruleId = String(rule._id);

    // Xóa cũ trước (cả cache lẫn cron job nếu có)
    this._removeFromCache(ruleId, rule.homeId);
    this._timeTrigger.unschedule(ruleId);

    // Re-add nếu còn enabled
    if (rule.enabled) {
      this._addToCache(rule);
      if (this._isTimeBased(rule)) this._timeTrigger.schedule(rule);
    }

    console.log(`[AutomationLoader] Rule updated: "${rule.name}" (enabled: ${rule.enabled})`);
  }

  /**
   * Gọi sau khi xóa rule.
   * @param {string} ruleId
   * @param {string} homeId  - cần để xóa đúng entry trong cache
   */
  async onRuleDeleted(ruleId, homeId) {
    this._removeFromCache(String(ruleId), homeId);
    this._timeTrigger.unschedule(String(ruleId));
    console.log(`[AutomationLoader] Rule deleted: ${ruleId}`);
  }

  /**
   * Reload toàn bộ rules của một home (dùng khi cần sync lại sau bulk update).
   */
  async reloadHome(homeId) {
    const rules = await this._Rule.find({ homeId, enabled: true }).lean();

    // Xóa cache cũ của home này
    this._cache.delete(String(homeId));

    // Unschedule tất cả time rules của home trước khi schedule lại
    rules
      .filter(r => this._isTimeBased(r))
      .forEach(r => this._timeTrigger.unschedule(String(r._id)));

    // Re-build
    this._buildCache(rules);
    this._scheduleTimeRules(rules);

    console.log(`[AutomationLoader] Reloaded ${rules.length} rules for home ${homeId}`);
  }

  // ─────────────────────────────────────────────
  // PRIVATE — cache management
  // ─────────────────────────────────────────────

  /**
   * Build cache từ mảng rules.
   * Chỉ cache sensor + alert rules vì time rules do TimeTrigger quản lý.
   */
  _buildCache(rules) {
    this._cache.clear();

    rules
      .filter(r => !this._isTimeBased(r))
      .forEach(r => this._addToCache(r));
  }

  /** Thêm một rule vào cache (nếu không phải time-based). */
  _addToCache(rule) {
    if (this._isTimeBased(rule)) return; // time rules không vào cache

    const homeId = String(rule.homeId);
    if (!this._cache.has(homeId)) this._cache.set(homeId, []);

    const list   = this._cache.get(homeId);
    const ruleId = String(rule._id);

    // Tránh duplicate nếu gọi add 2 lần
    if (!list.find(r => String(r._id) === ruleId)) {
      list.push(rule);
    }
  }

  /** Xóa một rule khỏi cache theo ruleId. */
  _removeFromCache(ruleId, homeId) {
    if (homeId) {
      // Biết homeId → xóa nhanh O(n) trên list của home đó
      const key  = String(homeId);
      const list = this._cache.get(key);
      if (list) {
        this._cache.set(key, list.filter(r => String(r._id) !== ruleId));
      }
    } else {
      // Không biết homeId → scan tất cả (hiếm khi xảy ra)
      for (const [key, list] of this._cache) {
        this._cache.set(key, list.filter(r => String(r._id) !== ruleId));
      }
    }
  }

  /**
   * Hàm được inject vào RuleEngine._getRules.
   * Trả về rules từ in-memory cache → không hit DB mỗi MQTT event.
   */
  _getByHomeId(homeId) {
    return Promise.resolve(this._cache.get(String(homeId)) ?? []);
  }

  // ─────────────────────────────────────────────
  // PRIVATE — TimeTrigger management
  // ─────────────────────────────────────────────

  _scheduleTimeRules(rules) {
    rules
      .filter(r => this._isTimeBased(r))
      .forEach(r => this._timeTrigger.schedule(r));
  }

  // ─────────────────────────────────────────────
  // PRIVATE — helpers
  // ─────────────────────────────────────────────

  _isTimeBased(rule) {
    return rule?.trigger?.type === 'time';
  }

  _countByType(rules, type) {
    return rules.filter(r => r?.trigger?.type === type).length;
  }
}

export default AutomationLoader;