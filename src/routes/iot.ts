import { Router, Request, Response } from "express";
import prisma from "../config/database";

const iot = Router();

// Receive card id (Initial registration)
interface BodyPayload {
    card: string;
}

/**
 * @route POST /api/iot/card
 * @desc Register a new physical card UID/Identifier in the system
 */
iot.post("/card", async (req: Request, res: Response) => {
    try {
        const { card } = req.body as BodyPayload;

        if (!card) {
            return res.status(400).json({ message: "Card identifier is required" });
        }

        const existing = await prisma.cards.findUnique({
            where: { identifier: card },
            include: { student: true }
        });

        // IF CARD EXISTS
        if (existing) {
            // IF CARD IS ASSIGNED TO A STUDENT -> Record Attendance
            if (existing.studentId && existing.student) {
                const now = new Date();

                // 1. Determine IN or OUT (Toggle based on last record)
                const lastAttendance = await prisma.attendance.findFirst({
                    where: { studentId: existing.studentId },
                    orderBy: { createdAt: 'desc' },
                });

                const checkType = lastAttendance?.checkType === 'IN' ? 'OUT' : 'IN';

                // 2. Create Attendance Record
                const attendance = await prisma.attendance.create({
                    data: {
                        studentId: existing.studentId,
                        checkType: checkType,
                        deviceId: (req.body as any).device_id || 'HTTP-READER',
                        term: 'Term 1' // Default term
                    }
                });

                return res.status(200).json({
                    message: `Attendance recorded: ${checkType}`,
                    success: true,
                    data: {
                        student_name: existing.student.full_name,
                        check_type: checkType,
                        timestamp: attendance.createdAt,
                        wallet_balance: existing.student.walletBalance
                    }
                });
            }

            // IF CARD EXISTS BUT NO STUDENT -> Inform dashboard it's ready for assignment
            return res.status(200).json({
                message: "Card recognized, but not assigned to any student",
                success: false,
                data: existing
            });
        }

        // IF CARD IS NEW -> Register the card in inventory
        const data = await prisma.cards.create({
            data: { identifier: card }
        });

        return res.status(201).json({
            message: "New card registered successfully in system",
            success: true,
            data
        });
    } catch (error) {
        console.error("Error processing card scan:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route GET /api/iot/card
 * @desc List all registered cards
 */
iot.get("/card", async (req: Request, res: Response) => {
    try {
        const cards = await prisma.cards.findMany({
            include: {
                student: {
                    select: {
                        id: true,
                        full_name: true,
                        admissionNumber: true,
                    }
                }
            }
        });
        res.json(cards);
    } catch (error) {
        console.error("Error fetching cards:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route PATCH /api/iot/card/:identifier/assign
 * @desc Assign a registered card to a student
 */
iot.patch(
    "/card/:identifier/assign",
    async (req: Request, res: Response) => {
        try {
            const { identifier } = req.params;
            const { studentId } = req.body;

            // Validate input
            if (!studentId) {
                return res.status(400).json({
                    message: "studentId is required",
                });
            }

            // Check if student exists
            const student = await prisma.student.findUnique({
                where: { id: studentId },
            });

            if (!student) {
                return res.status(404).json({
                    message: "Student not found",
                });
            }

            // Check if card exists
            const card = await prisma.cards.findUnique({
                where: { identifier },
            });

            if (!card) {
                return res.status(404).json({
                    message: "Card not found",
                });
            }

            // Check if card is already assigned to another student
            if (card.studentId && card.studentId !== studentId) {
                return res.status(409).json({
                    message: "Card is already assigned to another student",
                });
            }

            // Assign card to student - Update BOTH tables and handle unlinking
            const result = await prisma.$transaction(async (tx) => {
                // 1. Unlink this student from ANY other card first (to maintain uniqueness)
                await tx.cards.updateMany({
                    where: { studentId: student.id, NOT: { identifier: identifier } },
                    data: { studentId: null }
                });

                // 2. Clear any other student from THIS card (though we checked this above, it's safer)
                // 3. Link this card to the student
                const updatedCard = await tx.cards.update({
                    where: { identifier },
                    data: { studentId: student.id },
                });

                // 4. Update the Student record's card_uid
                await tx.student.update({
                    where: { id: student.id },
                    data: { cardUid: identifier }
                });
                return updatedCard;
            });

            // Re-fetch to include relation for response
            const finalCard = await prisma.cards.findUnique({
                where: { identifier },
                include: {
                    student: {
                        select: {
                            id: true,
                            full_name: true,
                            admissionNumber: true,
                            grade_level: true,
                        },
                    },
                },
            });

            return res.json({
                message: "Card assigned successfully",
                data: finalCard,
            });
        } catch (error) {
            console.error("Error assigning card:", error);
            return res.status(500).json({
                message: "Internal server error",
            });
        }
    },
);

/**
 * @route POST /api/iot/student/register
 * @desc Register a new student and optionally assign a card in one transaction
 */
iot.post(
    "/student/register",
    async (req: Request, res: Response) => {
        try {
            const {
                admission_number,
                full_name,
                grade_level,
                card_identifier, // optional
            } = req.body;

            // Validate required fields
            if (!admission_number || !full_name || !grade_level) {
                return res.status(400).json({
                    message: "admission_number, full_name, and grade_level are required",
                });
            }

            // Check if student with same admission number already exists
            const existingStudent = await prisma.student.findUnique({
                where: { admissionNumber: admission_number },
            });

            if (existingStudent) {
                return res.status(409).json({
                    message: "Student with this admission number already exists",
                });
            }

            // If card identifier is provided, check if it exists and is not assigned
            if (card_identifier) {
                const card = await prisma.cards.findUnique({
                    where: { identifier: card_identifier },
                });

                if (!card) {
                    return res.status(404).json({
                        message: "Card not found. Please register the card first.",
                    });
                }

                if (card.studentId) {
                    return res.status(409).json({
                        message: "Card is already assigned to another student",
                    });
                }
            }

            // Create student and optionally assign card in a transaction
            const result = await prisma.$transaction(async (tx) => {
                // Create the student
                const newStudent = await tx.student.create({
                    data: {
                        admissionNumber: admission_number,
                        full_name,
                        grade_level,
                        walletBalance: 0.0, // initialize with zero balance
                        cardUid: card_identifier || null,
                    },
                });

                // If card identifier provided, assign it in the Cards table
                if (card_identifier) {
                    await tx.cards.update({
                        where: { identifier: card_identifier },
                        data: { studentId: newStudent.id },
                    });
                }

                // Return student with card info if applicable
                return tx.student.findUnique({
                    where: { id: newStudent.id },
                    include: {
                        cards: true
                    },
                });
            });

            return res.status(201).json({
                message: "Student registered successfully",
                data: result,
            });
        } catch (error) {
            console.error("Error registering student:", error);
            return res.status(500).json({
                message: "Internal server error",
            });
        }
    },
);

export default iot;