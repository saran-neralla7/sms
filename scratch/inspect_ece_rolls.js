const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    const batch = await prisma.batch.findFirst({
        where: { name: '2024-2028' }
    });

    const students = await prisma.student.findMany({
        where: {
            batchId: batch?.id,
            departmentId: eceDept?.id
        },
        orderBy: { rollNumber: 'asc' }
    });

    console.log(`Total students: ${students.length}`);
    students.forEach((s, idx) => {
        console.log(`${idx + 1}. Roll: ${s.rollNumber}, Name: ${s.name}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
