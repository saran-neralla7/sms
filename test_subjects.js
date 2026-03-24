const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subject.findMany({
        where: { name: { contains: 'Data Structures', mode: 'insensitive' } },
        include: { department: true }
    });
    console.log(JSON.stringify(subjects, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
