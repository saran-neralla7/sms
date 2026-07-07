const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subject.findMany({
        where: {
            OR: [
                { name: { contains: "Civil", mode: "insensitive" } },
                { name: { contains: "Open Elective", mode: "insensitive" } },
                { code: { contains: "ICE", mode: "insensitive" } }
            ]
        }
    });

    console.log("Subjects found:");
    console.log(subjects.map(s => ({ id: s.id, code: s.code, name: s.name, deptId: s.departmentId })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
