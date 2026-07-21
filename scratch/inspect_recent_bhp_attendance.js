const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bhpUserId = "c4985b43-92e8-49d4-994d-9febe305491b";
    
    // Find all attendance records created by BHP
    const records = await prisma.attendanceHistory.findMany({
        where: {
            downloadedBy: bhpUserId
        },
        include: {
            subject: true,
            section: true,
            period: true
        },
        orderBy: {
            date: 'desc'
        }
    });

    console.log(`Found ${records.length} records created by BHP:`);
    records.forEach(r => {
        const detailsObj = JSON.parse(r.details || "[]");
        console.log(`\nID: ${r.id}`);
        console.log(`Date: ${r.date.toISOString().split('T')[0]}`);
        console.log(`Subject: ${r.subject?.name} (${r.subject?.code})`);
        console.log(`Section: ${r.section?.name}`);
        console.log(`Period: ${r.period?.name || 'Null'} (${r.period?.startTime || ''} - ${r.period?.endTime || ''})`);
        console.log(`Student Count: ${detailsObj.length}`);
        console.log(`Topics Taught: ${r.topicsTaught}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
