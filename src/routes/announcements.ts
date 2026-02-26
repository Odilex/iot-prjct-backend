import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';

const router = Router();
router.use(authenticateJWT);

const announcementSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    priority: z.string().optional().default('low'),
    category: z.string().optional().default('general'),
    targetAudience: z.string().optional().default('all'),
    published: z.boolean().optional().default(false),
});

/**
 * GET /api/announcements
 */
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const announcements = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(announcements);
    } catch (error) {
        console.error('[Announcements] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/announcements
 */
router.post('/', validateBody(announcementSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const announcement = await prisma.announcement.create({
            data: req.body,
        });
        res.status(201).json(announcement);
    } catch (error) {
        console.error('[Announcements] Create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/announcements/:id
 */
router.put('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const announcement = await prisma.announcement.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json(announcement);
    } catch (error) {
        console.error('[Announcements] Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/announcements/:id
 */
router.delete('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.announcement.delete({
            where: { id: req.params.id },
        });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('[Announcements] Delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/announcements/:id/toggle-publish
 */
router.patch('/:id/toggle-publish', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const announcement = await prisma.announcement.findUnique({
            where: { id: req.params.id },
        });

        if (!announcement) {
            res.status(404).json({ error: 'Announcement not found' });
            return;
        }

        const updated = await prisma.announcement.update({
            where: { id: req.params.id },
            data: { published: !announcement.published },
        });

        res.json(updated);
    } catch (error) {
        console.error('[Announcements] Toggle publish error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/announcements/:id
 */
router.get('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const announcement = await prisma.announcement.findUnique({
            where: { id: req.params.id },
        });

        if (!announcement) {
            res.status(404).json({ error: 'Announcement not found' });
            return;
        }

        res.json(announcement);
    } catch (error) {
        console.error('[Announcements] Fetch by id error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
