const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const subjects = await prisma.subject.count();
  const students = await prisma.student.count();
  const papers = await prisma.midExamPaper.count();
  const courseFiles = await prisma.courseFile.count();
  const sections = await prisma.section.count();
  const academicYears = await prisma.academicYear.count();
  const users = await prisma.user.count();

  console.log("=== TABLE COUNTS ===");
  console.log({
    subjects,
    students,
    papers,
    courseFiles,
    sections,
    academicYears,
    users
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
