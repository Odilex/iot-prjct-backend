import { Client } from 'pg';
import 'dotenv/config';

async function fixAttendance() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Adding "term" column to "attendance" table...');
        await client.query(`
      ALTER TABLE "public"."attendance" 
      ADD COLUMN IF NOT EXISTS "term" TEXT;
    `);

        console.log('Successfully updated "attendance" table.');

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

fixAttendance();
