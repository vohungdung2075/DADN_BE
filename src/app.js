// import mqtt from "mqtt";
import express from "express";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";
import "dotenv/config";
import { connect } from "./config/database.js";
import authRouter from "./routes/auth.routes.js";
import sensorRouter from "./routes/sensor.routes.js";
import deviceRouter from "./routes/device.routes.js";

const app = express();

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api", sensorRouter);
app.use("/api", deviceRouter);

const PORT = process.env.PORT;
httpServer.listen(PORT, async () => {
	await connect();
	console.log(`Server is running on ${PORT}`);
});
