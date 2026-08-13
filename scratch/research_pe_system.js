const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== Inspecting ECE Department & Elective Subjects ===");

  const eceDept = await prisma.department.findFirst({
    where: { code: 'ECE' }
  });

  if (!eceDept) {
    console.log("ECE Department not found!");
    return;
  }

  console.log("ECE Dept ID:", eceDept.id);

  // Find all ECE subjects with isElective = true or type like PE
  const subjects = await prisma.subject.findMany({
    where: {
      departmentId: eceDept.id,
      year: "3",
      semester: "1"
    },
    include: {
      electiveSlotRelation: true,
      students: { select: { id: true, rollNumber: true, sectionId: true } },
      FacultySubjectMapping: { include: { faculty: true, section: true } }
    }
  });

  console.log(`\nFound ${subjects.length} ECE Year 3 Sem 1 Subjects:`);
  subjects.forEach(s => {
    console.log(`- ID: ${s.id} | Code: ${s.code} | Name: ${s.name} | Type: ${s.type} | isElective: ${s.isElective} | ElectiveSlot: ${s.electiveSlotRelation?.name || 'None'}`);
    console.log(`  Enrolled Students Count: ${s.students.length}`);
    console.log(`  Faculty Mappings (${s.FacultySubjectMapping.length}):`);
    s.FacultySubjectMapping.forEach(m => {
      console.log(`    * Faculty: ${m.faculty.empName} (${m.faculty.shortName}) | Sec: ${m.section?.name}`);
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
