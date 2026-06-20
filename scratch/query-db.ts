import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Listing unique departments and their subjects ===");
  const depts = await prisma.department.findMany();
  for (const d of depts) {
    const subCount = await prisma.subject.count({ where: { departmentId: d.id } });
    const studCount = await prisma.student.count({ where: { departmentId: d.id, isAlumni: false } });
    console.log(`Dept: Name=${d.name}, Code=${d.code}, Id=${d.id}, Subjects=${subCount}, Active Students=${studCount}`);
  }

  console.log("\n=== Checking the FacultySubjectMapping structure for active academic year ===");
  const activeYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (activeYear) {
    const mappings = await prisma.facultySubjectMapping.findMany({
      where: { academicYearId: activeYear.id },
      include: {
        subject: { include: { department: true } },
        section: true,
        faculty: { include: { department: true } }
      }
    });

    console.log(`Total mappings in active year: ${mappings.length}`);
    // Print first 15 mappings
    for (const m of mappings.slice(0, 15)) {
      console.log(`- Mapping: Subject=${m.subject.name} (${m.subject.code}), SubjectDept=${m.subject.department.code}, Section=${m.section.name}, Faculty=${m.faculty.empName}, FacultyDept=${m.faculty.department.code}`);
    }
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
