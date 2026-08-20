const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumber = '5231421043';
    console.log(`Deep search for roll number: ${rollNumber}`);

    const exactMatch = await prisma.student.findUnique({
        where: { rollNumber: rollNumber },
        include: {
            department: true,
            section: true,
            subjects: { include: { electiveSlotRelation: true } }
        }
    });

    if (exactMatch) {
        console.log(`\nExact match found!`);
        console.log(`Name: ${exactMatch.name} | Roll: ${exactMatch.rollNumber} | Dept: ${exactMatch.department?.code} | Yr: ${exactMatch.year} Sem: ${exactMatch.semester} Sec: ${exactMatch.section?.name}`);
        console.log("Subjects:");
        exactMatch.subjects.forEach(s => {
            console.log(` - Code: ${s.code} | Name: ${s.name} | Slot: ${s.electiveSlotRelation?.name || 'N/A'}`);
        });
    } else {
        console.log(`No exact match for ${rollNumber}. Searching all roll numbers containing 1043 in 3rd Year 1st Sem...`);
        const yr3Students = await prisma.student.findMany({
            where: {
                year: "3",
                semester: "1",
                rollNumber: { contains: "1043" }
            },
            include: {
                department: true,
                section: true,
                subjects: { include: { electiveSlotRelation: true } }
            }
        });
        console.log(`Found ${yr3Students.length} 3rd Year 1st Sem students with 1043:`);
        yr3Students.forEach(s => {
            console.log(`- Roll: ${s.rollNumber} | Name: ${s.name} | Dept: ${s.department?.code} | Sec: ${s.section?.name}`);
            s.subjects.forEach(sub => {
                console.log(`   * ${sub.code} (${sub.name}) | Slot: ${sub.electiveSlotRelation?.name}`);
            });
        });
    }

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
