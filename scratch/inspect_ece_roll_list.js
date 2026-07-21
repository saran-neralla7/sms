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
            batchId: batch.id,
            departmentId: eceDept.id
        },
        orderBy: { rollNumber: 'asc' }
    });

    students.forEach((s, idx) => {
        const suffixStr = s.rollNumber.substring(s.rollNumber.length - 3);
        const suffix = parseInt(suffixStr);
        console.log(`${idx + 1}. Roll: ${s.rollNumber}, Name: ${s.name}, Suffix: ${suffixStr} (${suffix})`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
