import 'dotenv/config';
import prisma from './src/config/database';
import { SchoolSection } from '@prisma/client';

async function migrateData() {
    console.log('--- Starting Data Migration ---');

    try {
        // 1. Get all legacy marks
        const legacyMarks = await prisma.mark.findMany({
            include: { student: true }
        });

        console.log(`Found ${legacyMarks.length} legacy records to migrate.`);

        // 2. Define standard subjects we need to ensure exist for migration
        const standardSubjects = ['Mathematics', 'English', 'Science', 'History'];

        for (const m of legacyMarks) {
            // Determine section based on grade string
            let section: SchoolSection = SchoolSection.PRIMARY;
            if (m.grade.startsWith('Senior')) section = SchoolSection.SECONDARY_O_LEVEL;
            if (['S4', 'S5', 'S6'].some(s => m.grade.includes(s))) section = SchoolSection.SECONDARY_A_LEVEL;

            // Map the 4 subjects
            const subjectScores = [
                { name: 'Mathematics', score: m.math },
                { name: 'English', score: m.english },
                { name: 'Science', score: m.science },
                { name: 'History', score: m.history }
            ];

            for (const ss of subjectScores) {
                // Find or create the subject for this specific grade/section
                let subject = await prisma.subject.findFirst({
                    where: {
                        name: ss.name,
                        gradeLevel: m.grade,
                        section: section
                    }
                });

                if (!subject) {
                    subject = await prisma.subject.create({
                        data: {
                            name: ss.name,
                            section: section,
                            gradeLevel: m.grade,
                        }
                    });
                }

                // Create the new mark
                await prisma.studentMark.create({
                    data: {
                        studentId: m.studentId,
                        subjectId: subject.id,
                        score: ss.score,
                        term: m.term,
                        year: '2025', // Defaulting to current year
                        type: 'exam'
                    }
                });
            }
            process.stdout.write('.');
        }

        console.log('\n✅ Migration complete!');
    } catch (error) {
        console.error('\n❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

migrateData();
