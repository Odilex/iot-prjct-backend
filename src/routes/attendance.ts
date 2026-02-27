import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/attendance
 * Supports ?studentId=...
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.query;

        // Get students
        const studentWhere: any = {};
        if (studentId) studentWhere.id = studentId;

        const students = await prisma.student.findMany({
            where: studentWhere,
            select: { id: true, full_name: true, grade_level: true }
        });

        // Get all attendance events
        const attendanceWhere: any = { checkType: 'IN' };
        if (studentId) attendanceWhere.studentId = studentId;

        const events = await prisma.attendance.findMany({
            where: attendanceWhere
        });

        // Group by date
        const byDate: any = {};

        events.forEach(e => {
            const date = e.createdAt?.toISOString().split('T')[0];
            if (!date) return;
            if (!byDate[date]) byDate[date] = new Set();
            byDate[date].add(e.studentId);
        });

        const result = Object.keys(byDate).sort().reverse().map(date => ({
            date,
            records: students.map(s => ({
                studentId: s.id,
                studentName: s.full_name,
                class: s.grade_level,
                present: byDate[date].has(s.id),
            }))
        }));

        res.json(result);
    } catch (error) {
        console.error('[Attendance] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/attendance/:studentId
 * Get raw attendance events for a specific student
 */
router.get('/:studentId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.params;
        const attendance = await prisma.attendance.findMany({
            where: { studentId },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(attendance);
    } catch (error) {
        console.error('[Attendance] Fetch by studentId error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * POST /api/attendance
 */
router.post('/', validateBody(z.object({
    date: z.string(),
    records: z.array(z.object({
        studentId: z.string().uuid(),
        studentName: z.string(),
        class: z.string(),
        present: z.boolean(),
    })),
})), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { date, records } = req.body;
        const targetDate = new Date(date);

        // For each present student, create an IN event if they don't have one for that day
        const presentRecords = records.filter((r: any) => r.present);

        await prisma.$transaction(
            presentRecords.map((r: any) =>
                prisma.attendance.create({
                    data: {
                        studentId: r.studentId,
                        checkType: 'IN',
                        deviceId: 'manual-entry',
                        createdAt: targetDate,
                    }
                })
            )
        );

        res.json({ message: 'Attendance recorded successfully' });
    } catch (error) {
        console.error('[Attendance] Record error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/attendance/term/:term
 */
router.get('/term/:term', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { term } = req.params;
        const events = await prisma.attendance.findMany({
            where: { term, checkType: 'IN' },
            include: { student: { select: { full_name: true, grade_level: true } } }
        });

        const formatted = events.map(e => ({
            studentId: e.studentId,
            studentName: e.student?.full_name,
            class: e.student?.grade_level,
            date: e.createdAt?.toISOString().split('T')[0],
            present: true,
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[Attendance] Fetch by term error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
