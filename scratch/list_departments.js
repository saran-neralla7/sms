const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const depts = await prisma.department.findMany();
    console.log("Departments in DB:");
    depts.forEach(d => {
        console.log(`- Code: ${d.code}, Name: ${d.name}, ID: ${d.id}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
