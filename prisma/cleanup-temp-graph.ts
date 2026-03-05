import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting CLEANUP of Graph Test Data...');

    // 1. Delete Attendance History for the Test Subject
    // We identify it by the subject code we used: TEST-SUB-001
    const subject = await prisma.subject.findFirst({ where: { code: 'TEST-SUB-001' } });

    if (subject) {
        const { count } = await prisma.attendanceHistory.deleteMany({
            where: { subjectId: subject.id }
        });
        console.log(`Deleted ${count} attendance records.`);

        // Delete the subject itself
        await prisma.subject.delete({ where: { id: subject.id } });
        console.log('Test Subject deleted.');
    } else {
        console.log('Test Subject not found (already deleted?).');
    }

    // 2. Delete Test Students
    // Since we used IDs as Roll Numbers in upsert, we might not know their UUIDs, 
    // but we know their roll numbers: TEST-001, TEST-002, TEST-003
    const rolls = ['TEST-001', 'TEST-002', 'TEST-003'];

    // First delete their results if any (none created by seed, but good practice)
    // Then delete student
    for (const r of rolls) {
        // Attendance history might strictly query student ID. 
        // We already deleted subject-linked history. 
        // But if history linked just section/dept, we need to be careful.
        // The seed linked specific subject.

        await prisma.student.deleteMany({
            where: { rollNumber: r }
        });
    }
    console.log('Test Students deleted.');

    // 3. Cleanup Dept/Section? 
    // Only if we are sure no one else uses them.
    // Let's leave them or check count. Safest to leave them or delete if no students.

    console.log('Cleanup completed.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
