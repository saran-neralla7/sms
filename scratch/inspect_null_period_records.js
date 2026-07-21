const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find the record on 2026-07-20 with periodId: null for CSE A Year 2
    const cseDept = await prisma.department.findFirst({ where: { code: 'CSE' } });
    const secA = await prisma.section.findFirst({ where: { name: 'A' } });

    const records = await prisma.attendanceHistory.findMany({
        where: {
            date: new Date('2026-07-20T00:00:00Z'),
            sectionId: secA.id,
            departmentId: cseDept.id,
            year: '2',
            periodId: null
        },
        include: {
            user: true
        }
    });

    console.log(`Found ${records.length} records:`);
    records.forEach(r => {
        console.log(`ID: ${r.id}`);
        console.log(`Created by: ${r.user.username} (${r.user.role})`);
        console.log(`Subject ID: ${r.subjectId}`);
        console.log(`Details length: ${JSON.parse(r.details || '[]').length}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
