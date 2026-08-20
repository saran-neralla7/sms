const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Searching for students with roll number containing 1043 or 5231421043...");

    const students = await prisma.student.findMany({
        where: {
            OR: [
                { rollNumber: { contains: "1043" } },
                { rollNumber: { contains: "21043" } },
                { rollNumber: { contains: "421043" } }
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

    console.log(`Found ${students.length} matching students:`);
    students.forEach(student => {
        console.log(`\n--- Student Profile ---`);
        console.log(`Name: ${student.name}`);
        console.log(`Roll Number: ${student.rollNumber}`);
        console.log(`Department: ${student.department?.name} (${student.department?.code})`);
        console.log(`Year: ${student.year} | Semester: ${student.semester}`);
        console.log(`Section: ${student.section?.name}`);

        console.log(`Enrolled Subjects (${student.subjects.length}):`);
        student.subjects.forEach(sub => {
            console.log(`  - Code: ${sub.code} | Name: ${sub.name} | Slot: ${sub.electiveSlotRelation?.name || 'N/A'}`);
        });
    });

    if (students.length === 0) {
        console.log("\nListing ECE 3rd Year 1st Sem students with roll numbers starting with 523...");
        const eceStudents = await prisma.student.findMany({
            where: {
                year: "3",
                semester: "1",
                department: { code: { contains: "ECE", mode: "insensitive" } }
            },
            select: { rollNumber: true, name: true }
        });
        console.log(`Total ECE 3rd Yr 1st Sem students: ${eceStudents.length}`);
        console.log("Sample roll numbers:", eceStudents.slice(0, 15).map(s => `${s.rollNumber} (${s.name})`));
    }

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
