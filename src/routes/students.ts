import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

const studentSchema = z.object({
    name: z.string().min(1),
    class: z.string().min(1),
    stream: z.string().optional(),
    parentId: z.string().uuid().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    status: z.string().optional().default('active'),
    admissionNumber: z.string().min(1).optional(),
    cardUid: z.string().optional(),
});

/**
 * GET /api/students
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const students = await prisma.student.findMany({
            orderBy: { createdAt: 'desc' },
            include: { cards: true }
        });

        // Map to frontend expectation
        const formatted = students.map(s => ({
            ...s,
            name: s.full_name,
            class: s.grade_level,
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[Students] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/students/:id
 */
router.get('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const student = await prisma.student.findUnique({
            where: { id: req.params.id },
            include: {
                parentStudentMaps: {
                    include: { parent: true }
                },
                cards: true
            }
        });

        if (!student) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }

        res.json({
            ...student,
            name: student.full_name,
            class: student.grade_level,
        });
    } catch (error) {
        console.error('[Students] Fetch by id error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/students
 */
router.post('/', (req: AuthenticatedRequest, res: Response, next) => {
    console.log(`[Students] Received create request:`, JSON.stringify(req.body));
    next();
}, validateBody(studentSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        console.log(`[Students] Validation passed. Creating student...`);

        // Admission number is required in schema, if not provided we generate one
        const admissionNumber = data.admissionNumber || `ADM-${Date.now()}`;

        const student = await prisma.$transaction(async (tx) => {
            const newStudent = await tx.student.create({
                data: {
                    admissionNumber,
                    full_name: data.name,
                    grade_level: data.class,
                    stream: data.stream,
                    phone: data.phone,
                    email: data.email,
                    dob: data.dob,
                    gender: data.gender,
                    address: data.address,
                    status: data.status,
                    cardUid: data.cardUid,
                },
            });

            // If cardUid provided, ensure it exists in Cards table and is linked
            if (data.cardUid) {
                await tx.cards.upsert({
                    where: { identifier: data.cardUid },
                    update: { studentId: newStudent.id },
                    create: { identifier: data.cardUid, studentId: newStudent.id }
                });
            }

            return newStudent;
        });

        console.log(`[Students] Student created successfully with ID: ${student.id}`);

        if (data.parentId) {
            console.log(`[Students] Linking to parent: ${data.parentId}`);
            await prisma.parentStudentMap.create({
                data: {
                    studentId: student.id,
                    parentId: data.parentId,
                    relationship: 'Parent'
                }
            });
        }

        res.status(201).json({
            ...student,
            name: student.full_name,
            class: student.grade_level,
        });
    } catch (error) {
        console.error('[Students] Create error:', error);
        res.status(500).json({ error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
});

/**
 * PUT /api/students/:id
 */
router.put('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const cardUid = data.cardUid || data.card_uid;

        const student = await prisma.$transaction(async (tx) => {
            const updatedStudent = await tx.student.update({
                where: { id: req.params.id },
                data: {
                    full_name: data.name,
                    grade_level: data.class,
                    stream: data.stream,
                    phone: data.phone,
                    email: data.email,
                    dob: data.dob,
                    gender: data.gender,
                    address: data.address,
                    status: data.status,
                    cardUid: cardUid,
                },
            });

            // If cardUid is being updated/set
            if (cardUid) {
                // 1. Unlink any other card that might have been assigned to this student
                await tx.cards.updateMany({
                    where: { studentId: updatedStudent.id, NOT: { identifier: cardUid } },
                    data: { studentId: null }
                });

                // 2. Link the new card
                await tx.cards.upsert({
                    where: { identifier: cardUid },
                    update: { studentId: updatedStudent.id },
                    create: { identifier: cardUid, studentId: updatedStudent.id }
                });
            } else if (cardUid === null || cardUid === '') {
                // If explicitly clearing the card
                await tx.cards.updateMany({
                    where: { studentId: updatedStudent.id },
                    data: { studentId: null }
                });
            }

            return updatedStudent;
        });

        res.json({
            ...student,
            name: student.full_name,
            class: student.grade_level,
        });
    } catch (error) {
        console.error('[Students] Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/students/:id
 */
router.delete('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.student.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('[Students] Delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
