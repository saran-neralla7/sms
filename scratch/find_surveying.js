const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subject.findMany({
        where: {
            OR: [
                { code: { contains: 'SURVEYING', mode: 'insensitive' } },
                { name: { contains: 'Surveying', mode: 'insensitive' } }
            ]
        }
    });

    console.log("Found Surveying subjects:");
    subjects.forEach(s => {
        console.log(`- ID: ${s.id}, Code: ${s.code}, Name: ${s.name}, DeptId: ${s.departmentId}, RegId: ${s.regulationId}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
