const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const csmDeptId = '7a3274d3-8c1d-4629-b6ef-b89f107e5bb8'; // CSM
  
  const sectionA = await prisma.section.findFirst({
    where: { name: 'A' }
  });
  if (!sectionA) {
    console.error('Section A not found!');
    return;
  }

  const students = await prisma.student.findMany({
    where: {
      departmentId: csmDeptId,
      year: '1',
      semester: '2',
      sectionId: sectionA.id
    }
  });

  const studentIds = students.map(s => s.id);

  const deleted = await prisma.semesterResult.deleteMany({
    where: {
      studentId: { in: studentIds },
      year: '1',
      semester: '2'
    }
  });

  console.log(`Cleanly deleted ${deleted.count} semester results for CSM 1-2 A-section students. DB is restored.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
