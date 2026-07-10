const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const csmDeptId = '7a3274d3-8c1d-4629-b6ef-b89f107e5bb8'; // CSM
  
  // Find Section A
  const sectionA = await prisma.section.findFirst({
    where: { name: 'A' }
  });
  if (!sectionA) {
    console.error('Section A not found!');
    return;
  }

  // Fetch all students in CSM 1-2 A-section
  const students = await prisma.student.findMany({
    where: {
      departmentId: csmDeptId,
      year: '1',
      semester: '2',
      sectionId: sectionA.id
    }
  });
  console.log(`Found ${students.length} students in CSM 1-2 A-section in DB.`);

  // Fetch subjects for CSM 1-2
  const subjects = await prisma.subject.findMany({
    where: {
      departmentId: csmDeptId,
      year: '1',
      semester: '2'
    }
  });

  // Create a map of shortName -> Subject
  const shortNameToSub = {};
  subjects.forEach(s => {
    shortNameToSub[s.shortName.trim().toUpperCase()] = s;
  });

  // Read ODS
  const excelPath = path.join(__dirname, '..', 'sample-result.ods');
  console.log(`Reading ODS from: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Loaded ${rows.length} rows from sample-result.ods.`);

  let insertedCount = 0;

  for (const row of rows) {
    const rollNum = String(row['Roll No.'] || '').trim();
    if (!rollNum) continue;

    // Find student in our DB list
    const student = students.find(s => s.rollNumber === rollNum);
    if (!student) {
      console.log(`Skipping Roll: ${rollNum} (Student not in CSM 1-2 A-section in DB)`);
      continue;
    }

    // Build grades JSON array
    const grades = [];
    
    // Map excel columns to database subject code + name format
    Object.keys(row).forEach(key => {
      const sub = shortNameToSub[key.trim().toUpperCase()];
      if (sub) {
        grades.push({
          subjectCode: `${sub.code} - ${sub.name}`,
          grade: String(row[key] || '').trim()
        });
      }
    });

    // Upsert SemesterResult
    const sgpa = String(row['SGPA'] || '');
    const cgpa = String(row['CGPA'] || '');

    await prisma.semesterResult.upsert({
      where: {
        studentId_year_semester: {
          studentId: student.id,
          year: '1',
          semester: '2'
        }
      },
      update: {
        sgpa,
        cgpa,
        grades
      },
      create: {
        studentId: student.id,
        year: '1',
        semester: '2',
        sgpa,
        cgpa,
        grades
      }
    });

    console.log(`Imported result for ${student.rollNumber} (${student.name})`);
    insertedCount++;
  }

  console.log(`\nSuccessfully imported ${insertedCount} results.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
