import express from "express";
import deviceControllers from "../controllers/device.controllers.js";
import authware from "../../middleware/authware.js";
import tenantMiddleware from "../../middleware/tenant.middleware.js";
import authorizedroles from "../../middleware/authorizedroles.js";

const deviceRouter = express.Router();

deviceRouter.post("/homes/:homeId/device/command", 
	authware.authMiddleware, 
	tenantMiddleware.checkTenant, 
	authorizedroles.authorizeHomeRole("owner", "member"), 
	deviceControllers.handleSendCommand 
);

export default deviceRouter;