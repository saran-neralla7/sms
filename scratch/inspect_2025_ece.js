const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    const batch = await prisma.batch.findFirst({
        where: { name: '2025-2029' }
    });

    const students = await prisma.student.findMany({
        where: {
            batchId: batch?.id,
            departmentId: eceDept?.id
        },
        include: { section: true },
        orderBy: { rollNumber: 'asc' }
    });

    console.log(`Total Batch 2025-2029 ECE students: ${students.length}`);
    students.forEach((s, idx) => {
        console.log(`${idx + 1}. Roll: ${s.rollNumber}, Section: ${s.section?.name}, Name: ${s.name}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
