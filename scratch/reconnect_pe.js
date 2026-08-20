const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumber = '5241421043';

    // 1. Find PE subject ECE3103-2
    const peSubject = await prisma.subject.findFirst({
        where: {
            code: "ECE3103-2"
        }
    });

    if (!peSubject) {
        console.error("PE subject ECE3103-2 not found!");
        process.exit(1);
    }

    // 2. Find student
    const student = await prisma.student.findUnique({
        where: { rollNumber: rollNumber }
    });

    // Connect PE subject back
    const updatedStudent = await prisma.student.update({
        where: { id: student.id },
        data: {
            subjects: {
                connect: [{ id: peSubject.id }]
            }
        },
        include: {
            subjects: {
                include: { electiveSlotRelation: true }
            }
        }
    });

    console.log(`Updated subjects for ${student.name} (${rollNumber}):`);
    updatedStudent.subjects.forEach(s => {
        console.log(` - Code: ${s.code} | Name: ${s.name} | Slot: ${s.electiveSlotRelation?.name || 'N/A'}`);
    });

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
