
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Starting domain mail update...');

    const students = await prisma.student.findMany({
        where: {
            OR: [
                { domainMailId: null },
                { domainMailId: "" }
            ]
        }
    });

    console.log(`Found ${students.length} students needing domain mail update.`);

    let updatedCount = 0;

    for (const student of students) {
        if (student.rollNumber) {
            const domainMailId = `${student.rollNumber.toUpperCase()}@gvpcdpgc.edu.in`;

            await prisma.student.update({
                where: { id: student.id },
                data: { domainMailId }
            });

            updatedCount++;
            if (updatedCount % 50 === 0) {
                console.log(`Updated ${updatedCount} students...`);
            }
        }
    }

    console.log(`Finished! Updated ${updatedCount} students.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
