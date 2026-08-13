const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumbers = ['5241431006', '5241431007', '5241431014', '5241431050'];
    
    // 1. Fetch subject IAI
    const iaiSubject = await prisma.subject.findFirst({
        where: {
            year: "3",
            semester: "1",
            code: "IAI"
        }
    });

    console.log("IAI Subject:", iaiSubject?.id, iaiSubject?.code, iaiSubject?.name);

    // 2. Fetch students
    const students = await prisma.student.findMany({
        where: { rollNumber: { in: rollNumbers } },
        include: { subjects: true }
    });

    console.log(`Students (${students.length}):`);
    students.forEach(s => {
        console.log(`- ID: ${s.id} | Roll: ${s.rollNumber} | Name: ${s.name} | Current subjects:`, s.subjects.map(sub => sub.code));
    });

    // 3. Search AttendanceHistory for these roll numbers
    const histories = await prisma.attendanceHistory.findMany({
        where: {
            year: "3",
            semester: "1"
        },
        include: {
            subject: true,
            section: true,
            department: true,
            user: { select: { username: true } }
        }
    });

    console.log(`Total AttendanceHistory records for Year 3 Sem 1: ${histories.length}`);

    let matchesCount = 0;
    const affectedHistories = [];

    histories.forEach(h => {
        try {
            const details = JSON.parse(h.details || "[]");
            const matchingStudents = details.filter(d => rollNumbers.includes(d.rollNumber));
            if (matchingStudents.length > 0) {
                matchesCount++;
                console.log(`\nHistory ID: ${h.id}`);
                console.log(`  Date: ${h.date.toISOString().split('T')[0]} | Type: ${h.type} | Dept: ${h.department?.code} | Sec: ${h.section?.name} | Subject: ${h.subject?.code} (${h.subject?.name}) | Posted by: ${h.user?.username}`);
                console.log(`  Matching students in this post (${matchingStudents.length}):`);
                matchingStudents.forEach(m => {
                    console.log(`    * Roll: ${m.rollNumber} | Status: ${m.status}`);
                });
                affectedHistories.push({
                    history: h,
                    matchingStudents
                });
            }
        } catch (e) {
            console.error("JSON parse error for history", h.id);
        }
    });

    console.log(`\nFound ${matchesCount} AttendanceHistory records containing these roll numbers.`);

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
