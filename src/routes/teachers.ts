import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

const teacherSchema = z.object({
    name: z.string().min(1),
    subject: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    classes: z.array(z.string()).optional(), // Frontend sends array probably
    qualification: z.string().optional(),
    experience: z.string().optional(),
    status: z.string().optional().default('active'),
});

/**
 * GET /api/teachers
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const teachers = await prisma.staff.findMany({
            where: { role: 'teacher' },
            orderBy: { createdAt: 'desc' },
        });

        const formatted = teachers.map(t => ({
            ...t,
            name: t.full_name,
            subject: t.subject_specialty,
            classes: t.classes ? t.classes.split(',') : [],
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[Teachers] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/teachers/:id
 */
router.get('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const teacher = await prisma.staff.findUnique({
            where: { id: req.params.id },
        });

        if (!teacher) {
            res.status(404).json({ error: 'Teacher not found' });
            return;
        }

        res.json({
            ...teacher,
            name: teacher.full_name,
            subject: teacher.subject_specialty,
            classes: teacher.classes ? teacher.classes.split(',') : [],
        });
    } catch (error) {
        console.error('[Teachers] Fetch by id error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/teachers
 */
router.post('/', validateBody(teacherSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const teacher = await prisma.staff.create({
            data: {
                full_name: data.name,
                subject_specialty: data.subject,
                phone: data.phone,
                email: data.email,
                classes: data.classes ? data.classes.join(',') : '',
                qualification: data.qualification,
                experience: data.experience,
                status: data.status,
                role: 'teacher',
            },
        });

        res.status(201).json({
            ...teacher,
            name: teacher.full_name,
            subject: teacher.subject_specialty,
            classes: teacher.classes ? teacher.classes.split(',') : [],
        });
    } catch (error) {
        console.error('[Teachers] Create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/teachers/:id
 */
router.put('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const teacher = await prisma.staff.update({
            where: { id: req.params.id },
            data: {
                full_name: data.name,
                subject_specialty: data.subject,
                phone: data.phone,
                email: data.email,
                classes: data.classes ? data.classes.join(',') : '',
                qualification: data.qualification,
                experience: data.experience,
                status: data.status,
            },
        });

        res.json({
            ...teacher,
            name: teacher.full_name,
            subject: teacher.subject_specialty,
            classes: teacher.classes ? teacher.classes.split(',') : [],
        });
    } catch (error) {
        console.error('[Teachers] Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/teachers/:id
 */
router.delete('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.staff.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        console.error('[Teachers] Delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
