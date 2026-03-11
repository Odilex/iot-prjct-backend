import 'dotenv/config';
import prisma from './src/config/database';

async function checkTables() {
    try {
        const subjects = await prisma.$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_name = 'subjects' AND table_schema = 'public'`;
        const marks = await prisma.$queryRaw`SELECT 1 FROM information_schema.tables WHERE table_name = 'student_marks' AND table_schema = 'public'`;

        console.log('--- Table Status ---');
        console.log('Table "subjects":', (subjects as any[]).length > 0 ? 'exists' : 'does NOT exist');
        console.log('Table "student_marks":', (marks as any[]).length > 0 ? 'exists' : 'does NOT exist');
    } catch (error) {
        console.error('Error checking tables:', error);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

checkTables();
