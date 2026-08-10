const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== Inspecting GKC Attendance Records for Grouping Analysis ===");

  const gkcUser = await prisma.user.findFirst({
    where: { username: { equals: 'gkc', mode: 'insensitive' } }
  });

  const dates = [
    new Date('2026-08-03T00:00:00.000Z'),
    new Date('2026-07-27T00:00:00.000Z'),
    new Date('2026-08-04T00:00:00.000Z')
  ];

  const records = await prisma.attendanceHistory.findMany({
    where: {
      downloadedBy: gkcUser.id,
      date: { in: dates }
    },
    include: {
      subject: true,
      section: true,
      period: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${records.length} records on specified dates:`);
  records.forEach(r => {
    console.log(`\n- ID: ${r.id}`);
    console.log(`  Date: ${r.date.toISOString().split('T')[0]}`);
    console.log(`  CreatedAt: ${r.createdAt.toISOString()}`);
    console.log(`  Yr: ${r.year} Sem: ${r.semester} Sec: ${r.section?.name} (SecID: ${r.sectionId})`);
    console.log(`  Sub: ${r.subject?.name} (${r.subject?.code})`);
    console.log(`  Period: ${r.period?.name} (PeriodID: ${r.periodId})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
