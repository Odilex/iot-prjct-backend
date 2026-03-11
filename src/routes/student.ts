import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/student/profile
 * Get logged-in student's profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const student = await prisma.student.findUnique({
            where: { userId },
            include: {
                parentStudentMaps: {
                    include: { parent: true }
                }
            }
        });

        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }

        return res.json(student);
    } catch (error) {
        console.error('[StudentPortal] Profile error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/student/marks
 * Get logged-in student's marks
 */
router.get('/marks', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const student = await prisma.student.findUnique({
            where: { userId },
            select: { id: true }
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const marks = await prisma.studentMark.findMany({
            where: { studentId: student.id },
            include: { subject: true },
            orderBy: { createdAt: 'desc' }
        });

        // Group by term
        const groupedMarks: any = {};
        marks.forEach(m => {
            if (!groupedMarks[m.term]) groupedMarks[m.term] = [];
            groupedMarks[m.term].push({
                subject: m.subject.name,
                score: m.score,
                maxScore: m.maxScore,
                type: m.type,
                date: m.createdAt
            });
        });

        return res.json(groupedMarks);
    } catch (error) {
        console.error('[StudentPortal] Marks error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/student/attendance
 * Get logged-in student's attendance
 */
router.get('/attendance', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const student = await prisma.student.findUnique({
            where: { userId },
            select: { id: true }
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const attendance = await prisma.attendance.findMany({
            where: { studentId: student.id },
            orderBy: { createdAt: 'desc' },
            take: 50 // Last 50 entries
        });

        return res.json(attendance);
    } catch (error) {
        console.error('[StudentPortal] Attendance error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/student/fees
 * Get logged-in student's fees and transactions
 */
router.get('/fees', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const student = await prisma.student.findUnique({
            where: { userId },
            select: { id: true }
        });

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const [fees, transactions] = await Promise.all([
            prisma.fee.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.feeTransaction.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return res.json({ fees, transactions });
    } catch (error) {
        console.error('[StudentPortal] Fees error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
