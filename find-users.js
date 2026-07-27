const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const ids = ["41076800-6386-491a-9a56-83eb6e283232", "836c77a9-9485-4552-8a9a-ff3c464e8729"];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    include: { faculty: true }
  });

  users.forEach(u => {
    console.log(`ID: ${u.id} | Username: ${u.username} | Role: ${u.role} | Faculty ID: ${u.facultyId} | Name: ${u.name}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
