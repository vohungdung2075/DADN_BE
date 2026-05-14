import express from 'express';
import authControllers from "../controllers/auth.controllers.js";
import authware from "../middleware/authware.js";

const router = express.Router();
router.post('/login', authControllers.makeLogin);
router.post('/signup', authControllers.signUp);
router.post('/forgot-password', authControllers.forgotPassword);
router.patch('/reset-password/:token',authControllers.resetPassword);

router.get('/me', authware.authMiddleware, authControllers.handleGetMe);
export default router;
