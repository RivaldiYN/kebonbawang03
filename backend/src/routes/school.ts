import { Router } from 'express';
import { getSchoolInfo, updateSchoolInfo } from '../controllers/schoolControllers';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public route - get school information
// GET /api/school/info
router.get('/info', getSchoolInfo);

// Protected route - update school information
// PUT /api/school/info
router.put('/info', authenticateToken, updateSchoolInfo);

export default router;