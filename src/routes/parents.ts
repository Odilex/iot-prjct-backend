import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

const parentSchema = z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional(),
    address: z.string().optional(),
    status: z.string().optional().default('active'),
});

/**
 * GET /api/parents
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const parents = await prisma.parent.findMany({
            orderBy: { createdAt: 'desc' },
        });

        const formatted = parents.map(p => ({
            ...p,
            name: p.full_name,
            phone: p.phone_number,
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[Parents] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/parents/:id
 */
router.get('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parent = await prisma.parent.findUnique({
            where: { id: req.params.id },
            include: {
                parentStudentMaps: {
                    include: { student: true }
                }
            }
        });

        if (!parent) {
            res.status(404).json({ error: 'Parent not found' });
            return;
        }

        res.json({
            ...parent,
            name: parent.full_name,
            phone: parent.phone_number,
        });
    } catch (error) {
        console.error('[Parents] Fetch by id error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/parents
 */
router.post('/', validateBody(parentSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const parent = await prisma.parent.create({
            data: {
                full_name: data.name,
                phone_number: data.phone,
                email: data.email,
                address: data.address,
                status: data.status,
            },
        });

        res.status(201).json({
            ...parent,
            name: parent.full_name,
            phone: parent.phone_number,
        });
    } catch (error) {
        console.error('[Parents] Create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/parents/:id
 */
router.put('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const parent = await prisma.parent.update({
            where: { id: req.params.id },
            data: {
                full_name: data.name,
                phone_number: data.phone,
                email: data.email,
                address: data.address,
                status: data.status,
            },
        });

        res.json({
            ...parent,
            name: parent.full_name,
            phone: parent.phone_number,
        });
    } catch (error) {
        console.error('[Parents] Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/parents/:id
 */
router.delete('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.parent.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Parent deleted successfully' });
    } catch (error) {
        console.error('[Parents] Delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/parents/:id/toggle-status
 */
router.patch('/:id/toggle-status', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parent = await prisma.parent.findUnique({
            where: { id: req.params.id },
        });

        if (!parent) {
            res.status(404).json({ error: 'Parent not found' });
            return;
        }

        const newStatus = parent.status === 'active' ? 'inactive' : 'active';
        const updated = await prisma.parent.update({
            where: { id: req.params.id },
            data: { status: newStatus },
        });

        res.json({
            ...updated,
            name: updated.full_name,
            phone: updated.phone_number,
        });
    } catch (error) {
        console.error('[Parents] Toggle status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
