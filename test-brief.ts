import 'dotenv/config';
import prisma from './src/config/database';

async function testConnection() {
    try {
        const result = await prisma.$queryRaw`SELECT 1 as connected`;
        console.log('SUCCESS');
    } catch (error: any) {
        console.log('ERROR_CODE:', error.code);
        console.log('ERROR_MESSAGE:', error.message);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

testConnection();
