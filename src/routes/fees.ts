import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticateJWT);

const feeSchema = z.object({
    studentId: z.string().uuid(),
    studentName: z.string().optional(),
    class: z.string(),
    term: z.string(),
    amount: z.number(),
    paid: z.number().optional().default(0),
    balance: z.number().optional(),
    status: z.string().optional().default('pending'),
});

/**
 * GET /api/fees
 * Supports ?studentId=...
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { studentId } = req.query;
        const where: any = {};
        if (studentId) where.studentId = studentId;

        const fees = await prisma.fee.findMany({
            where,
            include: { student: { select: { full_name: true } } },
            orderBy: { createdAt: 'desc' },
        });


        const formatted = fees.map(f => ({
            ...f,
            studentName: f.student.full_name,
            amount: Number(f.amount),
            paid: Number(f.paid),
            balance: Number(f.balance),
        }));

        res.json(formatted);
    } catch (error) {
        console.error('[Fees] Fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/fees
 */
router.post('/', validateBody(feeSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const balance = data.balance !== undefined ? data.balance : (data.amount - (data.paid || 0));

        const fee = await prisma.fee.create({
            data: {
                studentId: data.studentId,
                class: data.class,
                term: data.term,
                amount: new Prisma.Decimal(data.amount),
                paid: new Prisma.Decimal(data.paid || 0),
                balance: new Prisma.Decimal(balance),
                status: data.status,
                payments: [],
            },
            include: { student: { select: { full_name: true } } }
        });

        res.status(201).json({
            ...fee,
            studentName: fee.student.full_name,
            amount: Number(fee.amount),
            paid: Number(fee.paid),
            balance: Number(fee.balance),
        });
    } catch (error) {
        console.error('[Fees] Create error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/fees/:id
 */
router.put('/:id', validateParams(z.object({ id: z.string().uuid() })), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = req.body;
        const updateData: any = {};
        if (data.class) updateData.class = data.class;
        if (data.term) updateData.term = data.term;
        if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
        if (data.paid !== undefined) updateData.paid = new Prisma.Decimal(data.paid);
        if (data.balance !== undefined) updateData.balance = new Prisma.Decimal(data.balance);
        if (data.status) updateData.status = data.status;

        const fee = await prisma.fee.update({
            where: { id: req.params.id },
            data: updateData,
            include: { student: { select: { full_name: true } } }
        });

        res.json({
            ...fee,
            studentName: fee.student.full_name,
            amount: Number(fee.amount),
            paid: Number(fee.paid),
            balance: Number(fee.balance),
        });
    } catch (error) {
        console.error('[Fees] Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/fees/:id/payments
 */
router.post('/:id/payments', validateParams(z.object({ id: z.string().uuid() })), validateBody(z.object({
    date: z.string(),
    amount: z.number(),
    method: z.string(),
    receiptNo: z.string(),
})), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const payment = req.body;
        const fee = await prisma.fee.findUnique({ where: { id: req.params.id } });

        if (!fee) {
            res.status(404).json({ error: 'Fee record not found' });
            return;
        }

        const currentPayments = (fee.payments as any[]) || [];
        const newPayments = [...currentPayments, payment];

        const newPaid = Number(fee.paid) + payment.amount;
        const newBalance = Number(fee.amount) - newPaid;
        const newStatus = newBalance <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');

        const updated = await prisma.fee.update({
            where: { id: req.params.id },
            data: {
                payments: newPayments,
                paid: new Prisma.Decimal(newPaid),
                balance: new Prisma.Decimal(newBalance),
                status: newStatus,
            },
            include: { student: { select: { full_name: true } } }
        });

        res.json({
            ...updated,
            studentName: updated.student.full_name,
            amount: Number(updated.amount),
            paid: Number(updated.paid),
            balance: Number(updated.balance),
        });
    } catch (error) {
        console.error('[Fees] Payment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/fees/payments
 */
router.get('/payments', async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const fees = await (prisma.fee as any).findMany({
            where: {
                NOT: {
                    payments: { equals: Prisma.AnyNull }
                }
            },
            include: { student: { select: { full_name: true } } }
        });

        const allPayments: any[] = [];
        fees.forEach((f: any) => {
            const payments = (f.payments as any[]) || [];
            payments.forEach(p => {
                allPayments.push({
                    ...p,
                    studentId: f.studentId,
                    studentName: f.student?.full_name || 'Unknown Student',
                    feeId: f.id,
                });
            });
        });

        // Sort by date desc
        allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        res.json(allPayments);
    } catch (error) {
        console.error('[Fees] Payments history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
