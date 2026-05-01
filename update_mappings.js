const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mappings = [
    {
      caseId: 1,
      subjectCode: 'CS1205',
      oldEmpCode: 'GVP/T/III/110',
      newEmpCode: 'GVP/T/III/103',
      section: 'C'
    },
    {
      caseId: 2,
      subjectCode: 'ECE1205',
      oldEmpCode: 'GVP/T/III/137',
      newEmpCode: 'GVP/T/III/136',
      section: 'B'
    }
  ];

  for (const map of mappings) {
    console.log(`\n--- Case ${map.caseId} ---`);
    const oldFaculty = await prisma.faculty.findUnique({ where: { empCode: map.oldEmpCode } });
    const newFaculty = await prisma.faculty.findUnique({ where: { empCode: map.newEmpCode } });
    const subjects = await prisma.subject.findMany({ where: { code: map.subjectCode } });
    const section = await prisma.section.findFirst({ where: { name: map.section } }); // In this system, sections often share names. Wait, we should find mappings by old faculty and subject.

    if (!oldFaculty || !newFaculty || subjects.length === 0) {
      console.log('Missing data:', { oldFaculty: !!oldFaculty, newFaculty: !!newFaculty, subjects: subjects.length });
      continue;
    }

    const subjectIds = subjects.map(s => s.id);

    // Find the existing mapping for old faculty, subject, and section name
    const existingMappings = await prisma.facultySubjectMapping.findMany({
      where: {
        facultyId: oldFaculty.id,
        subjectId: { in: subjectIds },
        section: { name: map.section }
      },
      include: { section: true, subject: true, academicYear: true }
    });

    if (existingMappings.length === 0) {
        console.log(`No existing mapping found for ${oldFaculty.empName} teaching ${map.subjectCode} in Section ${map.section}.`);
        continue;
    }

    for (const em of existingMappings) {
        // Check if new faculty already has this mapping
        const conflict = await prisma.facultySubjectMapping.findFirst({
            where: {
                facultyId: newFaculty.id,
                subjectId: em.subjectId,
                sectionId: em.sectionId,
                academicYearId: em.academicYearId
            }
        });

        if (conflict) {
            console.log(`Mapping already exists for ${newFaculty.empName} (Subject: ${em.subject.code}, Section: ${em.section.name}). Removing old mapping to prevent duplicates.`);
            await prisma.facultySubjectMapping.delete({
                where: { id: em.id }
            });
        } else {
            console.log(`Updating mapping: Subject ${em.subject.code}, Section ${em.section.name}. Old Faculty: ${oldFaculty.empName} -> New Faculty: ${newFaculty.empName}`);
            await prisma.facultySubjectMapping.update({
                where: { id: em.id },
                data: { facultyId: newFaculty.id }
            });
        }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
