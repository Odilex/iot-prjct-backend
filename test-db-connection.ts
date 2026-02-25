import 'dotenv/config';
import prisma from './src/config/database';

async function testConnection() {
    console.log('--- Database Connection Test ---');
    console.log('Using DATABASE_URL from .env...');

    try {
        // Attempt a simple query
        console.log('Sending test query to database...');
        const startTime = Date.now();

        // We'll use a raw query to check connectivity without relying on specific models
        const result = await prisma.$queryRaw`SELECT 1 as connected`;

        const duration = Date.now() - startTime;
        console.log('✅ Connection Successful!');
        console.log(`Response received in ${duration}ms`);
        console.log('Result:', result);

        // Now try to count students just to verify models are working
        try {
            const studentCount = await prisma.student.count();
            console.log(`✅ Model Verification: Found ${studentCount} students in the database.`);
        } catch (modelError: any) {
            console.log('⚠️ Raw connection works, but model query failed. This might mean the tables are not created yet.');
            console.log('Error details:', modelError.message);
        }

    } catch (error: any) {
        console.error('❌ Connection Failed!');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);

        if (error.message.includes('Can\'t reach database server')) {
            console.log('\n💡 Tip: Your network might be blocking the connection or Supabase is using IPv6 which your network doesn\'t support well.');
        }
    } finally {
        await prisma.$disconnect();
        console.log('--------------------------------');
        process.exit();
    }
}

testConnection();
