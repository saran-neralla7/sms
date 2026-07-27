const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const mappings = await prisma.facultySubjectMapping.findMany({
    where: {
      subject: {
        name: { contains: "Additive Manufacturing" }
      }
    },
    include: {
      subject: true,
      section: true,
      faculty: {
        include: {
          user: true
        }
      }
    }
  });

  console.log(`Faculty mappings for Additive Manufacturing (total: ${mappings.length}):`);
  mappings.forEach(m => {
    console.log(`Faculty: ${m.faculty.user?.username || m.facultyId} (${m.faculty.user?.name}) | Section: ${m.section.name} | Subject: ${m.subject.name} (${m.subject.id}) | Batch: ${m.batch}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
