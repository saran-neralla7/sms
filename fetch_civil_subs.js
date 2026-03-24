const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subject.findMany({
        where: { department: { name: { contains: 'Civil' } }, semester: '2' },
        select: { id: true, name: true, code: true }
    });
    console.log(JSON.stringify(subjects, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
