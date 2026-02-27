import 'dotenv/config';
import prisma from './src/config/database';

async function checkAttendance() {
    try {
        const s1 = '228137d5-bd30-40de-92cf-70714f82e26b'; // Debug Student
        const s2 = 'e0b3e546-8fb5-4006-88a5-d0e97cc29e66'; // mugabo

        const attendance = await prisma.attendance.findMany({
            where: {
                studentId: { in: [s1, s2] }
            }
        });

        console.log(`Found ${attendance.length} attendance records for students.`);
        if (attendance.length === 0) {
            console.log('Generating dummy attendance for exhibition...');
            const now = new Date();

            await prisma.attendance.create({
                data: { studentId: s1, checkType: 'IN', deviceId: 'IOT-001', createdAt: now, term: 'Term 1' }
            });
            await prisma.attendance.create({
                data: { studentId: s2, checkType: 'IN', deviceId: 'IOT-001', createdAt: now, term: 'Term 1' }
            });
            await prisma.attendance.create({
                data: { studentId: s1, checkType: 'OUT', deviceId: 'IOT-001', createdAt: new Date(now.getTime() + 8 * 60 * 60 * 1000), term: 'Term 1' }
            });

            console.log('Dummy attendance created.');
        } else {
            console.log('Attendance records already exist.');
        }
    } catch (error) {
        console.error('FAILED TO SETUP ATTENDANCE:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkAttendance();
