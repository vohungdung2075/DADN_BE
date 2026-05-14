import mongoose from "mongoose";

const TriggerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['sensor','alert','time'],
      required: true
    },

    feed : {
      type: String,
    },

    direction:{
      type: String,
      enum : ['above_max', 'below_min', null],
      default: null
    },

    cron:{
      type: String,

    },

  },
   {
      _id: false
    }
);
const ConditionSchema = new mongoose.Schema({
  field: {
    type:     String,
    required: true,
    // field trong context: 'value', 'feed', 'direction', 'metric', ...
    // hỗ trợ nested path: 'meta.room'
  },
 
  operator: {
    type:     String,
    required: true,
    enum:     ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'between', 'contains', 'exists'],
  },
 
  value: {
    type: mongoose.Schema.Types.Mixed,
    // required với mọi operator trừ 'exists'
  },
 
  valueMax: {
    type: mongoose.Schema.Types.Mixed,
    // chỉ dùng với operator 'between'
  },
}, { _id: false });
const ActionSchema = new mongoose.Schema({
  type: {
    type:     String,
    required: true,
    enum:     ['device_command', 'notify', 'webhook', 'delay'],
  },
 
  // device_command
  feed:    { type: String },
  command: { type: String },  // '0' | '1' | 'ON' | 'OFF' | số 0-100 (dimmer)
 
  // notify
  message: { type: String },
 
  // webhook
  url:    { type: String },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH'], default: 'POST' },
  body:   { type: mongoose.Schema.Types.Mixed },
 
  // delay
  seconds: { type: Number, min: 0, max: 3600 },
}, { _id: false });
 
// ─────────────────────────────────────────────
// Rule schema chính
// ─────────────────────────────────────────────
 
const RuleSchema = new mongoose.Schema({
  // ── Metadata ──────────────────────────────
  homeId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Home',
    required: true,
    index:    true,   // query thường xuyên theo homeId
  },
 
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
  },
 
  name: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 100,
  },
 
  description: {
    type:      String,
    trim:      true,
    maxlength: 500,
  },
 
  // ── Core ──────────────────────────────────
  enabled: {
    type:    Boolean,
    default: true,
    index:   true,    // chỉ load rules đang enabled
  },
 
  trigger: {
    type:     TriggerSchema,
    required: true,
  },
 
  // AND logic: tất cả conditions phải pass
  // Mảng rỗng = không cần điều kiện thêm (chỉ dựa vào trigger)
  conditions: {
    type:    [ConditionSchema],
    default: [],
  },
 
  // Thực thi tuần tự theo thứ tự mảng
  actions: {
    type:     [ActionSchema],
    required: true,
    validate: {
      validator: (arr) => arr.length > 0,
      message:   'Rule phải có ít nhất 1 action',
    },
  },
 
  // ── Cooldown ──────────────────────────────
  // Thời gian chờ tối thiểu giữa 2 lần trigger (giây)
  // 0 = không cooldown (dùng cho test hoặc time-based rules)
  cooldown_seconds: {
    type:    Number,
    default: 60,
    min:     0,
    max:     86400, // tối đa 1 ngày
  },
 
  // ── Stats (cập nhật mỗi lần trigger) ─────
  lastTriggeredAt: {
    type: Date,
    default: null,
  },
 
  triggerCount: {
    type:    Number,
    default: 0,
  },
 
}, {
  timestamps: true,   // tự thêm createdAt, updatedAt
  collection: 'rules',
});
 
// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────
 
// Query chính: load rules đang active của một home
RuleSchema.index({ homeId: 1, enabled: 1 });
 
// Load time-based rules khi khởi động CronScheduler
RuleSchema.index({ 'trigger.type': 1, enabled: 1 });
 
// ─────────────────────────────────────────────
// Validation tầng document
// ─────────────────────────────────────────────
 
RuleSchema.pre('validate', async function () {
  const { type, feed, cron } = this.trigger ?? {};
 
  // sensor và alert bắt buộc có feed
  if ((type === 'sensor' || type === 'alert') && !feed) {
    throw new Error(`Trigger type "${type}" phải có feed`);
  }
 
  // time bắt buộc có cron expression hợp lệ
  if (type === 'time') {
    if (!cron)             throw new Error('Trigger type "time" phải có cron expression');
    if (!isValidCron(cron)) throw new Error(`Cron expression không hợp lệ: "${cron}"`);
  }
 
  // between cần valueMax
  for (const cond of this.conditions ?? []) {
    if (cond.operator === 'between' && cond.valueMax === undefined) {
      throw new Error('Condition "between" cần có valueMax');
    }
  }
 
  // validate từng action
  for (const action of this.actions ?? []) {
    if (action.type === 'device_command' && (!action.feed || action.command === undefined)) {
      throw new Error('Action "device_command" cần có feed và command');
    }
    if (action.type === 'webhook' && !action.url) {
      throw new Error('Action "webhook" cần có url');
    }
    if (action.type === 'delay' && !action.seconds) {
      throw new Error('Action "delay" cần có seconds');
    }
  }
});
 
// ─────────────────────────────────────────────
// Instance methods
// ─────────────────────────────────────────────
 
/** Ghi nhận rule vừa được trigger (gọi từ RuleEngine sau khi execute thành công). */
RuleSchema.methods.recordTrigger = function () {
  this.lastTriggeredAt = new Date();
  this.triggerCount   += 1;
  return this.save();
};
 
/** Bật/tắt rule và lưu ngay. */
RuleSchema.methods.toggle = function () {
  this.enabled = !this.enabled;
  return this.save();
};
 
// ─────────────────────────────────────────────
// Static methods
// ─────────────────────────────────────────────
 
/** Load tất cả rules đang enabled của một home — dùng trong RuleEngine. */
RuleSchema.statics.findActiveByHome = function (homeId) {
  return this.find({ homeId, enabled: true }).lean();
};
 
/** Load chỉ time-based rules — dùng khi khởi động CronScheduler. */
RuleSchema.statics.findTimeBased = function () {
  return this.find({ 'trigger.type': 'time', enabled: true }).lean();
};
 
// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
 
/**
 * Kiểm tra cron expression có đúng format 5 trường không.
 * Không validate từng field chi tiết — để node-cron báo lỗi khi schedule.
 */
function isValidCron(expr) {
  if (typeof expr !== 'string') return false;
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5;
}
 
// ─────────────────────────────────────────────
 
const Rule = mongoose.model('Rule', RuleSchema);

export default Rule;