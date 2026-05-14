import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { connect } from "./config/database.js";
import { initMqttClient } from "./mqtt/mqttClient.js";
import { joinHomePresence, leaveHomePresence, removeSocketPresence, getOnlineMemberCountByHome } from "./socket/presence.store.js";
import HomeMembers from "./models/homeMember.model.js";
import Rule from "./models/rule.model.js";
import authRouter from "./routes/auth.routes.js";
import adminRouter from "./routes/admin.routes.js";
import sensorRouter from "./routes/sensor.routes.js";
import deviceRouter from "./routes/device.routes.js";
import homeRouter from "./routes/home.routes.js";
import automationRouter from "./routes/automation.routes.js";
import testRouter from "./routes/test.routes.js";

// Automation imports
import AutomationLoader from "./automation/automation.loader.js";
import AutomationEngine from "./automation/automation.engine.js";
import RuleEngine from "./automation/ruleengine.js";
import TimeTrigger from "./automation/time.trigger.js";
import { DeviceCommandSender } from "./automation/device.command.sender.js";

const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// Attach io to app for test routes
app.set('io', io);

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
const isAutomationClient = (socket) => {
	const user = socket.data?.user;
	return user?.role === "automation" || user?.automation === true;
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

			const normalizedHomeId = String(homeId);
			const roomName = `home:${normalizedHomeId}`;
			const isAutomation = isAutomationClient(socket);

			if (!isAutomation) {
				const membership = await HomeMembers.findOne({
					userId: socket.data.user.id,
					homeId,
				}).select("role");

				if (!membership) {
					socket.emit("room_error", { message: "Access denied: not a member of this home" });
					return;
				}
			}

			socket.join(roomName);
			if (!isAutomation) {
				joinHomePresence(normalizedHomeId, socket.id);

				const onlineMemberCount = getOnlineMemberCountByHome(normalizedHomeId);
				io.to(roomName).emit("user_online", {
					homeId: normalizedHomeId,
					socketId: socket.id,
					onlineMemberCount,
				});
			}

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
		const isAutomation = isAutomationClient(socket);

		socket.leave(roomName);
		if (!isAutomation) {
			leaveHomePresence(normalizedHomeId, socket.id);

			const onlineMemberCount = getOnlineMemberCountByHome(normalizedHomeId);
			io.to(roomName).emit("user_offline", {
				homeId: normalizedHomeId,
				socketId: socket.id,
				onlineMemberCount,
			});
		}

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
app.use("/api", automationRouter);
app.use("/api/test", testRouter);

const PORT = process.env.PORT || 4000;
if (!process.env.MONGO_URL) {
  throw new Error('MONGO_URL is required in environment variables');
}
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in environment variables');
}
if (!process.env.AUTOMATION_SERVICE_TOKEN) {
  process.env.AUTOMATION_SERVICE_TOKEN = jwt.sign(
    { id: 'automation-service', role: 'automation', automation: true },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );
}
httpServer.listen(PORT, async () => {
	try {
		await connect();
	} catch (err) {
		console.error('Failed to start server due to DB error');
		process.exit(1);
	}

	console.log(`Server is running on ${PORT}`);

	await initMqttClient(io);

	// Initialize Automation System
	const ruleEngine = new RuleEngine({
		getRulesByHomeId: async (homeId) => {
			const rules = await Rule.find({ homeId, enabled: true }).lean();
			return rules;
		}
	});

	const timeTrigger = new TimeTrigger(ruleEngine);

	const automationLoader = new AutomationLoader({
		Rule,
		ruleEngine,
		timeTrigger
	});

	await automationLoader.load();

	// Set loader for controllers
	const { setAutomationLoader } = await import("./controllers/automation.controllers.js");
	setAutomationLoader(automationLoader);

	const automationEngine = AutomationEngine.getInstance();
	const enabledRuleHomes = await Rule.distinct("homeId", { enabled: true });
	const homeIds = enabledRuleHomes.map((id) => String(id));
	await automationEngine.start(ruleEngine, homeIds);

	console.log('Automation system initialized successfully');
});
