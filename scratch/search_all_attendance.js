const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rollNumbers = ['5241431006', '5241431007', '5241431014', '5241431050'];

    const histories = await prisma.attendanceHistory.findMany({
        include: {
            subject: true,
            section: true,
            department: true,
            user: { select: { username: true } }
        }
    });

    console.log(`Total AttendanceHistory records in entire database: ${histories.length}`);

    let matchesCount = 0;

    histories.forEach(h => {
        try {
            const details = JSON.parse(h.details || "[]");
            const matchingStudents = details.filter(d => rollNumbers.includes(d.rollNumber));
            if (matchingStudents.length > 0) {
                matchesCount++;
                console.log(`\nHistory ID: ${h.id}`);
                console.log(`  Date: ${h.date.toISOString().split('T')[0]} | Year: ${h.year} | Sem: ${h.semester} | Type: ${h.type} | Dept: ${h.department?.code} | Sec: ${h.section?.name} | Subject: ${h.subject?.code} (${h.subject?.name}) | Posted by: ${h.user?.username}`);
                console.log(`  Matching students in this post (${matchingStudents.length}):`);
                matchingStudents.forEach(m => {
                    console.log(`    * Roll: ${m.rollNumber} | Status: ${m.status}`);
                });
            }
        } catch (e) {
            // ignore
        }
    });

    console.log(`\nFound ${matchesCount} total AttendanceHistory records containing these roll numbers.`);

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
});
