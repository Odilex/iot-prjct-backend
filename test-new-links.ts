import { Client } from 'pg';

async function testConnection(name, url) {
    console.log(`Testing ${name}...`);
    const client = new Client({
        connectionString: url,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT 1 as connected');
        console.log(`✅ ${name} SUCCESS:`, res.rows[0]);
    } catch (err) {
        console.log(`❌ ${name} FAILED:`, err.message);
    } finally {
        await client.end();
    }
    console.log('-------------------');
}

const password = 'schooltechinfra';
const poolerUrl = `postgresql://postgres.gsbwhhchtzvdxxwnknji:${password}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`;
const directUrl = `postgresql://postgres.gsbwhhchtzvdxxwnknji:${password}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`;

async function run() {
    await testConnection('Pooler (Port 6543)', poolerUrl);
    await testConnection('Direct (Port 5432)', directUrl);
    process.exit();
}

run();
