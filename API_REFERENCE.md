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
