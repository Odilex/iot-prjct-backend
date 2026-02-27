import 'dotenv/config';
import prisma from './src/config/database';

async function listParents() {
    try {
        const parents = await prisma.parent.findMany({
            include: {
                parentStudentMaps: {
                    include: {
                        student: true
                    }
                }
            }
        });
        console.log(JSON.stringify(parents, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

listParents();
