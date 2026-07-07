const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const student = await prisma.student.findUnique({
        where: { rollNumber: "5241411001" },
        include: {
            regulation: true,
            section: true,
            department: true
        }
    });

    console.log("Student Details in SMS:");
    console.dir(student, { depth: null });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
