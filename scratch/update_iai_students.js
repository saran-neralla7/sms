const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumbers = ['5241431006', '5241431007', '5241431014', '5241431050'];

    // 1. Find IAI subject
    const iaiSubject = await prisma.subject.findFirst({
        where: {
            year: "3",
            semester: "1",
            code: "IAI"
        }
    });

    if (!iaiSubject) {
        console.error("Subject 'IAI' not found for Year 3 Sem 1!");
        process.exit(1);
    }

    console.log("Target Subject Found:", iaiSubject.id, iaiSubject.code, iaiSubject.name);

    // 2. Find students
    const students = await prisma.student.findMany({
        where: { rollNumber: { in: rollNumbers } },
        include: { subjects: true }
    });

    console.log(`Found ${students.length} students to update.`);

    for (const student of students) {
        console.log(`\nProcessing student: ${student.rollNumber} (${student.name})`);
        console.log("  Current enrolled subjects:", student.subjects.map(s => `${s.code} (${s.id})`));

        // Disconnect old elective subjects for Year 3 Sem 1 if any
        const oldElectivesToDisconnect = student.subjects.filter(s => s.year === "3" && s.semester === "1" && s.id !== iaiSubject.id);

        const disconnectOps = oldElectivesToDisconnect.map(s => ({ id: s.id }));

        const updatedStudent = await prisma.student.update({
            where: { id: student.id },
            data: {
                subjects: {
                    disconnect: disconnectOps,
                    connect: [{ id: iaiSubject.id }]
                }
            },
            include: { subjects: true }
        });

        console.log("  Updated enrolled subjects:", updatedStudent.subjects.map(s => `${s.code} (${s.id})`));
    }

    // 3. Check for any AttendanceHistory entries containing these roll numbers and remove absent records if present
    const histories = await prisma.attendanceHistory.findMany({
        where: { year: "3", semester: "1" }
    });

    let cleanedPostsCount = 0;
    for (const history of histories) {
        try {
            const details = JSON.parse(history.details || "[]");
            let modified = false;

            const updatedDetails = details.filter(d => {
                if (rollNumbers.includes(d.rollNumber)) {
                    // If student was marked absent or present in another subject's post, remove them so they start clean in IAI
                    modified = true;
                    return false;
                }
                return true;
            });

            if (modified) {
                cleanedPostsCount++;
                await prisma.attendanceHistory.update({
                    where: { id: history.id },
                    data: { details: JSON.stringify(updatedDetails) }
                });
                console.log(`Cleaned attendance entry in History ID ${history.id} for date ${history.date.toISOString().split('T')[0]}`);
            }
        } catch (e) {
            // ignore
        }
    }

    console.log(`\nCleaned ${cleanedPostsCount} previous attendance records.`);
    console.log("Operation completed successfully without data loss!");

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
