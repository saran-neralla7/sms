const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const mappings = await prisma.facultySubjectMapping.findMany({
    where: {
      section: { name: "A" },
      OR: [
        { subject: { name: { contains: "Lab" } } },
        { subject: { name: { contains: "Sci" } } }
      ]
    },
    include: {
      subject: true,
      faculty: {
        include: {
          user: true
        }
      }
    }
  });

  console.log("Section A Lab/Sci mappings:");
  mappings.forEach(m => {
    console.log(`Faculty: ${m.faculty.user?.username || m.facultyId} (${m.faculty.user?.name}) | Subject: ${m.subject.name} (${m.subject.code}) | Batch: ${m.batch}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
