import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const paper = await prisma.midExamPaper.findFirst({
    where: {
      id: {
        startsWith: "80b3399f"
      }
    },
    include: {
      subject: true,
      questions: {
        orderBy: { questionNo: "asc" },
        include: {
          subQuestions: {
            orderBy: { order: "asc" }
          }
        }
      }
    }
  });

  if (!paper) {
    console.log("No paper found starting with 80b3399f");
    return;
  }

  console.log(`Found Paper ID: ${paper.id}`);
  console.log(`Subject: [${paper.subject.code}] ${paper.subject.name}`);
  console.log(`Exam Type: ${paper.examType}`);
  
  for (const q of paper.questions) {
    console.log(`\nQuestion ${q.questionNo} (ID: ${q.id}):`);
    for (const subQ of q.subQuestions) {
      console.log(`  Subquestion ${subQ.subLabel} (ID: ${subQ.id}):`);
      console.log(`    Text: "${subQ.questionText}"`);
      console.log(`    CO Mapping: ${subQ.coMapping}`);
      console.log(`    Marks: ${subQ.maxMarks}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
