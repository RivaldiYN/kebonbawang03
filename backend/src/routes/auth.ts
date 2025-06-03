import { Router } from 'express';
import { login, verifyToken, changePassword } from '../controllers/authControllers';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/verify
router.get('/verify', authenticateToken, verifyToken);

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, changePassword);

export default router;