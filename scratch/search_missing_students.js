const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const s1 = await prisma.student.findMany({
        where: { rollNumber: { contains: '1116' } }
    });
    const s2 = await prisma.student.findMany({
        where: { rollNumber: { contains: '1039' } }
    });

    console.log("Students matching '1116':");
    s1.forEach(s => console.log(`- Roll: ${s.rollNumber}, Name: ${s.name}`));

    console.log("Students matching '1039':");
    s2.forEach(s => console.log(`- Roll: ${s.rollNumber}, Name: ${s.name}`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
