const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumbers = ['5241431006', '5241431007', '5241431014', '5241431050'];
    console.log("Searching for students:", rollNumbers);

    const students = await prisma.student.findMany({
        where: { rollNumber: { in: rollNumbers } },
        include: {
            department: true,
            section: true,
            subjects: { select: { id: true, name: true, code: true, isElective: true, type: true } }
        }
    });

    console.log(`Found ${students.length} students:`);
    students.forEach(s => {
        console.log(`- ${s.rollNumber} (${s.name}) | Dept: ${s.department?.code} | Year: ${s.year} | Sem: ${s.semester} | Sec: ${s.section?.name}`);
        console.log(`  Enrolled Subjects (${s.subjects.length}):`, s.subjects.map(sub => `${sub.code} (${sub.name})`));
    });

    console.log("\nSearching for subject 'IAI' for Year 3 Sem 1...");
    const subjects = await prisma.subject.findMany({
        where: {
            year: "3",
            semester: "1",
            OR: [
                { name: { contains: "IAI", mode: "insensitive" } },
                { code: { contains: "IAI", mode: "insensitive" } },
                { shortName: { contains: "IAI", mode: "insensitive" } }
            ]
        },
        include: { department: true, electiveSlotRelation: true }
    });

    console.log(`Found ${subjects.length} matching subjects:`);
    subjects.forEach(sub => {
        console.log(`- ID: ${sub.id} | Code: ${sub.code} | Name: ${sub.name} | Dept: ${sub.department?.code} | Type: ${sub.type} | Slot: ${sub.electiveSlotRelation?.name}`);
    });

    // Check attendance records for these 4 students in IAI subject or all subjects
    for (const student of students) {
        const attendance = await prisma.attendanceRecord.findMany({
            where: { studentId: student.id },
            include: {
                attendanceHistory: {
                    include: { subject: true }
                }
            }
        });
        console.log(`\nAttendance records for ${student.rollNumber} (${student.name}) Total: ${attendance.length}`);
        const absentRecords = attendance.filter(a => a.status === 'Absent' || a.status === 'ABSENT');
        console.log(`  Absent records count: ${absentRecords.length}`);
        absentRecords.forEach(a => {
            const dateStr = a.attendanceHistory.date ? a.attendanceHistory.date.toISOString().split('T')[0] : 'N/A';
            const subName = a.attendanceHistory.subject?.name || 'N/A';
            console.log(`    - Date: ${dateStr} | Status: ${a.status} | Subject: ${subName} (${a.attendanceHistory.subject?.code}) | History ID: ${a.attendanceHistoryId}`);
        });
    }

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
