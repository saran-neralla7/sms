const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cseDept = await prisma.department.findFirst({
        where: { code: 'CSE' }
    });
    const batch = await prisma.batch.findFirst({
        where: { name: '2024-2028' }
    });

    const students = await prisma.student.findMany({
        where: {
            batchId: batch?.id,
            departmentId: cseDept?.id
        },
        include: { section: true },
        orderBy: { rollNumber: 'asc' }
    });

    console.log(`Total CSE Batch 2024-2028 students: ${students.length}`);
    const sectionCounts = {};
    students.forEach(s => {
        const secName = s.section?.name || 'None';
        sectionCounts[secName] = (sectionCounts[secName] || 0) + 1;
    });
    console.log("Section counts:", sectionCounts);

    // Let's print the boundary rolls for each section
    let currentSec = null;
    students.forEach((s, idx) => {
        const secName = s.section?.name || 'None';
        if (secName !== currentSec) {
            console.log(`Roll ${s.rollNumber} starts section ${secName}`);
            currentSec = secName;
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
