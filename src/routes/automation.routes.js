import express from "express";
import automationControllers from "../controllers/automation.controllers.js";
import authorizedroles from "../middleware/authorizedroles.js";
import authware from "../middleware/authware.js";

const router = express.Router();

// Middleware để check quyền: chỉ owner hoặc admin
const checkHomeAccess = authorizedroles.authorizeHomeRole("owner", "admin");

// Routes cho rules của một home
router.get("/homes/:homeId/rules", authware.authMiddleware, checkHomeAccess, automationControllers.handleGetRules);
router.post("/homes/:homeId/rules", authware.authMiddleware, checkHomeAccess, automationControllers.handleCreateRule);
router.put("/rules/:ruleId", authware.authMiddleware, automationControllers.handleUpdateRule); // Cần check homeId trong controller
router.delete("/rules/:ruleId", authware.authMiddleware, automationControllers.handleDeleteRule); // Cần check homeId trong controller

export default router;