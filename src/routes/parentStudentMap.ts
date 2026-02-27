import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/parentstudentmap
 * Returns all relationships between parents and students
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const maps = await prisma.parentStudentMap.findMany({
            include: {
                parent: true,
                student: true
            }
        });

        // Format for frontend if needed
        const formatted = maps.map(m => ({
            parentId: m.parentId,
            studentId: m.studentId,
            relationship: m.relationship,
            parentName: m.parent.full_name,
            studentName: m.student.full_name,
            grade: m.student.grade_level
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[ParentStudentMap] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/parentstudentmap
 * Create a new relationship
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { parentId, studentId, relationship } = req.body;

        if (!parentId || !studentId) {
            res.status(400).json({ error: 'parentId and studentId are required' });
            return;
        }

        const map = await prisma.parentStudentMap.create({
            data: {
                parentId,
                studentId,
                relationship: relationship || 'Parent'
            }
        });

        res.status(201).json(map);
    } catch (error) {
        console.error('[ParentStudentMap] Create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
