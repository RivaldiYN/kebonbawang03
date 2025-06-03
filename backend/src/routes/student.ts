import { Router } from 'express';
import { 
  checkGraduation, 
  getAllStudents, 
  createStudent, 
  updateStudent, 
  deleteStudent,
  getGraduationStats 
} from '../controllers/studentControllers';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public route - check graduation status
// GET /api/students/check?search=nama_atau_nisn
router.get('/check', checkGraduation);

// Protected routes - require authentication
// GET /api/students/stats
router.get('/stats', authenticateToken, getGraduationStats);

// GET /api/students
router.get('/', authenticateToken, getAllStudents);

// POST /api/students
router.post('/', authenticateToken, createStudent);

// PUT /api/students/:id
router.put('/:id', authenticateToken, updateStudent);

// DELETE /api/students/:id
router.delete('/:id', authenticateToken, deleteStudent);

export default router;