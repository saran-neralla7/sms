const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const ays = await prisma.academicYear.findMany();
  console.log("=== ACADEMIC YEARS ===");
  for (const ay of ays) {
    const count = await prisma.facultySubjectMapping.count({
      where: { academicYearId: ay.id }
    });
    console.log(`ID: ${ay.id}, Name: ${ay.name}, IsCurrent: ${ay.isCurrent}, Mapping Count: ${count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
