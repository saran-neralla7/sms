const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const idsToDelete = [
    '4a93e794-e7bb-4be4-8e3b-bce3f25ecb0c',
    '01460d9e-e2b4-4a90-b618-2b17758a7942',
    '7edb7d28-df45-4826-b0a1-fbcdfdc55693',
    '928652c1-7149-4f55-8ed9-c1ea391e2660',
    '79e9df11-0f8c-4c91-8778-542267805cfb',
    'c3720194-a646-4069-ba67-b793cddf7333'
  ];

  const deleteResult = await prisma.attendanceHistory.deleteMany({
    where: {
      id: { in: idsToDelete }
    }
  });

  console.log("Successfully deleted synced records:", deleteResult);
}

main().catch(console.error).finally(() => prisma.$disconnect());
