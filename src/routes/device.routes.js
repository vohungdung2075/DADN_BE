import express from "express";
import deviceControllers from "../controllers/device.controllers.js";
import authware from "../middleware/authware.js";
// import authorizedroles from "../../middleware/authorizedroles.js";

const deviceRouter = express.Router();

deviceRouter.post(
	"/device/command", authware.authMiddleware, deviceControllers.handleSendCommand );

export default deviceRouter;