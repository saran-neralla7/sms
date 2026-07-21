const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Look up attendance records on July 21, 2026
    const records = await prisma.attendanceHistory.findMany({
        where: {
            date: {
                gte: new Date('2026-07-20T00:00:00Z'),
                lte: new Date('2026-07-22T23:59:59Z')
            }
        },
        include: {
            subject: true,
            section: true,
            department: true
        }
    });

    console.log(`Found ${records.length} records between July 20 and July 22:`);
    records.forEach(r => {
        console.log(`- Date: ${r.date.toISOString().split('T')[0]}, Subject: ${r.subject?.code || 'None'}, Section: ${r.section.name}, Department: ${r.department.code}, Period ID: ${r.periodId}, Year: ${r.year}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
