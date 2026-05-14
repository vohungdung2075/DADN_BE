# API Reference

## Base URL

```text
http://localhost:3000/api
```

## Authorization

Các API có bảo vệ cần header:

```http
Authorization: Bearer <token>
```

## Role Model

- System role:
    - `admin`: quản lý users và homes ở mức hệ thống.
    - `user`: role mặc định sau đăng ký.
- Tenant role (trong từng home):
    - `owner`: quản lý member + thresholds + quyền cấu hình nhà.
    - `member`: điều khiển thiết bị theo quyền.
    - `guest`: quyền hạn thấp hơn (tùy UI/logic sử dụng).

---

## Flow 1 - User Profile

Mục tiêu: lấy thông tin user hiện tại và role để quyết định màn hình/chức năng.

### 1) Login

```http
POST /auth/login
```

Body:

```json
{
	"email": "user01@example.com",
	"password": "secret123"
}
```

Response mẫu:

```json
{
	"token": "<jwt_token>",
	"user": {
		"id": "65f...",
		"email": "user01@example.com",
		"role": "user"
	}
}
```

### 2) Sign up

```http
POST /auth/signup
```

Body:

```json
{
	"username": "user01",
	"email": "user01@example.com",
	"password": "secret123"
}
```

### 3) Forgot password

```http
POST /auth/forgot-password
```

Body:

```json
{
	"email": "user01@example.com"
}
```

### 4) Reset password

```http
PATCH /auth/reset-password/:token
```

Body:

```json
{
	"newPassword": "newsecret123"
}
```

### 5) Get my profile

```http
GET /auth/me
```

Response mẫu:

```json
{
	"id": "65f...",
	"username": "user01",
	"email": "user01@example.com",
	"role": "user"
}
```

---

## System Admin APIs

### 6) Get all users (admin)

```http
GET /admin/users
```

### 7) Create home for user (admin)

```http
POST /admin/homes/user/:userId
```

Body mẫu:

```json
{
	"name": "Test House",
	"address": "123 Main Street",
	"aioUsername": "NguyenHoangAnh",
	"aioKey": "aio_yTaJ11rHGQDSrigAdN5Mbg90LODq",
	"aioFeedIds": [
		"iot-light",
		"iot-auto-fan",
		"iot-auto-light",
		"iot-fan",
		"iot-humi",
		"iot-lint",
		"iot-pir",
		"iot-remote",
		"iot-servo",
		"iot-temp"
	]
}
```

### 8) Delete home (admin)

```http
DELETE /admin/homes/:homeId
```

---

## Home Member APIs

### 9) Get my homes

```http
GET /homes
```

### 10) Add member to home (owner)

```http
POST /homes/:homeId/members
```

Body:

```json
{
	"email": "member01@example.com",
	"role": "member"
}
```

### 11) Get members of home

```http
GET /homes/:homeId/members
```

### 12) Update member role (owner)

```http
PATCH /homes/:homeId/members/:userId/role
```

Body:

```json
{
	"role": "guest"
}
```

### 13) Remove member (owner)

```http
DELETE /homes/:homeId/members/:userId
```

---

## Flow 2 - Dashboard APIs

Mục tiêu: dashboard realtime + thống kê lịch sử + threshold setting.

### 14) Get all sensor feeds of home

```http
GET /homes/:homeId/sensor
```

Response mẫu:

```json
{
	"iot-temp": "30.5",
	"iot-humid": "65",
	"updatedAt": "2024-06-01T08:00:00.000Z"
}
```

### 15) Get one feed current value

```http
GET /homes/:homeId/sensor/:feed
```

### 16) Get feed history

```http
GET /homes/:homeId/sensor/:feed/history?limit=20
```

### 17) Get dashboard metrics (one call)

```http
GET /homes/:homeId/metrics
```

Response mẫu:

```json
{
	"currentReadings": {
		"iot-temp": {
			"value": "31.2",
			"timestamp": "2026-04-27T10:00:00.000Z"
		},
		"iot-humid": {
			"value": "72",
			"timestamp": "2026-04-27T10:00:00.000Z"
		}
	},
	"averages24h": {
		"iot-temp": 29.7,
		"iot-humid": 68.3
	},
	"alerts": [
		{
			"type": "THRESHOLD_EXCEEDED",
			"metric": "temp",
			"feed": "iot-temp",
			"value": 31.2,
			"threshold": 30,
			"direction": "above_max"
		}
	],
	"onlineMemberCount": 2
}
```

### 18) Get min/max/avg for plotting

```http
GET /homes/:homeId/sensor/:feed/stats?from=ISO&to=ISO
```

Ví dụ:

```http
GET /homes/65f123abc456/sensor/iot-temp/stats?from=2026-04-26T00:00:00.000Z&to=2026-04-27T00:00:00.000Z
```

### 19) Update alert thresholds (owner)

```http
PATCH /homes/:homeId/settings/thresholds
```

Body mẫu:

```json
{
	"tempMax": 35,
	"tempMin": 20,
	"humidMax": 85,
	"humidMin": 40
}
```

Response mẫu:

```json
{
	"message": "Update thresholds successfully",
	"settings": {
		"homeId": "65f...",
		"tempMax": 35,
		"tempMin": 20,
		"humidMax": 85,
		"humidMin": 40,
		"updatedAt": "2026-04-27T10:00:00.000Z"
	}
}
```

---

## Device Control API

### 20) Send command to actuator (owner/member)

```http
POST /homes/:homeId/device/command
```

Body:

```json
{
	"feed": "iot-fan",
	"command": "1"
}
```

Response:

```json
{
	"success": true,
	"feed": "iot-fan",
	"command": "1"
}
```

---

## Socket.IO Reference

Server URL:

```text
http://localhost:3000
```

### Connection

Socket.IO yêu cầu JWT ngay khi connect.

Khuyến nghị cho browser: gửi token qua `auth`.

```js
const socket = io("http://localhost:3000", {
	auth: {
		token: "<jwt_token>",
	},
});
```

Nếu dùng Node.js client, có thể gửi qua header handshake:

```js
const socket = io("http://localhost:3000", {
	extraHeaders: {
		authorization: "Bearer <jwt_token>",
	},
});
```

Nếu token thiếu hoặc sai, backend sẽ từ chối kết nối ở bước handshake và client nhận `connect_error`.

### Client -> Server Events

#### 1) join_room

Vào room theo nhà để nhận dữ liệu realtime.

Backend hỗ trợ cả 2 kiểu payload:

```js
socket.emit("join_room", homeId);
socket.emit("join_room", { homeId });
```

#### 2) leave_room

Rời room theo nhà.

```js
socket.emit("leave_room", homeId);
socket.emit("leave_room", { homeId });
```

### Server -> Client Events

#### 1) room_joined

Bắn sau khi join room thành công.

```json
{
	"homeId": "65f123abc456"
}
```

#### 2) room_left

Bắn sau khi rời room thành công.

```json
{
	"homeId": "65f123abc456"
}
```

#### 3) room_error

Bắn khi thiếu `homeId` hoặc không có quyền vào home.

```json
{
	"message": "Access denied: not a member of this home"
}
```

#### 4) mqtt_data

Realtime data từ MQTT, chỉ broadcast vào room của home tương ứng.

```json
{
	"homeId": "65f123abc456",
	"feed": "iot-temp",
	"value": "30.5",
	"time": "2026-04-27T10:00:00.000Z"
}
```

#### 5) alert_triggered

Bắn khi sensor vượt ngưỡng đã lưu ở `PATCH /homes/:homeId/settings/thresholds`.

```json
{
	"homeId": "65f123abc456",
	"feed": "iot-temp",
	"value": 36.2,
	"metric": "temp",
	"threshold": 35,
	"direction": "above_max",
	"time": "2026-04-27T10:00:00.000Z"
}
```

#### 6) user_online

Bắn khi 1 socket join vào room home.

```json
{
	"homeId": "65f123abc456",
	"socketId": "abc123...",
	"onlineMemberCount": 3
}
```

#### 7) user_offline

Bắn khi 1 socket rời room hoặc disconnect.

```json
{
	"homeId": "65f123abc456",
	"socketId": "abc123...",
	"onlineMemberCount": 2
}
```

### Full Socket Client Example

```html
<script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
<script>
	const homeId = "65f123abc456";
	const token = "<jwt_token>";
	const socket = io("http://localhost:3000", {
		auth: { token },
	});

	socket.on("connect", () => {
		socket.emit("join_room", { homeId });
	});

	socket.on("mqtt_data", (payload) => {
		console.log("mqtt_data", payload);
	});

	socket.on("alert_triggered", (payload) => {
		console.log("alert_triggered", payload);
	});

	socket.on("user_online", (payload) => {
		console.log("user_online", payload);
	});

	socket.on("user_offline", (payload) => {
		console.log("user_offline", payload);
	});

	socket.on("room_error", (payload) => {
		console.log("room_error", payload);
	});

	window.addEventListener("beforeunload", () => {
		socket.emit("leave_room", { homeId });
	});
</script>
```

---

## Notes

- Dashboard best practice:
    - Load initial state bằng `GET /homes/:homeId/metrics`.
    - Sau đó nghe Socket.IO (`mqtt_data`, `alert_triggered`, `user_online`, `user_offline`) để update realtime.
- Room access được kiểm tra theo JWT + membership trong home.
- Feed MQTT đang so khớp đúng theo cấu hình (case-sensitive). Ví dụ `iot-temp` khác `IOT-TEMP`.

---

## Automation Rules

Hệ thống automation cho phép tạo rules tự động dựa trên sensor data, alerts, hoặc thời gian để thực thi actions như điều khiển thiết bị, gửi thông báo, gọi webhook.

### Quyền truy cập

- Chỉ `owner` hoặc `admin` của home mới có thể quản lý rules.
- Rules được áp dụng cho toàn bộ home.

### Rule Schema

```json
{
  "_id": "rule_id",
  "homeId": "home_id",
  "name": "Tên rule",
  "description": "Mô tả (optional)",
  "enabled": true,
  "trigger": {
    "type": "sensor|alert|time",
    // sensor
    "feed": "iot-temp",
    // alert
    "feed": "iot-temp",
    "direction": "above_max|below_min",
    // time
    "cron": "0 9 * * 1-5"
  },
  "conditions": [
    {
      "field": "value",
      "operator": "gt|gte|lt|lte|eq|neq|between|contains|exists",
      "value": 30,
      "valueMax": 40
    }
  ],
  "actions": [
    {
      "type": "device_command|notify|webhook|delay",
      // device_command
      "feed": "iot-fan",
      "command": "1",
      // notify
      "message": "Nhiệt độ {{value}}°C quá cao!",
      // webhook
      "url": "https://example.com/hook",
      "method": "POST",
      "body": {"alert": "high_temp"},
      // delay
      "seconds": 5
    }
  ],
  "cooldown_seconds": 60,
  "createdAt": "2026-05-14T...",
  "updatedAt": "2026-05-14T..."
}
```

### Trigger Types

- **sensor**: Trigger khi nhận MQTT data từ feed cụ thể.
- **alert**: Trigger khi vượt ngưỡng (threshold) đã set.
- **time**: Trigger theo cron schedule (ví dụ: "0 9 * * 1-5" = 9h sáng T2-T6).

### Condition Operators

- `gt`, `gte`, `lt`, `lte`: So sánh số (> , >= , < , <=).
- `eq`, `neq`: So sánh string (= , !=).
- `between`: Trong khoảng [value, valueMax].
- `contains`: String chứa substring.
- `exists`: Field có tồn tại.

### Action Types

- **device_command**: Gửi command đến feed MQTT.
- **notify**: Gửi thông báo (hiện tại log console, có thể extend FCM/email).
- **webhook**: Gọi HTTP endpoint bên ngoài.
- **delay**: Chờ N giây trước action tiếp theo.

### Template trong Actions

Actions hỗ trợ template từ context:

- `{{value}}`: Giá trị sensor.
- `{{feed}}`: Tên feed.
- `{{homeId}}`: ID home.
- `{{direction}}`: above_max/below_min.
- `{{threshold}}`: Ngưỡng.

Ví dụ: `"message": "Nhiệt độ {{value}}°C vượt {{threshold}}°C"`

### API Endpoints

#### 1) Get Rules

```http
GET /homes/:homeId/rules
```

Response:

```json
[
  {
    "_id": "rule1",
    "name": "Tự động bật quạt khi nóng",
    "enabled": true,
    "trigger": {"type": "alert", "feed": "iot-temp", "direction": "above_max"},
    "conditions": [{"field": "value", "operator": "gt", "value": 30}],
    "actions": [{"type": "device_command", "feed": "iot-fan", "command": "1"}],
    "cooldown_seconds": 300
  }
]
```

#### 2) Create Rule

```http
POST /homes/:homeId/rules
```

Body:

```json
{
  "name": "Bật đèn lúc 6h tối",
  "trigger": {
    "type": "time",
    "cron": "0 18 * * *"
  },
  "actions": [
    {"type": "device_command", "feed": "iot-light", "command": "1"}
  ]
}
```

Response: Rule object với `_id`.

#### 3) Update Rule

```http
PUT /rules/:ruleId
```

Body: Partial rule object (chỉ fields cần update).

Response: Updated rule object.

#### 4) Delete Rule

```http
DELETE /rules/:ruleId
```

Response:

```json
{"message": "Rule deleted"}
```

### Cách Test

#### 1) Tạo Rule Cơ Bản

```bash
curl -X POST http://localhost:3000/api/homes/YOUR_HOME_ID/rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rule",
    "trigger": {"type": "sensor", "feed": "iot-temp"},
    "actions": [{"type": "notify", "message": "Temp: {{value}}°C"}]
  }'
```

#### 2) Test với Fake Sensor Data (không cần thiết bị thật)

```bash
# Simulate MQTT data
curl -X POST http://localhost:3000/api/test/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "homeId": "YOUR_HOME_ID",
    "feed": "iot-temp",
    "value": "35.5"
  }'
```

Kiểm tra console: `[Notify] 🔔 (home:YOUR_HOME_ID) Temp: 35.5°C`

#### 3) Test Alert Trigger

```bash
# Simulate alert
curl -X POST http://localhost:3000/api/test/alert-trigger \
  -H "Content-Type: application/json" \
  -d '{
    "homeId": "YOUR_HOME_ID",
    "feed": "iot-temp",
    "value": 36.2,
    "threshold": 35,
    "direction": "above_max"
  }'
```

#### 4) Test Time Rule Manually

```bash
# Trigger time rule ngay lập tức
curl -X POST http://localhost:3000/api/test/trigger-rule/RULE_ID
```

#### 5) Test với Conditions

Tạo rule với condition:

```json
{
  "name": "Hot Alert",
  "trigger": {"type": "sensor", "feed": "iot-temp"},
  "conditions": [{"field": "value", "operator": "gt", "value": 30}],
  "actions": [{"type": "notify", "message": "HOT: {{value}}°C"}]
}
```

Test với value < 30 → không trigger, > 30 → trigger.

#### 6) Test Device Command (simulate)

```json
{
  "name": "Test Device",
  "trigger": {"type": "sensor", "feed": "iot-temp"},
  "actions": [{"type": "device_command", "feed": "iot-fan", "command": "1"}]
}
```

Kiểm tra console: `[DeviceCommand] ✓ iot-fan=1 (home:YOUR_HOME_ID)`

#### 7) Test Webhook

```json
{
  "name": "Webhook Test",
  "trigger": {"type": "sensor", "feed": "iot-temp"},
  "actions": [{
    "type": "webhook",
    "url": "https://webhook.site/YOUR_ID",
    "method": "POST",
    "body": {"home": "{{homeId}}", "temp": "{{value}}"}
  }]
}
```

#### 8) Test Cooldown

Trigger rule nhiều lần liên tiếp → chỉ trigger 1 lần, skip với cooldown.

#### 9) Sử dụng MQTT Client (mosquitto)

Nếu có MQTT broker:

```bash
# Install mosquitto client
# Publish fake data
mosquitto_pub -h localhost -t "YOUR_USERNAME/feeds/iot-temp" -m "32.1"
```

### Test Endpoints (Development Only)

#### Simulate Sensor Data

```http
POST /test/sensor-data
```

Body:

```json
{
  "homeId": "home_id",
  "feed": "iot-temp",
  "value": "25.5",
  "time": "2026-05-14T10:00:00.000Z"
}
```

#### Simulate Alert

```http
POST /test/alert-trigger
```

Body:

```json
{
  "homeId": "home_id",
  "feed": "iot-temp",
  "value": 36.2,
  "threshold": 35,
  "direction": "above_max"
}
```

#### Manual Trigger Time Rule

```http
POST /test/trigger-rule/:ruleId
```

#### Get Test Logs

```http
GET /test/logs
```

### Lưu Ý Frontend

- **UI Components**:
  - List rules với toggle enable/disable.
  - Form tạo rule: Select trigger type, add conditions, add actions.
  - Cron builder cho time rules (sử dụng thư viện như react-cron-generator).

- **Validation**:
  - Cron expression: Validate format trước khi submit.
  - Feed names: Match với feeds đã config trong home settings.
  - Permissions: Chỉ owner/admin có thể CRUD.

- **Realtime Updates**:
  - Sau create/update/delete, refresh list rules.
  - Có thể add Socket.IO events cho rule execution logs nếu cần.

- **Error Handling**:
  - 400: Validation errors (invalid cron, missing fields).
  - 403: Insufficient permissions.
  - 404: Rule/home not found.

### Troubleshooting

- **Rule không trigger**: Check enabled=true, trigger match, conditions pass.
- **Cooldown**: Rule có cooldown_seconds, tránh spam.
- **Logs**: Check server console cho automation logs.
- **Socket Connection**: Automation engine cần connect đến Socket.IO server để nhận events.
