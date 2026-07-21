const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    const batch = await prisma.batch.findFirst({
        where: { name: '2024-2028' }
    });

    const students = await prisma.student.findMany({
        where: {
            batchId: batch?.id,
            departmentId: eceDept?.id
        }
    });

    console.log(`Checking ${students.length} students for any historical section links...`);

    const studentSections = {}; // studentId -> Set of sectionIds
    const addLink = (studentId, sectionId, source) => {
        if (!studentSections[studentId]) {
            studentSections[studentId] = new Set();
        }
        studentSections[studentId].add(`${sectionId} (${source})`);
    };

    // 1. Check Mid Exam Marks Entry
    const midMarks = await prisma.midExamMarksEntry.findMany({
        where: {
            studentId: { in: students.map(s => s.id) }
        },
        include: {
            paper: true
        }
    });
    console.log(`Found ${midMarks.length} mid marks entries.`);
    midMarks.forEach(m => {
        if (m.paper?.sectionId) {
            addLink(m.studentId, m.paper.sectionId, `Mid Exam Paper - ${m.paper.year} Yr, Sem ${m.paper.semester}`);
        }
    });

    // 2. Check Assignment Marks
    const assignMarks = await prisma.assignmentMark.findMany({
        where: {
            studentId: { in: students.map(s => s.id) }
        }
    });
    console.log(`Found ${assignMarks.length} assignment marks entries.`);
    assignMarks.forEach(m => {
        if (m.sectionId) {
            addLink(m.studentId, m.sectionId, `Assignment - ${m.year} Yr, Sem ${m.semester}`);
        }
    });

    // Let's resolve section names
    const sections = await prisma.section.findMany();
    const sectionMap = new Map(sections.map(s => [s.id, s.name]));

    // Print student details and their historical sections
    let matchCount = 0;
    students.forEach(s => {
        const links = studentSections[s.id];
        if (links) {
            matchCount++;
            const resolvedLinks = Array.from(links).map(l => {
                const secId = l.split(' ')[0];
                const rest = l.substring(secId.length);
                return `${sectionMap.get(secId) || secId}${rest}`;
            });
            console.log(`Roll: ${s.rollNumber}, Name: ${s.name}, Historical Sections:`, resolvedLinks);
        }
    });

    console.log(`\nFound historical section links for ${matchCount} of ${students.length} students.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
