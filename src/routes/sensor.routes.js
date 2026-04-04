import express from "express";
import sensorControllers from "../controllers/sensor.controllers.js";
import authware from "../../middleware/authware.js";

const sensorRouter = express.Router();

sensorRouter.get("/sensor", authware.authMiddleware, sensorControllers.handleGetAllFeeds);
sensorRouter.get("/sensor/:feed", authware.authMiddleware, sensorControllers.handleGetFeed);
sensorRouter.get("/sensor/:feed/history", authware.authMiddleware, sensorControllers.handleGetFeedLogs);

export default sensorRouter; 