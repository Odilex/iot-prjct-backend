import 'dotenv/config';
import prisma from './src/config/database';

async function prepareExhibition() {
    console.log('--- BOOSTING EXHIBITION DATA ---');

    const students = [
        { id: '228137d5-bd30-40de-92cf-70714f82e26b', name: 'Debug Student' },
        { id: 'e0b3e546-8fb5-4006-88a5-d0e97cc29e66', name: 'mugabo' }
    ];

    for (const student of students) {
        console.log(`Processing ${student.name}...`);

        // 1. Attendance (Rwandan dates)
        await prisma.attendance.deleteMany({ where: { studentId: student.id } });
        const dates = [
            '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
            '2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27'
        ];
        for (const dateStr of dates) {
            const isLate = Math.random() > 0.8;
            const hour = isLate ? 8 : 7;
            const minute = Math.floor(Math.random() * 30) + (isLate ? 15 : 30);

            await prisma.attendance.create({
                data: {
                    studentId: student.id,
                    checkType: 'IN',
                    deviceId: 'GATE-01',
                    term: 'Term 1',
                    createdAt: new Date(`${dateStr}T0${hour}:${minute}:00Z`)
                }
            });
        }

        // 2. Marks (Rwandan Curriculum)
        await prisma.mark.deleteMany({ where: { studentId: student.id } });
        const terms = ['Term 1', 'Term 2', 'Term 3'];
        for (const term of terms) {
            const math = 75 + Math.random() * 20;
            const english = 80 + Math.random() * 15;
            const science = 70 + Math.random() * 25;
            const history = 65 + Math.random() * 30;
            const avg = (math + english + science + history) / 4;

            await prisma.mark.create({
                data: {
                    studentId: student.id,
                    grade: 'Senior 4',
                    term,
                    math,
                    english,
                    science,
                    history,
                    average: avg
                }
            });
        }

        // 3. Fees
        await prisma.fee.deleteMany({ where: { studentId: student.id } });
        await prisma.fee.create({
            data: {
                studentId: student.id,
                class: 'Senior 4',
                term: 'Term 1 2026',
                amount: 150000,
                paid: 120000,
                balance: 30000,
                status: 'partial',
                payments: [
                    { date: '2026-01-05', amount: 50000, method: 'Bank Transfer' },
                    { date: '2026-01-20', amount: 70000, method: 'Momo' }
                ]
            }
        });

        // 4. Wallet & Basic Info
        await prisma.student.update({
            where: { id: student.id },
            data: {
                walletBalance: 45000.50,
                grade_level: 'Senior 4',
                stream: 'PCM',
                dob: '2008-05-12',
                gender: 'Male',
                address: 'Kigali, Gasabo, Kacyiru'
            }
        });
    }

    // 5. Assign some cards if available
    console.log('Clearing old card assignments for these students...');
    await prisma.cards.updateMany({
        where: { studentId: { in: students.map(s => s.id) } },
        data: { studentId: null }
    });

    // Clear cardUid in Student table for these students to avoid collision
    for (const s of students) {
        await prisma.student.update({
            where: { id: s.id },
            data: { cardUid: null }
        });
    }

    const unusedCards = await prisma.cards.findMany({ where: { studentId: null } });
    if (unusedCards.length >= 2) {
        console.log(`Assigning cards ${unusedCards[0].identifier} and ${unusedCards[1].identifier}...`);

        await prisma.cards.update({
            where: { id: unusedCards[0].id },
            data: { studentId: students[0].id }
        });
        await prisma.student.update({
            where: { id: students[0].id },
            data: { cardUid: unusedCards[0].identifier }
        });

        await prisma.cards.update({
            where: { id: unusedCards[1].id },
            data: { studentId: students[1].id }
        });
        await prisma.student.update({
            where: { id: students[1].id },
            data: { cardUid: unusedCards[1].identifier }
        });
    }

    console.log('--- EXHIBITION DATA BOOSTED SUCCESSFULLY ---');
}

prepareExhibition()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
