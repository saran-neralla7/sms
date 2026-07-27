const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      username: { in: ["CHM", "KSK"] }
    },
    include: {
      faculty: true
    }
  });

  console.log("Users & Faculty matching CHM/KSK:");
  for (const user of users) {
    console.log(`Username: ${user.username} | Role: ${user.role} | Faculty ID: ${user.facultyId} | Name: ${user.name}`);
    if (user.facultyId) {
      const mappings = await prisma.facultySubjectMapping.findMany({
        where: { facultyId: user.facultyId },
        include: {
          subject: true,
          section: true
        }
      });
      console.log(`  Mappings (${mappings.length}):`);
      mappings.forEach(m => {
        console.log(`    - Section: ${m.section.name} | Subject: ${m.subject.name} (${m.subject.code}) | Batch: ${m.batch || "None"}`);
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
