const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cseDept = await prisma.department.findFirst({
        where: { code: 'CSE' }
    });
    
    // Find Section A and Section B
    const secA = await prisma.section.findFirst({ where: { name: 'A' } });
    const secB = await prisma.section.findFirst({ where: { name: 'B' } });

    console.log("CSE Department ID:", cseDept.id);
    console.log("Section A ID:", secA.id);
    console.log("Section B ID:", secB.id);

    // Count students in Section A (Year 2, Sem 1)
    const countA = await prisma.student.count({
        where: {
            departmentId: cseDept.id,
            sectionId: secA.id,
            year: '2',
            semester: '1',
            isAlumni: false,
            isLeftCollege: false,
            isDetained: false
        }
    });

    const countB = await prisma.student.count({
        where: {
            departmentId: cseDept.id,
            sectionId: secB.id,
            year: '2',
            semester: '1',
            isAlumni: false,
            isLeftCollege: false,
            isDetained: false
        }
    });

    console.log(`Active students in CSE Year 2 Sem 1 Section A: ${countA}`);
    console.log(`Active students in CSE Year 2 Sem 1 Section B: ${countB}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
