import 'dotenv/config';
import prisma from './src/config/database';

async function fixData() {
    try {
        console.log('Ensuring parents exist...');

        // Parent 1 (Existing)
        const p1 = await prisma.parent.upsert({
            where: { phone_number: '0788357288' },
            update: {},
            create: {
                id: '5b448734-1d9e-4717-9a86-ae2856f75f5b',
                full_name: 'Nshimiyimana Claud',
                phone_number: '0788357288',
                email: 'murenzidan1@gmail.com',
                status: 'active'
            }
        });
        console.log('Parent 1 ready:', p1.full_name);

        // Parent 2 (The one they are trying)
        const p2 = await prisma.parent.upsert({
            where: { phone_number: '0788213456' },
            update: {},
            create: {
                full_name: 'Exhibition Parent',
                phone_number: '0788213456',
                email: 'parent2@example.com',
                status: 'active'
            }
        });
        console.log('Parent 2 ready:', p2.full_name);

        // Students
        const s1 = '228137d5-bd30-40de-92cf-70714f82e26b'; // Debug Student
        const s2 = 'e0b3e546-8fb5-4006-88a5-d0e97cc29e66'; // mugabo

        console.log('Linking students to parents...');

        // Link all to Parent 2
        await prisma.parentStudentMap.upsert({
            where: { parentId_studentId: { parentId: p2.id, studentId: s1 } },
            update: {},
            create: { parentId: p2.id, studentId: s1, relationship: 'Parent' }
        });
        await prisma.parentStudentMap.upsert({
            where: { parentId_studentId: { parentId: p2.id, studentId: s2 } },
            update: {},
            create: { parentId: p2.id, studentId: s2, relationship: 'Parent' }
        });

        // Link all to Parent 1
        await prisma.parentStudentMap.upsert({
            where: { parentId_studentId: { parentId: p1.id, studentId: s1 } },
            update: {},
            create: { parentId: p1.id, studentId: s1, relationship: 'Parent' }
        });
        await prisma.parentStudentMap.upsert({
            where: { parentId_studentId: { parentId: p1.id, studentId: s2 } },
            update: {},
            create: { parentId: p1.id, studentId: s2, relationship: 'Parent' }
        });

        console.log('Data fix complete! Both parents can now log in and see both students.');

    } catch (error) {
        console.error('Error fixing data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixData();
