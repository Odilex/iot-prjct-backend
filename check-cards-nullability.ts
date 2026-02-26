
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
    const pool = new Pool({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL
    });

    try {
        const client = await pool.connect();

        console.log('--- Table: cards ---');
        const res = await client.query(`
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'cards' AND table_schema = 'public'
        `);
        console.table(res.rows);

        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
