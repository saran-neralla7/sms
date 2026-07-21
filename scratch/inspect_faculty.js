const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const f = await prisma.faculty.findUnique({
        where: { id: 'd58ee896-b42f-425e-b1b4-fdec093f2e7f' }
    });
    console.log("Faculty details:", f);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
