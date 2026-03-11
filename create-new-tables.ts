import 'dotenv/config';
import prisma from './src/config/database';

async function createTables() {
    console.log('--- Creating Dynamic Subject Tables ---');

    try {
        // 1. Create SchoolSection Enum (if not exists)
        // In Postgres, we check if it exists first
        console.log('Checking for SchoolSection enum...');
        const enumExists = await prisma.$queryRaw`SELECT 1 FROM pg_type WHERE typname = 'SchoolSection'`;
        if (!(enumExists as any[]).length) {
            console.log('Creating SchoolSection enum...');
            await prisma.$executeRawUnsafe(`CREATE TYPE "public"."SchoolSection" AS ENUM ('NURSERY', 'PRIMARY', 'SECONDARY_O_LEVEL', 'SECONDARY_A_LEVEL', 'TVET')`);
        } else {
            console.log('SchoolSection enum already exists.');
        }

        // 2. Create Subject Table
        console.log('Creating Subjects table...');
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."subjects" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "name" TEXT NOT NULL,
        "code" TEXT,
        "section" "public"."SchoolSection" NOT NULL,
        "gradeLevel" TEXT,
        "stream" TEXT,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
      )
    `);

        // 3. Create StudentMark Table
        console.log('Creating StudentMark table...');
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."student_marks" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "student_id" UUID NOT NULL,
        "subject_id" UUID NOT NULL,
        "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
        "term" TEXT NOT NULL,
        "year" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "student_marks_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "student_marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "student_marks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

        console.log('✅ Tables created successfully!');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

createTables();
