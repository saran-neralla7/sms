const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const ays = await prisma.academicYear.findMany({
        orderBy: { startDate: "asc" }
    });
    console.log("Academic Years in DB:");
    console.log(JSON.stringify(ays, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
