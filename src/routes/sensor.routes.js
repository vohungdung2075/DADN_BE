import express from "express";
import sensorControllers from "../controllers/sensor.controllers.js";

const sensorRouter = express.Router();

sensorRouter.get("/sensor", sensorControllers.handleGetAllFeeds);
sensorRouter.get("/sensor/:feed", sensorControllers.handleGetFeed);
sensorRouter.get("/sensor/:feed/history", sensorControllers.handleGetFeedLogs);

export default sensorRouter; 