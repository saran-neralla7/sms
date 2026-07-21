const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const bshDept = await prisma.department.findFirst({
        where: { code: 'BSH' }
    });
    console.log("BSH Dept ID:", bshDept?.id);

    // Let's print BSH sections
    const sections = await prisma.section.findMany({
        where: {
            departments: {
                some: { id: bshDept?.id }
            }
        }
    });
    console.log("BSH Sections in DB:");
    sections.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));

    // Let's check BSH attendance history records
    const bshHistory = await prisma.attendanceHistory.findMany({
        where: { departmentId: bshDept?.id },
        include: { section: true }
    });

    console.log(`\nFound ${bshHistory.length} BSH attendance history records.`);
    const historyDist = {};
    bshHistory.forEach(h => {
        const key = `Yr ${h.year} - Sem ${h.semester} - Sec ${h.section?.name || 'None'}`;
        historyDist[key] = (historyDist[key] || 0) + 1;
    });
    console.log("BSH Attendance History distribution:");
    console.log(historyDist);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
