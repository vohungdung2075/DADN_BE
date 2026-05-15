# IoT Smart Home Backend

Backend Node.js cho hệ thống nhà thông minh, dùng MQTT, Adafruit IO, MongoDB và Socket.IO để giám sát và điều khiển thiết bị theo thời gian thực.

## Tổng quan

- Theo dõi và điều khiển thiết bị smart home theo thời gian thực.
- Tích hợp MQTT với Adafruit IO để giao tiếp độ trễ thấp giữa server và phần cứng.
- Lưu dữ liệu người dùng, home, thiết bị, trạng thái thiết bị và lịch sử thao tác trong MongoDB.
- Phát realtime event theo từng home bằng Socket.IO, bao gồm online presence và cảnh báo ngưỡng.
- Hỗ trợ phân quyền theo vai trò: `owner`, `member`, `guest`, và `admin`.

## Công nghệ sử dụng

- Node.js
- Express
- MongoDB + Mongoose
- MQTT + Adafruit IO
- Socket.IO
- JWT Authentication

## Tính năng chính

- Đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu và lấy thông tin tài khoản hiện tại.
- Quản lý home, thêm/xóa thành viên, và cập nhật vai trò thành viên.
- Xem dữ liệu sensor, lịch sử feed, thống kê feed và metrics theo từng home.
- Gửi lệnh điều khiển thiết bị qua MQTT cho các actuator được hỗ trợ.
- Cập nhật ngưỡng nhiệt độ và độ ẩm để phát cảnh báo realtime.
- API admin để quản lý người dùng và home ở cấp hệ thống.

## Cấu trúc thư mục

```text
src/
├── app.js
├── config/
├── controllers/
├── models/
├── mqtt/
├── routes/
├── services/
├── socket/
└── utils/

middleware/
```

## Cài đặt

```bash
npm install
```

## Biến môi trường

Tạo file `.env` với nội dung tối thiểu sau:

```env
PORT=
JWT_SECRET=
MONGO_URL=
```

Thông tin MQTT và Adafruit IO được lưu theo từng home trong MongoDB:

```text
aioUsername
aioKey
aioFeedIds
```

## Chạy ứng dụng

```bash
npm start
```

Trong môi trường phát triển:

```bash
npm run dev
```

## API chính

### Auth

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/forgot-password`
- `PATCH /api/auth/reset-password/:token`
- `GET /api/auth/me`

### Home

- `GET /api/homes`
- `POST /api/homes/:homeId/members`
- `GET /api/homes/:homeId/members`
- `PATCH /api/homes/:homeId/members/:userId/role`
- `DELETE /api/homes/:homeId/members/:userId`

### Sensor

- `GET /api/homes/:homeId/sensor`
- `GET /api/homes/:homeId/sensor/:feed`
- `GET /api/homes/:homeId/sensor/:feed/history`
- `GET /api/homes/:homeId/sensor/:feed/stats`
- `GET /api/homes/:homeId/metrics`
- `PATCH /api/homes/:homeId/settings/thresholds`

### Device

- `POST /api/homes/:homeId/device/command`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/homes/user/:userId`
- `DELETE /api/admin/homes/:homeId`

## Realtime events

Socket.IO được dùng để phát sự kiện realtime theo từng room của home.

### Client events

- `join_room`
- `leave_room`

### Server events

- `room_joined`
- `room_left`
- `room_error`
- `user_online`
- `user_offline`
- `mqtt_data`
- `alert_triggered`

## Collections trong MongoDB

- `users`
- `homes`
- `homeMembers`
- `homeSettings`
- `devices`
- `deviceStates`
- `deviceLogs`

## Ghi chú

- Mỗi home có thể dùng riêng bộ thông tin MQTT và danh sách feed Adafruit IO.
- Dữ liệu MQTT được lưu vào trạng thái thiết bị và lịch sử log.
- Nếu giá trị nhiệt độ hoặc độ ẩm vượt ngưỡng, hệ thống sẽ phát event cảnh báo realtime.