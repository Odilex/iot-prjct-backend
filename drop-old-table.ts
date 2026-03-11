import 'dotenv/config';
import prisma from './src/config/database';

async function dropOldTable() {
    console.log('--- Dropping Legacy Table ---');
    try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."marks" CASCADE`);
        console.log('✅ Success! Legacy "marks" table has been removed.');
    } catch (error) {
        console.error('❌ Error dropping table:', error);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

dropOldTable();
