const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const excelPath = path.join(__dirname, '..', 'civil-3.ods');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]]; // '2nd year list'
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Processing ${rows.length} rows from civil-3.ods...`);
  
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    const rollNum = String(row['REGD.NO'] || '').trim();
    const parentMobile = String(row['PARENT NUMBER'] || '').trim();
    
    if (!rollNum) {
      console.log('Skipping empty row.');
      continue;
    }

    // Check if student exists in DB
    const student = await prisma.student.findUnique({
      where: { rollNumber: rollNum }
    });

    if (student) {
      // Update only parent mobile (the 'mobile' field)
      await prisma.student.update({
        where: { rollNumber: rollNum },
        data: { mobile: parentMobile }
      });
      console.log(`Updated Roll: ${rollNum} | Student: ${student.name} | Parent Mobile: ${parentMobile}`);
      updatedCount++;
    } else {
      console.log(`SKIPPED (Not in DB) | Roll: ${rollNum} | Name in ODS: ${row['NAME OF THE STUDENT']}`);
      skippedCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total rows processed: ${rows.length}`);
  console.log(`Successfully updated in DB: ${updatedCount}`);
  console.log(`Skipped (not in DB): ${skippedCount}`);
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
