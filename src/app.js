import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { connect } from "./config/database.js";
import { initMqttClient } from "./mqtt/mqttClient.js";
import { joinHomePresence, leaveHomePresence, removeSocketPresence, getOnlineMemberCountByHome } from "./socket/presence.store.js";
import HomeMembers from "./models/homeMember.model.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";
import sensorRouter from "./routes/sensor.routes.js";
import deviceRouter from "./routes/device.routes.js";
import homeRouter from "./routes/home.routes.js";

const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const extractTokenFromSocket = (socket) => {
	const rawAuthToken = socket.handshake?.auth?.token;
	if (rawAuthToken) {
		if (String(rawAuthToken).startsWith("Bearer ")) {
			return String(rawAuthToken).split(" ")[1];
		}
		return String(rawAuthToken);
	}

	const authHeader = socket.handshake?.headers?.authorization;
	if (authHeader && String(authHeader).startsWith("Bearer ")) {
		return String(authHeader).split(" ")[1];
	}

	return null;
};

const extractHomeId = (payload) => {
	if (!payload) return null;
	if (typeof payload === "object") return payload.homeId || null;
	return payload;
};

io.use((socket, next) => {
	const token = extractTokenFromSocket(socket);
	if (!token) return next(new Error("Unauthorized socket: token is required"));
	try {
		socket.data.user = jwt.verify(token, process.env.JWT_SECRET);
		return next();
	} catch (err) {
		return next(new Error("Unauthorized socket: invalid token"));
	}
});

io.on("connection", (socket) => {
	console.log(`Socket connected: ${socket.id}`);

	socket.on("join_room", async (payload) => {
		try {
			const homeId = extractHomeId(payload);
			if (!homeId) {
				socket.emit("room_error", { message: "homeId is required" });
				return;
			}

			const membership = await HomeMembers.findOne({
				userId: socket.data.user.id,
				homeId,
			}).select("role");

			if (!membership) {
				socket.emit("room_error", { message: "Access denied: not a member of this home" });
				return;
			}

			const normalizedHomeId = String(homeId);
			const roomName = `home:${normalizedHomeId}`;

			socket.join(roomName);
			joinHomePresence(normalizedHomeId, socket.id);

			const onlineMemberCount = getOnlineMemberCountByHome(normalizedHomeId);
			io.to(roomName).emit("user_online", {
				homeId: normalizedHomeId,
				socketId: socket.id,
				onlineMemberCount,
			});

			socket.emit("room_joined", { homeId: normalizedHomeId });
			console.log(`Socket ${socket.id} joined room: ${roomName}`);
		} catch (err) {
			socket.emit("room_error", { message: "Join room failed" });
		}
	});

	socket.on("leave_room", (payload) => {
		const homeId = extractHomeId(payload);
		if (!homeId) {
			socket.emit("room_error", { message: "homeId is required" });
			return;
		}

		const normalizedHomeId = String(homeId);
		const roomName = `home:${normalizedHomeId}`;

		socket.leave(roomName);
		leaveHomePresence(normalizedHomeId, socket.id);

		const onlineMemberCount = getOnlineMemberCountByHome(normalizedHomeId);
		io.to(roomName).emit("user_offline", {
			homeId: normalizedHomeId,
			socketId: socket.id,
			onlineMemberCount,
		});

		socket.emit("room_left", { homeId: normalizedHomeId });
		console.log(`Socket ${socket.id} left room: ${roomName}`);
	});

	socket.on("disconnect", () => {
		const affectedHomes = removeSocketPresence(socket.id);
		for (const homeId of affectedHomes) {
			io.to(`home:${homeId}`).emit("user_offline", {
				homeId: String(homeId),
				socketId: socket.id,
				onlineMemberCount: getOnlineMemberCountByHome(homeId),
			});
		}
		console.log(`Socket disconnected: ${socket.id}`);
	});
});

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api", homeRouter);
app.use("/api", sensorRouter);
app.use("/api", deviceRouter);

const PORT = process.env.PORT;
httpServer.listen(PORT, async () => {
	await connect();
	console.log(`Server is running on ${PORT}`);

	await initMqttClient(io);
});
