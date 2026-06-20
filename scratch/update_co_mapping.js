const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.midExamSubQuestion.update({
    where: {
      id: "b85584a1-0454-4789-af94-ba8e8eea3de1"
    },
    data: {
      coMapping: "CO5"
    }
  });
  console.log(`Updated subquestion. New CO Mapping: ${result.coMapping}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
