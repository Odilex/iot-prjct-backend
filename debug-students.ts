import 'dotenv/config';
import prisma from './src/config/database';

async function listStudents() {
    try {
        const students = await prisma.student.findMany();
        console.log(JSON.stringify(students, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

listStudents();
