class ConditionEvaluator {
  /**
   * @param {object} condition
   * @param {object} context    — context từ trigger (mqtt_data, alert_triggered, v.v.)
   * @returns {boolean}
   */
  check(condition, context) {
    const { field, operator, value, valueMax } = condition;
 
    const actual = this._resolve(field, context);
 
    switch (operator) {
      case 'gt':       return this._num(actual) >  this._num(value);
      case 'gte':      return this._num(actual) >= this._num(value);
      case 'lt':       return this._num(actual) <  this._num(value);
      case 'lte':      return this._num(actual) <= this._num(value);
      case 'eq':       return String(actual) === String(value);
      case 'neq':      return String(actual) !== String(value);
      case 'between':  return this._num(actual) >= this._num(value) &&
                              this._num(actual) <= this._num(valueMax);
      case 'contains': return String(actual).includes(String(value));
      case 'exists':   return actual !== undefined && actual !== null;
      default:
        console.warn(`[ConditionEvaluator] Unknown operator: "${operator}"`);
        return false;
    }
  }
 
  // Lấy giá trị từ context theo field path (hỗ trợ nested: 'meta.room')
  _resolve(field, context) {
    if (!field) return undefined;
    return field.split('.').reduce((obj, key) => obj?.[key], context);
  }
 
  _num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
}
 
export default ConditionEvaluator;