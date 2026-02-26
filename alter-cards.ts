
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL
    });

    try {
        const client = await pool.connect();

        console.log('Altering cards table: making student_id nullable...');
        await client.query(`
            ALTER TABLE public.cards ALTER COLUMN student_id DROP NOT NULL;
        `);
        console.log('SUCCESS: student_id is now nullable.');

        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
