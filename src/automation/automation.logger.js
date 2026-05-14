/**
 * AutomationLogger
 *
 * Ghi log các automation events để debug và audit.
 * Hiện tại log ra console, sau này có thể extend để lưu DB.
 *
 * Log levels:
 *   - debug: skipped rules (cooldown, conditions not met)
 *   - info:  triggered rules
 *   - error: failed actions
 */
class AutomationLogger {
  constructor() {
    // Có thể inject logger service sau này
  }

  /**
   * Log một automation event.
   *
   * @param {object} logData
   *   {
   *     ruleId: string,
   *     context: object,      // trigger context
   *     triggered: boolean,   // rule có trigger hay không
   *     skippedReason: string,// lý do skip (cooldown, conditions_not_met)
   *     actionResults: array, // kết quả các actions
   *     error: string,        // lỗi nếu có
   *     level: 'debug'|'info'|'error'
   *   }
   */
  async log(logData) {
    const { ruleId, context, triggered, skippedReason, actionResults, error, level = 'info' } = logData;

    const timestamp = new Date().toISOString();
    const homeId = context?.homeId;
    const type = context?.type;

    let message = `[Automation] ${timestamp} | Rule ${ruleId} | Home ${homeId} | Type ${type}`;

    if (error) {
      message += ` | ERROR: ${error}`;
      console.error(message);
    } else if (triggered) {
      message += ` | TRIGGERED | Actions: ${actionResults?.length || 0}`;
      console.log(message);

      // Log chi tiết actions nếu cần
      if (actionResults?.length > 0) {
        actionResults.forEach((res, idx) => {
          if (res.success) {
            console.log(`  └─ Action ${idx + 1}: ${res.action.type} ✓`);
          } else {
            console.error(`  └─ Action ${idx + 1}: ${res.action.type} ✗ ${res.error}`);
          }
        });
      }
    } else if (skippedReason) {
      message += ` | SKIPPED: ${skippedReason}`;
      if (level === 'debug') {
        console.debug(message);
      } else {
        console.log(message);
      }
    }

    // TODO: lưu vào DB nếu cần
    // await this._saveToDB(logData);
  }

  // async _saveToDB(logData) {
  //   // Implement later: lưu vào AutomationLog model
  // }
}

export default AutomationLogger;