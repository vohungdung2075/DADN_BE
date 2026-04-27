import express from "express";
import sensorControllers from "../controllers/sensor.controllers.js";
import authware from "../../middleware/authware.js";
import tenantMiddleware from "../../middleware/tenant.middleware.js";
import authorizedroles from "../../middleware/authorizedroles.js";

const sensorRouter = express.Router();

sensorRouter.get(
	"/homes/:homeId/sensor",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	sensorControllers.handleGetAllFeeds,
);

sensorRouter.get(
	"/homes/:homeId/sensor/:feed",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	sensorControllers.handleGetFeed,
);

sensorRouter.get(
	"/homes/:homeId/sensor/:feed/history",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	sensorControllers.handleGetFeedLogs,
);

sensorRouter.get(
	"/homes/:homeId/metrics",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	sensorControllers.handleGetMetrics,
);

sensorRouter.get(
	"/homes/:homeId/sensor/:feed/stats",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	sensorControllers.handleGetFeedStats,
);

sensorRouter.patch(
	"/homes/:homeId/settings/thresholds",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	authorizedroles.authorizeHomeRole("owner"),
	sensorControllers.handleUpdateThresholds,
);

export default sensorRouter;
