const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const subjects = await prisma.subject.findMany({
    where: { code: 'NCES' },
    include: { department: true }
  });
  console.log("Subjects found with code 'NCES':");
  for (const s of subjects) {
    console.log({
      id: s.id,
      name: s.name,
      code: s.code,
      department: s.department.name,
      isElective: s.isElective
    });
  }
  await prisma.$disconnect();
}

run().catch(console.error);
