const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Let's print all sections in ECE department
    const eceDept = await prisma.department.findFirst({
        where: { code: 'ECE' }
    });
    console.log("ECE Dept:", eceDept?.name, eceDept?.id);

    const sections = await prisma.section.findMany({
        where: {
            departments: {
                some: { id: eceDept?.id }
            }
        }
    });
    console.log("\nECE Sections in DB:");
    sections.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));

    // Let's look at students in ECE in general, grouped by year, semester, section
    const students = await prisma.student.findMany({
        where: { departmentId: eceDept?.id },
        include: { section: true, batch: true }
    });

    console.log(`\nTotal ECE Students: ${students.length}`);
    const dist = {};
    students.forEach(s => {
        const key = `Batch ${s.batch?.name || 'None'} - Yr ${s.year} - Sem ${s.semester} - Sec ${s.section?.name || 'None'}`;
        dist[key] = (dist[key] || 0) + 1;
    });
    console.log("\nStudent distribution in ECE:");
    console.log(dist);

    // Let's also inspect AttendanceHistory for ECE to see what section names/IDs were used in the past for this batch
    const eceHistory = await prisma.attendanceHistory.findMany({
        where: { departmentId: eceDept?.id },
        include: { section: true }
    });
    console.log(`\nTotal ECE Attendance History records: ${eceHistory.length}`);
    const historyDist = {};
    eceHistory.forEach(h => {
        const key = `Yr ${h.year} - Sem ${h.semester} - Sec ${h.section?.name || 'None'}`;
        historyDist[key] = (historyDist[key] || 0) + 1;
    });
    console.log("\nAttendance History distribution in ECE:");
    console.log(historyDist);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
