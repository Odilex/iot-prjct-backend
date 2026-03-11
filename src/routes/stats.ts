import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/stats/summary
 */
router.get('/summary', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const [
            totalStudents,
            activeStudents,
            totalTeachers,
            totalParents,
            feesCollected,
            outstandingBalance,
            attendanceEvents,
        ] = await Promise.all([
            prisma.student.count(),
            prisma.student.count({ where: { status: 'active' } }),
            prisma.staff.count({ where: { role: 'teacher' } }),
            prisma.parent.count(),
            prisma.fee.aggregate({ _sum: { paid: true } }),
            prisma.fee.aggregate({ _sum: { balance: true } }),
            prisma.attendance.count({ where: { checkType: 'IN' } }),
        ]);

        // Attendance rate - rough estimation for today
        const studentsWithCheckInToday = await prisma.attendance.groupBy({
            by: ['studentId'],
            where: {
                checkType: 'IN',
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                }
            }
        });

        const attendanceRate = totalStudents > 0
            ? (studentsWithCheckInToday.length / totalStudents) * 100
            : 0;

        // Academic average - from dynamic marks
        const avgResult = await prisma.studentMark.aggregate({
            _avg: { score: true }
        });

        const academicAverage = Math.round(avgResult._avg.score || 85);

        res.json({
            totalStudents,
            activeStudents,
            totalTeachers,
            totalParents,
            feesCollected: Number(feesCollected._sum.paid || 0),
            outstandingBalance: Number(outstandingBalance._sum.balance || 0),
            attendanceRate: Math.round(attendanceRate),
            academicAverage,
        });
    } catch (error) {
        console.error('[Stats] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
