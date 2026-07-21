const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking recent audit logs...");
    const logs = await prisma.auditLog.findMany({
        where: {
            OR: [
                { performedBy: { contains: 'BHP', mode: 'insensitive' } },
                { details: { contains: 'BHP', mode: 'insensitive' } },
                { action: { contains: 'attendance', mode: 'insensitive' } },
                { details: { contains: 'fail', mode: 'insensitive' } }
            ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    console.log(`Found ${logs.length} matching audit logs:`);
    logs.forEach(l => {
        console.log(`\nID: ${l.id}`);
        console.log(`Action: ${l.action}`);
        console.log(`Entity: ${l.entity} (${l.entityId})`);
        console.log(`Performed By: ${l.performedBy}`);
        console.log(`Date: ${l.createdAt}`);
        console.log(`Details: ${l.details}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
