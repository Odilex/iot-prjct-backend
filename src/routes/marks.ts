import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

/**
 * GET /api/marks/subjects
 * Get available subjects for a specific grade/stream
 */
router.get('/subjects', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { grade, stream } = req.query;

        const subjects = await prisma.subject.findMany({
            where: {
                gradeLevel: grade as string || undefined,
                stream: stream as string || undefined
            }
        });

        res.json(subjects);
    } catch (error) {
        console.error('[Marks] Fetch subjects error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/marks
 * Returns grouped marks.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.query;
        const where: any = {};
        if (studentId) where.studentId = studentId;

        const marks = await prisma.studentMark.findMany({
            where,
            include: {
                student: { select: { full_name: true } },
                subject: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const result: any = {};

        // Group newMarks by student, grade, and term
        const grouped: any = {};
        marks.forEach(m => {
            const grade = m.subject.gradeLevel || 'Unknown';
            const key = `${m.studentId}-${grade}-${m.term}`;
            if (!grouped[key]) {
                grouped[key] = {
                    studentId: m.studentId,
                    studentName: m.student.full_name,
                    grade,
                    term: m.term,
                    subjects: {},
                    total: 0,
                    count: 0
                };
            }
            grouped[key].subjects[m.subject.name.toLowerCase()] = m.score;
            grouped[key].total += m.score;
            grouped[key].count += 1;
        });

        // Merge grouped marks into result
        Object.values(grouped).forEach((group: any) => {
            if (!result[group.grade]) result[group.grade] = {};
            if (!result[group.grade][group.term]) result[group.grade][group.term] = [];

            result[group.grade][group.term].push({
                studentId: group.studentId,
                studentName: group.studentName,
                ...group.subjects,
                average: group.total / group.count
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
 */
router.get('/:studentId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.params;
        const marks = await prisma.studentMark.findMany({
            where: { studentId },
            include: { subject: true },
            orderBy: { createdAt: 'desc' }
        });

        res.json(marks);
    } catch (error) {
        console.error('[Marks] Fetch by studentId error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/marks/dynamic
 * Save dynamic marks for multiple subjects
 */
router.post('/dynamic', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId, term, year, marks } = req.body; // marks: [{ subjectId, score, type }]

        if (!studentId || !term || !marks || !Array.isArray(marks)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const createdMarks = await prisma.$transaction(
            marks.map(m => prisma.studentMark.upsert({
                where: {
                    // We don't have a unique constraint on student-subject-term-year-type yet
                    // but we can use id if provided, otherwise create
                    id: m.id || '00000000-0000-0000-0000-000000000000'
                },
                update: { score: m.score, type: m.type || 'exam' },
                create: {
                    studentId,
                    subjectId: m.subjectId,
                    score: m.score,
                    term,
                    year: year || new Date().getFullYear().toString(),
                    type: m.type || 'exam'
                }
            }))
        );

        res.json({ message: 'Marks saved successfully', count: createdMarks.length });
    } catch (error) {
        console.error('[Marks] Save error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
