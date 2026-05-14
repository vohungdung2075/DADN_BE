import express from "express";
import authware from "../middleware/authware.js";
import authorizedroles from "../middleware/authorizedroles.js";
import adminControllers from "../controllers/admin.controllers.js";

const router = express.Router();

router.get(
	"/users",
	authware.authMiddleware,
	authorizedroles.authorizeSystemRole("admin"),
	adminControllers.handleGetAllUsers,
);

router.post(
	"/homes/user/:userId",
	authware.authMiddleware,
	authorizedroles.authorizeSystemRole("admin"),
	adminControllers.handleCreateHome,
);

router.delete(
	"/homes/:homeId",
	authware.authMiddleware,
	authorizedroles.authorizeSystemRole("admin"),
	adminControllers.handleDeleteHome,
);

export default router;
