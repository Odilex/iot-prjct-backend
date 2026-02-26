import { Client } from 'pg';
import 'dotenv/config';

async function fixSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Adding "identifier" column to "cards" table...');

        // We add it as nullable first in case there are records, then we can decide if we want to make it not null
        await client.query(`
      ALTER TABLE "public"."cards" 
      ADD COLUMN IF NOT EXISTS "identifier" TEXT;
    `);

        console.log('Adding unique constraint to "identifier"...');
        await client.query(`
      ALTER TABLE "public"."cards" 
      ADD CONSTRAINT "cards_identifier_key" UNIQUE ("identifier");
    `);

        console.log('Successfully updated "cards" table.');

    } catch (err: any) {
        if (err.code === '42701') {
            console.log('Column "identifier" already exists.');
        } else if (err.code === '42710') {
            console.log('Constraint already exists.');
        } else {
            console.error('Error:', err.message);
        }
    } finally {
        await client.end();
    }
}

fixSchema();
