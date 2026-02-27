import 'dotenv/config';
import prisma from './src/config/database';

async function healCardSync() {
    console.log('--- STARTING CARD SYNC REHABILITATION ---');

    // Find all cards that are assigned to a student
    const cards = await prisma.cards.findMany({
        where: {
            studentId: { not: null }
        }
    });

    console.log(`Found ${cards.length} assigned cards. Syncing...`);

    for (const card of cards) {
        if (!card.studentId) continue;

        console.log(`Processing Card: ${card.identifier} -> Student: ${card.studentId}`);

        // Update the student record to match the card identifier
        await prisma.student.update({
            where: { id: card.studentId },
            data: { cardUid: card.identifier }
        }).catch(err => {
            console.error(`Failed to sync student ${card.studentId}:`, err.message);
        });
    }

    console.log('--- CARD SYNC COMPLETED ---');
}

healCardSync()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
