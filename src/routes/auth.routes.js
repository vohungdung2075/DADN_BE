import express from 'express';
import authControllers from "../controllers/auth.controllers.js";

const router = express.Router();
router.post('/login', authControllers.makeLogin);
router.post('/signup', authControllers.signUp);
router.post('/forgot-password', authControllers.forgotPassword);
router.patch('/reset-password/:token',authControllers.resetPassword);
export default router;
