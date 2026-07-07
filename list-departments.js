const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const departments = await prisma.department.findMany();
    console.log("Departments in SMS:");
    console.log(departments.map(d => ({ id: d.id, name: d.name, code: d.code })));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
