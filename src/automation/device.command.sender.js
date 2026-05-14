import https from 'https';
import http from 'http';
import { hostname } from 'os';

class DeviceCommandSender
{
  constructor({
    baseUrl = `http://localhost:${process.env.PORT}/api`,
    tokenProvider = null,
    maxRetries = 3,
    timeoutMs = 8_000,
    baseDelayMs = 500,} = {})
  {
    this._baseUrl = baseUrl.replace(/\/$/,'');
    this._tokenProvider = tokenProvider;
     this._maxRetries    = maxRetries;
    this._timeoutMs = timeoutMs;
    this._baseDelayMs = baseDelayMs;

  }

   async send({ homeId, feed, command }) {
    this._validate({ homeId, feed, command });
 
    const url  = `${this._baseUrl}/homes/${homeId}/device/command`;
    const body = JSON.stringify({ feed, command: String(command) });
 
    let lastError;
 
    for (let attempt = 1; attempt <= this._maxRetries + 1; attempt++) {
      try {
        const token = await this._getToken();
        const res   = await this._request({ url, body, token });
 
        console.log(
          `[DeviceCommand] ✓ ${feed}=${command} (home:${homeId})` +
          (attempt > 1 ? ` [attempt ${attempt}]` : '')
        );
 
        return res;
 
      } catch (err) {
        lastError = err;
 
        // Lỗi 4xx: không có ích gì khi retry
        if (err instanceof DeviceCommandError && err.statusCode >= 400 && err.statusCode < 500) {
          console.error(`[DeviceCommand] ✗ ${feed} — client error ${err.statusCode}: ${err.message}`);
          throw err;
        }
 
        const isLastAttempt = attempt === this._maxRetries + 1;
        if (isLastAttempt) break;
 
        const delay = this._backoffDelay(attempt);
        console.warn(
          `[DeviceCommand] ✗ ${feed} attempt ${attempt} failed: ${err.message}.` +
          ` Retry in ${delay}ms...`
        );
        await this._sleep(delay);
      }
    }
 
    console.error(`[DeviceCommand] ✗ ${feed} — all ${this._maxRetries + 1} attempts failed.`);
    throw lastError;
  }
  /**
   * Private parts
   * Tạo một HTTP request 
   */
      _request({ url, body, token }) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;
 
      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (isHttps ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization':  `Bearer ${token}`,
        },
        timeout: this._timeoutMs,
      };
 
      const req = lib.request(options, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          // Parse JSON, fallback về raw string nếu không phải JSON
          let data;
          try { data = JSON.parse(raw); }
          catch { data = { message: raw }; }
 
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new DeviceCommandError(
              data?.message || `HTTP ${res.statusCode}`,
              res.statusCode,
              data
            ));
          }
        });
      });
 
      // Network timeout
      req.on('timeout', () => {
        req.destroy();
        reject(new DeviceCommandError(`Request timeout after ${this._timeoutMs}ms`, 0));
      });
 
      // Network error (ECONNREFUSED, DNS fail, v.v.)
      req.on('error', (err) => {
        reject(new DeviceCommandError(`Network error: ${err.message}`, 0));
      });
 
      req.write(body);
      req.end();
    });
  }
   async _getToken() {
    if (this._tokenProvider) return this._tokenProvider();
    const token = process.env.AUTOMATION_SERVICE_TOKEN;
    if (!token) throw new DeviceCommandError('AUTOMATION_SERVICE_TOKEN is not set', 0);
    return token;
  }
 
  /** Exponential backoff: 500ms, 1000ms, 2000ms, ... */
  _backoffDelay(attempt) {
    const jitter = Math.random() * 200; // tránh thundering herd khi nhiều rules cùng retry
    return Math.min(this._baseDelayMs * Math.pow(2, attempt - 1) + jitter, 30_000);
  }
 
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
 
  _validate({ homeId, feed, command }) {
    if (!homeId)                      throw new DeviceCommandError('homeId is required', 0);
    if (!feed)                        throw new DeviceCommandError('feed is required', 0);
    if (command === undefined || command === null)
                                      throw new DeviceCommandError('command is required', 0);
  }
}
 
// ─────────────────────────────────────────────
// Custom Error
// ─────────────────────────────────────────────
 
class DeviceCommandError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode  - HTTP status code, 0 nếu là network/timeout error
   * @param {object} [body]      - Response body nếu có
   */
  constructor(message, statusCode, body = null) {
    super(message);
    this.name       = 'DeviceCommandError';
    this.statusCode = statusCode;
    this.body       = body;
  }
}
export { DeviceCommandSender, DeviceCommandError };