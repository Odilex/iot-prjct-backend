import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/marks
 * Supports ?studentId=...
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.query;
        const where: any = {};
        if (studentId) where.studentId = studentId;

        const marks = await prisma.mark.findMany({
            where,
            include: { student: { select: { full_name: true } } },
        });

        const result: any = {};

        marks.forEach(m => {
            if (!result[m.grade]) result[m.grade] = {};
            if (!result[m.grade][m.term]) result[m.grade][m.term] = [];

            result[m.grade][m.term].push({
                studentId: m.studentId,
                studentName: m.student.full_name,
                math: m.math,
                english: m.english,
                science: m.science,
                history: m.history,
                average: m.average,
            });
        });

        res.json(result);
    } catch (error) {
        console.error('[Marks] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/marks/:studentId
 * Get raw marks for a specific student
 */
router.get('/:studentId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.params;
        const marks = await prisma.mark.findMany({
            where: { studentId },
            include: { student: { select: { full_name: true } } },
            orderBy: { grade: 'desc' }
        });

        res.json(marks);
    } catch (error) {
        console.error('[Marks] Fetch by studentId error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * PUT /api/marks
 */
router.put('/', validateBody(z.object({
    grade: z.string(),
    term: z.string(),
    rows: z.array(z.object({
        studentId: z.string().uuid(),
        studentName: z.string(),
        math: z.number(),
        english: z.number(),
        science: z.number(),
        history: z.number(),
        average: z.number(),
    })),
})), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { grade, term, rows } = req.body;

        // delete existing for this grade/term and insert new
        await prisma.$transaction([
            prisma.mark.deleteMany({
                where: { grade, term }
            }),
            prisma.mark.createMany({
                data: rows.map((row: any) => ({
                    studentId: row.studentId,
                    grade,
                    term,
                    math: row.math,
                    english: row.english,
                    science: row.science,
                    history: row.history,
                    average: row.average,
                }))
            })
        ]);

        res.json({ message: 'Marks updated successfully' });
    } catch (error) {
        console.error('[Marks] Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * GET /api/marks/term/:term
 */
router.get('/term/:term', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { term } = req.params;
        const marks = await prisma.mark.findMany({
            where: { term },
            include: { student: { select: { full_name: true } } },
        });

        const formatted = marks.map(m => ({
            studentId: m.studentId,
            studentName: m.student.full_name,
            math: m.math,
            english: m.english,
            science: m.science,
            history: m.history,
            average: m.average,
            grade: m.grade,
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[Marks] Fetch by term error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
