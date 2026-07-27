const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      username: { in: ["CHM", "KSK"] }
    }
  });

  const userMap = {};
  users.forEach(u => {
    userMap[u.id] = u.username;
    console.log(`Username: ${u.username} | UserID: ${u.id} | FacultyID: ${u.facultyId}`);
  });

  // Find attendance history by downloadedBy (who logged/uploaded it)
  for (const user of users) {
    const histories = await prisma.attendanceHistory.findMany({
      where: {
        downloadedBy: user.id
      },
      include: {
        subject: true,
        section: true,
        period: true
      },
      orderBy: { date: "desc" }
    });

    console.log(`\nAttendanceHistory records downloaded/logged by ${user.username} (total: ${histories.length}):`);
    // Print unique subject + section + type + date range
    const grouped = {};
    histories.forEach(h => {
      const key = `${h.subject?.name || h.subjectId} | Section: ${h.section?.name || h.sectionId} | Type: ${h.type}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(h);
    });

    for (const [key, list] of Object.entries(grouped)) {
      console.log(`  - ${key}: ${list.length} records. Dates: ${list.slice(0, 3).map(e => e.date.toISOString().split("T")[0]).join(", ")}...`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
