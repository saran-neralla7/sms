const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const user = await prisma.user.findFirst({
        where: { username: 'BHP' },
        include: { faculty: true }
    });

    if (!user || !user.faculty) {
        console.error("User BHP not found.");
        return;
    }

    const mappings = await prisma.facultySubjectMapping.findMany({
        where: { facultyId: user.faculty.id },
        include: {
            section: true,
            subject: true
        }
    });

    const mappedSectionIds = mappings.map(m => m.sectionId);
    const mappedSectionNames = mappings.map(m => m.section?.name);
    console.log("Mapped Section IDs:", mappedSectionIds);
    console.log("Mapped Section Names:", mappedSectionNames);

    // Let's read out log and filter for these Section IDs
    const outLogPath = '/home/gvp/.pm2/logs/sms-system-out.log';
    if (fs.existsSync(outLogPath)) {
        const content = fs.readFileSync(outLogPath, 'utf8');
        const lines = content.split('\n');
        
        console.log(`\nSearching recent logs for mapped section IDs...`);
        // Let's search the last 30,000 lines of out log
        const recentLines = lines.slice(-30000);
        recentLines.forEach((line, idx) => {
            mappedSectionIds.forEach(secId => {
                if (line.includes(secId) && line.includes('Attendance Submission Payload')) {
                    const lineNum = lines.length - 30000 + idx + 1;
                    console.log(`Line ${lineNum}: ${line}`);
                    // Print the next 10 lines to get full payload details
                    for (let j = 1; j <= 10; j++) {
                        console.log(`  + ${lines[lineNum + j - 1]}`);
                    }
                }
            });
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
