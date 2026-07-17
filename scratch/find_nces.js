const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const subjects = await prisma.subject.findMany({
        where: {
            name: {
                contains: "Non Conventional"
            }
        },
        select: {
            id: true,
            name: true,
            code: true,
            departmentId: true
        }
    });
    console.log("NCES subjects:", JSON.stringify(subjects, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
