import 'dotenv/config';
import prisma from './src/config/database';

async function checkKevin() {
    try {
        const student = await prisma.student.findFirst({
            where: {
                full_name: {
                    contains: 'Kevin',
                    mode: 'insensitive'
                }
            },
            include: {
                studentMarks: {
                    include: {
                        subject: true
                    }
                }
            }
        });

        if (!student) {
            console.log('Student "Kevin" not found.');
            return;
        }

        console.log('--- Student Found ---');
        console.log('Name:', student.full_name);
        console.log('ID:', student.id);
        console.log('Grade:', student.grade_level);
        console.log('Total Mark Records:', student.studentMarks.length);
        console.log('---------------------');

        if (student.studentMarks.length > 0) {
            student.studentMarks.forEach(m => {
                console.log(`- ${m.subject.name}: ${m.score}/${m.maxScore} (Term: ${m.term})`);
            });
        } else {
            console.log('No marks assigned to this student.');
        }

    } catch (error) {
        console.error('Error checking Kevin:', error);
    } finally {
        await prisma.$disconnect();
        process.exit();
    }
}

checkKevin();
