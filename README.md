# IoT Application with MQTT & WebSocket

Ứng dụng IoT sử dụng MQTT và WebSocket để nhận dữ liệu thời gian thực từ thiết bị, tích hợp Adafruit IO và MongoDB để lưu trữ dữ liệu cảm biến.

---

## Tech Stack

- **Broker**: Adafruit IO (MQTT)
- **Communication**: WebSocket, MQTT
- **Database**: MongoDB
- **Runtime**: Node.js

## Installation

```bash
# Clone repository
git clone <repo-url>
cd DADN

# Install dependencies
npm install
```

## Configuration

Tạo file `.env`:

```env
ADAFRUIT_USERNAME=your_username
ADAFRUIT_KEY=your_key
MQTT_BROKER=io.adafruit.com
MONGODB_URI=mongodb://localhost:27017/iot_app
WEBSOCKET_PORT=8080
```

## Usage

```bash
npm start
```

## Project Structure

```
.
├── src/
├── config/
├── controllers/
├── routes/
├── models/
├── mqtt/
├── socket/
├── utils/
└── README.md
```

---

## Section 1 — Authentication (Xác thực người dùng)

Hệ thống cung cấp các API xác thực để đăng ký, đăng nhập và bảo vệ tài nguyên bằng JWT.

### Endpoints

#### Đăng ký tài khoản

```
POST /api/auth/register
```

**Request body:**
```json
{
  "username": "user01",
  "email": "user01@example.com",
  "password": "secret123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công"
}
```

---

#### Đăng nhập

```
POST /api/auth/login
```

**Request body:**
```json
{
  "email": "user01@example.com",
  "password": "secret123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "<jwt_token>"
}
```

> Sử dụng token trả về trong header `Authorization: Bearer <token>` để gọi các API yêu cầu xác thực.

---

#### Đăng xuất

```
POST /api/auth/logout
```

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Đăng xuất thành công"
}
```

---

## Section 2 — Device & Sensor APIs (Truy xuất và điều khiển thiết bị)

Các API bên dưới cho phép lấy giá trị cảm biến, xem lịch sử dữ liệu, và gửi lệnh bật/tắt thiết bị thông qua MQTT.

> **Available feeds:** `iot-temp`, `iot-humid`, `iot-fan`, `iot-light`, ...

---

### Lấy toàn bộ giá trị hiện tại

```
GET /api/sensor
```

Trả về snapshot mới nhất của tất cả feeds.

**Response:**
```json
{
  "iot-temp": 30.5,
  "iot-humid": 65,
  "iot-fan": "0",
  "iot-light": "1",
  "updatedAt": "2024-06-01T08:00:00.000Z"
}
```


### Lấy giá trị của một feed cụ thể

```
GET /api/sensor/:feed
```

| Param | Mô tả |
|-------|-------|
| `feed` | Tên feed, ví dụ: `iot-temp` |

**Ví dụ:** `GET /api/sensor/iot-temp`

**Response:**
```json
{
  "feed": "iot-temp",
  "value": 30.5,
  "updatedAt": "2024-06-01T08:00:00.000Z"
}
```

**Response (404 — feed không tồn tại):**
```json
{
  "error": "Feed \"iot-xyz\" không tồn tại"
}
```

---

### Lấy lịch sử dữ liệu của một feed

```
GET /api/sensor/:feed/history?limit=<n>
```

| Param | Mô tả |
|-------|-------|
| `feed` | Tên feed, ví dụ: `iot-temp` |
| `limit` *(query)* | Số bản ghi trả về, mặc định `20` |

**Ví dụ:** `GET /api/sensor/iot-temp/history?limit=5`

**Response:**
```json
[
  { "value": 30.5, "timestamp": "2024-06-01T08:00:00.000Z" },
  { "value": 30.1, "timestamp": "2024-06-01T07:55:00.000Z" },
  { "value": 29.8, "timestamp": "2024-06-01T07:50:00.000Z" }
]
```



---

### Gửi lệnh điều khiển thiết bị (bật/tắt)

```
POST /api/device/command
```

Gửi lệnh xuống thiết bị thông qua MQTT (publish tới topic của feed tương ứng).

**Request body:**
```json
{
  "feed": "iot-fan",
  "command": "1"
}
```

| Giá trị `command` | Ý nghĩa |
|-------------------|---------|
| `"1"` | Bật thiết bị |
| `"0"` | Tắt thiết bị |

**Response:**
```json
{
  "success": true,
  "feed": "iot-fan",
  "command": "1"
}
```

**Response (400 — feed không hợp lệ):**
```json
{
  "error": "Feed \"iot-xyz\" không hợp lệ"
}
```



---

## License

MIT