const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find ECE Department
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    console.log("ECE Dept ID:", eceDept?.id);

    // Find Batch 2024-2028
    const batch = await prisma.batch.findFirst({
        where: { name: '2024-2028' }
    });
    console.log("Batch 2024-2028 ID:", batch?.id);

    // Find Section B
    const sectionB = await prisma.section.findFirst({
        where: { name: 'B' }
    });
    console.log("Section B ID:", sectionB?.id);

    // Let's count students who are in Batch 2024-2028, ECE, Year 3, Sem 1
    const studentsInBatch = await prisma.student.findMany({
        where: {
            batchId: batch?.id,
            departmentId: eceDept?.id,
        },
        include: {
            section: true
        }
    });

    console.log(`\nFound ${studentsInBatch.length} students in Batch 2024-2028 ECE total.`);
    
    // Group by year, semester, section
    const groupings = {};
    studentsInBatch.forEach(s => {
        const key = `Year ${s.year} - Sem ${s.semester} - Section ${s.section?.name || 'None'}`;
        groupings[key] = (groupings[key] || 0) + 1;
    });

    console.log("Current student distribution in Batch 2024-2028 ECE:");
    console.log(groupings);

    // Let's also check if there is any attendance history for Section B of ECE Year 3 Sem 1
    const history = await prisma.attendanceHistory.findMany({
        where: {
            departmentId: eceDept?.id,
            sectionId: sectionB?.id,
            year: '3',
            semester: '1'
        }
    });
    console.log(`\nFound ${history.length} attendance history records for ECE Section B (Year 3, Sem 1).`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
