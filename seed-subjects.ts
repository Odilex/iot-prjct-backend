import 'dotenv/config';
import prisma from './src/config/database';
import { SchoolSection } from '@prisma/client';

async function seedSubjects() {
    console.log('--- Seeding Subjects ---');

    const subjects = [
        // Nursery
        { name: 'Français', section: SchoolSection.NURSERY, gradeLevel: 'N1' },
        { name: 'English', section: SchoolSection.NURSERY, gradeLevel: 'N2' },
        { name: 'Early Brain Development', section: SchoolSection.NURSERY, gradeLevel: 'N1' },

        // Primary (Francophone)
        { name: 'Kinyarwanda', section: SchoolSection.PRIMARY, gradeLevel: 'P1', stream: 'Francophone' },
        { name: 'Français', section: SchoolSection.PRIMARY, gradeLevel: 'P1', stream: 'Francophone' },
        { name: 'Mathematics', section: SchoolSection.PRIMARY, gradeLevel: 'P1', stream: 'Francophone' },

        // Primary (Anglophone)
        { name: 'Mathematics', section: SchoolSection.PRIMARY, gradeLevel: 'P1', stream: 'Anglophone' },
        { name: 'English', section: SchoolSection.PRIMARY, gradeLevel: 'P1', stream: 'Anglophone' },

        // Secondary O-Level
        { name: 'Mathematics', section: SchoolSection.SECONDARY_O_LEVEL, gradeLevel: 'S1' },
        { name: 'Physics', section: SchoolSection.SECONDARY_O_LEVEL, gradeLevel: 'S1' },
        { name: 'Chemistry', section: SchoolSection.SECONDARY_O_LEVEL, gradeLevel: 'S1' },
        { name: 'Biology', section: SchoolSection.SECONDARY_O_LEVEL, gradeLevel: 'S1' },
        { name: 'ICT', section: SchoolSection.SECONDARY_O_LEVEL, gradeLevel: 'S1' },

        // Secondary A-Level (MPC)
        { name: 'Mathematics', section: SchoolSection.SECONDARY_A_LEVEL, gradeLevel: 'S4', stream: 'MPC' },
        { name: 'Physics', section: SchoolSection.SECONDARY_A_LEVEL, gradeLevel: 'S4', stream: 'MPC' },
        { name: 'Computer Science', section: SchoolSection.SECONDARY_A_LEVEL, gradeLevel: 'S4', stream: 'MPC' },

        // TVET
        { name: 'Tourism Skills', section: SchoolSection.TVET, gradeLevel: 'Level 3' },
        { name: 'Technical Drawing', section: SchoolSection.TVET, gradeLevel: 'Level 3' },
    ];

    for (const s of subjects) {
        await prisma.subject.upsert({
            where: {
                // We'll use a combined search since we don't have a unique constraint on these fields yet
                // but for seeding we can just findFirst
                id: '00000000-0000-0000-0000-000000000000' // dummy
            },
            update: {},
            create: s,
        }).catch(async (e) => {
            // Fallback since upsert needs a unique where
            const existing = await prisma.subject.findFirst({
                where: { name: s.name, section: s.section, gradeLevel: s.gradeLevel, stream: s.stream }
            });
            if (!existing) {
                await prisma.subject.create({ data: s });
                console.log(`✅ Created: ${s.name} (${s.section})`);
            } else {
                console.log(`⏭️ exists: ${s.name} (${s.section})`);
            }
        });
    }

    console.log('--- Seeding Done ---');
    process.exit();
}

seedSubjects();
