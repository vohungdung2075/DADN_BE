import express from "express";
import homeControllers from "../controllers/home.controllers.js";
import authware from "../middleware/authware.js";
import tenantMiddleware from "../middleware/tenant.middleware.js";
import authorizedroles from "../middleware/authorizedroles.js";

const homeRouter = express.Router();

homeRouter.get(
	"/homes",
	authware.authMiddleware,
	homeControllers.handleGetMyHomes,
);

homeRouter.post(
	"/homes/:homeId/members",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	authorizedroles.authorizeHomeRole("owner"),
	homeControllers.handleAddMember,
);

homeRouter.get(
	"/homes/:homeId/members",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	homeControllers.handleGetHomeMembers,
);

homeRouter.patch(
	"/homes/:homeId/members/:userId/role",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	authorizedroles.authorizeHomeRole("owner"),
	homeControllers.handleUpdateMemberRole,
);

homeRouter.delete(
	"/homes/:homeId/members/:userId",
	authware.authMiddleware,
	tenantMiddleware.checkTenant,
	authorizedroles.authorizeHomeRole("owner"),
	homeControllers.handleRemoveMember,
);

export default homeRouter;
