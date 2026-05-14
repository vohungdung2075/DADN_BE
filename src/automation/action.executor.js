import { DeviceCommandSender, DeviceCommandError } from './device.command.sender.js';

/**
 * ActionExecutor
 *
 * Nhận một action object và context, thực thi đúng handler theo action.type.
 *
 * Các loại action hỗ trợ:
 *   device_command  — gọi POST /homes/:homeId/device/command
 *   notify          — gửi thông báo đến user (console.log, FCM, email...)
 *   webhook         — gọi HTTP endpoint bên ngoài
 *   delay           — chờ N giây trước khi action tiếp theo chạy
 *
 * Cách mở rộng thêm action type mới:
 *   1. Thêm case vào switch trong execute()
 *   2. Viết handler method _handleXxx()
 *   Không cần sửa RuleEngine hay bất kỳ file nào khác.
 *
 * Cách dùng (trong RuleEngine):
 *   const executor = new ActionExecutor({ deviceSvc, notifySvc });
 *   await executor.execute(action, context);
 */
class ActionExecutor {
  /**
   * @param {object} opts
   * @param {object} [opts.deviceSvc]   - DeviceCommandService instance
   * @param {object} [opts.notifySvc]   - NotificationService instance (optional)
   */
  constructor({ deviceSvc, notifySvc } = {}) {
    this._deviceSvc = deviceSvc ?? new DeviceCommandSender();
    this._notifySvc = notifySvc ?? null;
  }

  // ─────────────────────────────────────────────
  // PUBLIC
  // ─────────────────────────────────────────────

  /**
   * Thực thi một action.
   *
   * @param {object} action   — action object từ Rule.actions[]
   * @param {object} context  — context từ trigger (có homeId, feed, value, ...)
   * @returns {Promise<object>} Kết quả thực thi để ghi log
   * @throws  {ActionError} nếu action thất bại và không thể recover
   */
  async execute(action, context) {
    if (!action?.type) throw new ActionError('action.type is required', action);

    switch (action.type) {
      case 'device_command': return this._handleDeviceCommand(action, context);
      case 'notify':         return this._handleNotify(action, context);
      case 'webhook':        return this._handleWebhook(action, context);
      case 'delay':          return this._handleDelay(action);
      default:
        throw new ActionError(`Unknown action type: "${action.type}"`, action);
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE — handlers
  // ─────────────────────────────────────────────

  /**
   * device_command — gọi POST /homes/:homeId/device/command
   *
   * Action schema:
   *   { type: 'device_command', feed: 'iot-fan', command: '1' }
   *
   * command hỗ trợ template từ context:
   *   { command: '{{value}}' }  → thay bằng giá trị sensor hiện tại
   *   Ví dụ: dimmer theo nhiệt độ, servo theo độ ẩm
   */
  async _handleDeviceCommand(action, context) {
    const { feed, command } = action;
    const { homeId }        = context;

    if (!feed)                    throw new ActionError('device_command cần có feed', action);
    if (command === undefined)    throw new ActionError('device_command cần có command', action);
    if (!homeId)                  throw new ActionError('context thiếu homeId', action);

    // Resolve template trong command string
    const resolvedCommand = this._resolveTemplate(String(command), context);

    try {
      const res = await this._deviceSvc.send({ homeId, feed, command: resolvedCommand });
      return { type: 'device_command', feed, command: resolvedCommand, res };
    } catch (err) {
      // Wrap DeviceCommandError thành ActionError để RuleEngine xử lý thống nhất
      throw new ActionError(
        `device_command failed: ${err.message}`,
        action,
        err instanceof DeviceCommandError ? err.statusCode : 0
      );
    }
  }

  /**
   * notify — gửi thông báo đến user
   *
   * Action schema:
   *   { type: 'notify', message: 'Nhiệt độ {{value}}°C quá cao!' }
   *
   * message hỗ trợ template từ context:
   *   {{value}}, {{feed}}, {{homeId}}, {{direction}}, {{threshold}}
   */
  async _handleNotify(action, context) {
    if (!action.message) throw new ActionError('notify cần có message', action);

    const message = this._resolveTemplate(action.message, context);

    if (this._notifySvc) {
      // Dùng NotificationService thật nếu được inject
      await this._notifySvc.send({
        homeId:  context.homeId,
        message,
        context, // để NotificationService tự lấy thêm info nếu cần
      });
    } else {
      // Fallback: log ra console (đủ để test giai đoạn đầu)
      console.log(`[Notify] 🔔 (home:${context.homeId}) ${message}`);
    }

    return { type: 'notify', message };
  }

  /**
   * webhook — gọi HTTP endpoint bên ngoài
   *
   * Action schema:
   *   {
   *     type:   'webhook',
   *     url:    'https://example.com/hook',
   *     method: 'POST',          // GET | POST | PUT | PATCH, mặc định POST
   *     body:   { key: 'val' },  // optional, hỗ trợ template trong value
   *   }
   *
   * Timeout 10s, không retry (để RuleEngine quyết định).
   */
  async _handleWebhook(action, context) {
    if (!action.url) throw new ActionError('webhook cần có url', action);

    const method  = (action.method || 'POST').toUpperCase();
    const rawBody = action.body ? this._resolveBodyTemplates(action.body, context) : null;
    const bodyStr = rawBody ? JSON.stringify(rawBody) : null;

    const url     = this._resolveTemplate(action.url, context);

    const res = await this._fetchWithTimeout(url, method, bodyStr);

    console.log(`[Webhook] ${method} ${url} → ${res.status}`);
    return { type: 'webhook', url, method, status: res.status, body: res.body };
  }

  /**
   * delay — chờ N giây
   *
   * Action schema:
   *   { type: 'delay', seconds: 5 }
   *
   * Dùng để chain actions:
   *   [tắt đèn] → [delay 3s] → [tắt quạt]
   */
  async _handleDelay(action) {
    const seconds = Number(action.seconds);
    if (!seconds || seconds <= 0) throw new ActionError('delay cần có seconds > 0', action);
    if (seconds > 3600)           throw new ActionError('delay tối đa 3600 giây', action);

    console.log(`[Delay] ⏳ Chờ ${seconds}s...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return { type: 'delay', seconds };
  }

  // ─────────────────────────────────────────────
  // PRIVATE — template engine
  // ─────────────────────────────────────────────

  /**
   * Thay thế {{field}} trong string bằng giá trị từ context.
   *
   * Ví dụ:
   *   template: 'Nhiệt độ {{value}}°C vượt ngưỡng {{threshold}}°C'
   *   context:  { value: 31.5, threshold: 30 }
   *   result:   'Nhiệt độ 31.5°C vượt ngưỡng 30°C'
   */
  _resolveTemplate(template, context) {
    if (typeof template !== 'string') return template;
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = context[key];
      return val !== undefined ? val : `{{${key}}}`; // giữ nguyên nếu không có trong context
    });
  }

  /**
   * Duyệt đệ quy object body của webhook, resolve template trong mọi string value.
   */
  _resolveBodyTemplates(obj, context) {
    if (typeof obj === 'string')  return this._resolveTemplate(obj, context);
    if (Array.isArray(obj))       return obj.map(item => this._resolveBodyTemplates(item, context));
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, this._resolveBodyTemplates(v, context)])
      );
    }
    return obj;
  }

  // ─────────────────────────────────────────────
  // PRIVATE — HTTP fetch (built-in, không cần axios)
  // ─────────────────────────────────────────────

  _fetchWithTimeout(url, method, bodyStr, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const parsed  = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? require('https') : require('http');

      const headers = { 'Content-Type': 'application/json' };
      if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port:     parsed.port || (isHttps ? 443 : 80),
          path:     parsed.pathname + parsed.search,
          method,
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          let raw = '';
          res.on('data', chunk => { raw += chunk; });
          res.on('end', () => {
            let body;
            try { body = JSON.parse(raw); } catch { body = raw; }
            resolve({ status: res.statusCode, body });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new ActionError(`Webhook timeout after ${timeoutMs}ms`, null, 0));
      });
      req.on('error', err => {
        reject(new ActionError(`Webhook network error: ${err.message}`, null, 0));
      });

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}

// ─────────────────────────────────────────────
// Custom Error
// ─────────────────────────────────────────────

class ActionError extends Error {
  /**
   * @param {string} message
   * @param {object} action      - action object gây lỗi
   * @param {number} [statusCode] - HTTP status nếu là lỗi network
   */
  constructor(message, action = null, statusCode = null) {
    super(message);
    this.name       = 'ActionError';
    this.action     = action;
    this.statusCode = statusCode;
  }
}

export { ActionExecutor, ActionError };