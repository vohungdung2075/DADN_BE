import express from "express";
import deviceControllers from "../controllers/device.controllers.js";

const deviceRouter = express.Router();

deviceRouter.post("/device/command", deviceControllers.handleSendCommand);

export default deviceRouter;