import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Finding mismatched papers ===");
  const papers = await prisma.midExamPaper.findMany({
    include: {
      subject: true
    }
  });

  let count = 0;
  for (const paper of papers) {
    if (paper.departmentId !== paper.subject.departmentId) {
      console.log(`Mismatch found in Paper ID=${paper.id}: Subject=${paper.subject.name} (${paper.subject.code}). PaperDeptId=${paper.departmentId}, SubjectDeptId=${paper.subject.departmentId}. Fixing...`);
      
      // Update departmentId to match subject.departmentId
      await prisma.midExamPaper.update({
        where: { id: paper.id },
        data: { departmentId: paper.subject.departmentId }
      });
      count++;
    }
  }
  console.log(`=== Done. Fixed ${count} papers. ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
