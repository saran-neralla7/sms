import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Listing Course Files ===");
  const courseFiles = await prisma.courseFile.findMany({
    include: {
      subject: true,
      department: true
    }
  });

  for (const cf of courseFiles) {
    console.log(`CourseFile ID: ${cf.id}, Subject: ${cf.subject.name}, Year: ${cf.year}, Sem: ${cf.semester}, Dept: ${cf.department.code}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
