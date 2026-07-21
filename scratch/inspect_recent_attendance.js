const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking AttendanceHistory records created or modified today...");
    
    // Find all attendance records created since 2026-07-21T00:00:00Z
    const today = new Date('2026-07-21T00:00:00Z');
    const records = await prisma.attendanceHistory.findMany({
        where: {
            createdAt: { gte: today }
        },
        include: {
            subject: true,
            section: true
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${records.length} records created today:`);
    records.forEach(r => {
        const detailsObj = JSON.parse(r.details || "[]");
        console.log(`\nID: ${r.id}`);
        console.log(`Created At: ${r.createdAt}`);
        console.log(`Date: ${r.date}`);
        console.log(`Subject: ${r.subject?.name} (${r.subject?.code})`);
        console.log(`Section: ${r.section?.name}`);
        console.log(`Year: ${r.year}, Sem: ${r.semester}`);
        console.log(`Period ID: ${r.periodId}`);
        console.log(`Student Count in Details: ${detailsObj.length}`);
        console.log(`Downloaded By (User ID): ${r.downloadedBy}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
