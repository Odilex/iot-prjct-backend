
import 'dotenv/config';
import prisma from './src/config/database';

async function checkStaff() {
    try {
        const staff = await prisma.staff.findMany();
        console.log('--- Staff Members ---');
        staff.forEach(s => {
            console.log(`Name: ${s.full_name}, Email: ${s.email}, Role: ${s.role}, UserID: ${s.userId}`);
        });
    } catch (error) {
        console.error('Error fetching staff:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkStaff();
