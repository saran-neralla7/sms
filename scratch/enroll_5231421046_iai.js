const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const roll43 = '5241421043';
    const roll46 = '5231421046';

    console.log("=== CHECKING PAST ATTENDANCE RECORDS FOR OE-1 ===");

    // Fetch all AttendanceHistory records for Year 3 Sem 1
    const histories = await prisma.attendanceHistory.findMany({
        where: { year: "3", semester: "1" },
        include: { subject: true, section: true }
    });

    let records43 = 0;
    let records46 = 0;

    histories.forEach(h => {
        try {
            const details = JSON.parse(h.details || "[]");
            if (details.some(d => d.rollNumber === roll43)) {
                records43++;
                console.log(`- Roll 5241421043 found in attendance on ${h.date.toISOString().split('T')[0]} | Subject: ${h.subject?.code} (${h.subject?.name})`);
            }
            if (details.some(d => d.rollNumber === roll46)) {
                records46++;
                console.log(`- Roll 5231421046 found in attendance on ${h.date.toISOString().split('T')[0]} | Subject: ${h.subject?.code} (${h.subject?.name})`);
            }
        } catch (e) {}
    });

    console.log(`Total OE-1/Year 3 Sem 1 attendance records found for 5241421043: ${records43}`);
    console.log(`Total OE-1/Year 3 Sem 1 attendance records found for 5231421046: ${records46}`);

    console.log("\n=== ENROLLING 5231421046 INTO IAI (OE-1) ===");

    // 1. Find IAI subject
    const iaiSubject = await prisma.subject.findFirst({
        where: {
            year: "3",
            semester: "1",
            code: "IAI"
        },
        include: { electiveSlotRelation: true }
    });

    if (!iaiSubject) {
        console.error("Subject IAI not found!");
        process.exit(1);
    }

    // 2. Find student 5231421046
    const student = await prisma.student.findUnique({
        where: { rollNumber: roll46 },
        include: { subjects: true }
    });

    if (!student) {
        console.error(`Student ${roll46} not found!`);
        process.exit(1);
    }

    // 3. Connect IAI subject
    const updatedStudent = await prisma.student.update({
        where: { id: student.id },
        data: {
            subjects: {
                connect: [{ id: iaiSubject.id }]
            }
        },
        include: {
            subjects: {
                include: { electiveSlotRelation: true }
            }
        }
    });

    console.log(`\nSuccessfully enrolled ${student.name} (${roll46}) into IAI!`);
    console.log("Enrolled subjects now:");
    updatedStudent.subjects.forEach(s => {
        console.log(` - Code: ${s.code} | Name: ${s.name} | Slot: ${s.electiveSlotRelation?.name || 'N/A'}`);
    });

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
