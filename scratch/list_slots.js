const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const slots = await prisma.electiveSlot.findMany();
    console.log("Elective Slots in DB:");
    slots.forEach(s => {
        console.log(`- ID: ${s.id}, Name: ${s.name}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
