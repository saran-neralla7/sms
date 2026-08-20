const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. REVERT 5241421043 back to BME
    console.log("=== STEP 1: Reverting student 5241421043 back to BME ===");
    const roll4 = '5241421043';
    
    const bmeSubject = await prisma.subject.findFirst({ where: { code: "BME" } });
    const iaiSubject = await prisma.subject.findFirst({ where: { code: "IAI" } });
    const peSubject = await prisma.subject.findFirst({ where: { code: "ECE3103-2" } });

    const student4 = await prisma.student.findUnique({
        where: { rollNumber: roll4 },
        include: { subjects: true }
    });

    if (student4 && bmeSubject && iaiSubject) {
        const updated4 = await prisma.student.update({
            where: { id: student4.id },
            data: {
                subjects: {
                    disconnect: [{ id: iaiSubject.id }],
                    connect: [{ id: bmeSubject.id }]
                }
            },
            include: { subjects: { include: { electiveSlotRelation: true } } }
        });

        console.log(`Successfully reverted ${student4.name} (${roll4})!`);
        console.log("Enrolled subjects now:");
        updated4.subjects.forEach(s => {
            console.log(` - Code: ${s.code} | Name: ${s.name} | Slot: ${s.electiveSlotRelation?.name || 'N/A'}`);
        });
    }

    // 2. SEARCH FOR 5231421043
    console.log("\n=== STEP 2: Searching for student 5231421043 ===");
    const roll3 = '5231421043';
    
    const student3 = await prisma.student.findFirst({
        where: {
            OR: [
                { rollNumber: roll3 },
                { rollNumber: { contains: roll3, mode: 'insensitive' } }
            ]
        },
        include: {
            department: true,
            section: true,
            subjects: {
                include: {
                    department: true,
                    electiveSlotRelation: true
                }
            }
        }
    });

    if (!student3) {
        console.log(`Student with roll number ${roll3} was not found directly.`);
        // Search in Alumni table or inactive students just in case
        const alumni = await prisma.alumni.findFirst({ where: { rollNumber: roll3 } });
        if (alumni) {
            console.log(`Found in Alumni table: ${alumni.name} (${alumni.rollNumber})`);
        } else {
            console.log("Searching for roll numbers starting with 523142...");
            const ece4th = await prisma.student.findMany({
                where: { rollNumber: { startsWith: "523142" } },
                include: { subjects: { include: { electiveSlotRelation: true } } }
            });
            console.log(`Found ${ece4th.length} students in ECE 523142 batch:`);
            ece4th.forEach(s => {
                console.log(`- ${s.rollNumber} (${s.name}) | Year: ${s.year} Sem: ${s.semester} Sec: ${s.section?.name}`);
                s.subjects.forEach(sub => {
                    console.log(`   * ${sub.code} (${sub.name}) | Slot: ${sub.electiveSlotRelation?.name}`);
                });
            });
        }
    } else {
        console.log(`\nStudent Found: ${student3.name} (${student3.rollNumber})`);
        console.log(`Department: ${student3.department?.name} (${student3.department?.code})`);
        console.log(`Year: ${student3.year} | Semester: ${student3.semester} | Section: ${student3.section?.name}`);
        console.log(`Enrolled Subjects (${student3.subjects.length}):`);
        student3.subjects.forEach(sub => {
            console.log(` - Code: ${sub.code} | Name: ${sub.name} | Type: ${sub.type} | Slot: ${sub.electiveSlotRelation?.name || 'N/A'}`);
        });
    }

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
