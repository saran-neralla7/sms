const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("=== Academic Years ===");
    const years = await prisma.academicYear.findMany({
        orderBy: { name: 'desc' }
    });
    console.log(years.map(y => ({ id: y.id, name: y.name, startDate: y.startDate, endDate: y.endDate, isCurrent: y.isCurrent })));

    console.log("\n=== Batches ===");
    const batches = await prisma.batch.findMany({
        orderBy: { name: 'desc' }
    });
    console.log(batches.map(b => ({ id: b.id, name: b.name, startYear: b.startYear, endYear: b.endYear })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
