/**
 * Tránh cho một rule bị trigger liên tục khi sensor
 * dao động quanh threshold
 * Ví dụ: khi nhiệt độ là 30.01 -> 29.9 -> 30.2
 * Dùng cooldown 5p mới kiểm tra lại
 */
class CooldownManager{
  constructor()
  {
    this._store = new Map(); //<ruleId, expiredTimestamp>

    this._cleanupInterval = setInterval(() => this._cleanup(),5*60*1000);
    this._cleanupInterval.unref?.();
  }
  /**
   * Kiểm tra rule có đang cooldown hay không
   * @param {string} ruleId
   * @returns {Boolean}
   */
  isInCoolDown(ruleId)
  {
    const expiredAt = this._store.get(String(ruleId));
    if(!expiredAt) return false;
    
    if(Date.now() < expiredAt) return true;

    // Hết hạn --> xóa 
    this._store.delete(String(ruleId));
    return false;
  }
  /**
   * Đặt ra cooldown cho một rule
   * @param {string} ruleId
   * @param {number} seconds 
   */
  set(ruleId, seconds = 60)
  {
    this._store.set(String(ruleId), Date.now()+seconds*1000);
  }

  /**
   * Xóa cooldown
   */

  clear(ruleId)
  {
    this._store.delete(String(ruleId));

  }
  remainingMs(ruleId) {
    const expireAt = this._store.get(String(ruleId));
    if (!expireAt) return 0;
    return Math.max(0, expireAt - Date.now());
  }
 
  destroy() {
    clearInterval(this._cleanupInterval);
    this._store.clear();
  }
 
  _cleanup() {
    const now = Date.now();
    for (const [id, expireAt] of this._store) {
      if (now >= expireAt) this._store.delete(id);
    }
  }

}
export default CooldownManager;