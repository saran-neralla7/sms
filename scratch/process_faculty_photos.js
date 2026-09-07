const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function processFacultyPhotos() {
  const inputDir = '/home/gvp/student-management-system/faculty-photos';
  const targetDir = '/home/gvp/student-management-system/public/faculty-photos';

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (!fs.existsSync(inputDir)) {
    console.log('Input directory does not exist.');
    return;
  }

  const files = fs.readdirSync(inputDir).filter(f => !f.startsWith('.'));
  console.log('Files to process:', files.length);

  const activeFaculty = await prisma.faculty.findMany({
    where: { resignDate: null },
    include: { department: true }
  });

  let matchedCount = 0;
  let unmatchedCount = 0;
  const matchedList = [];
  const unmatchedList = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.parse(file).name.toUpperCase();
    const empCodeWithSlashes = baseName.replace(/[-_]/g, '/');

    // Find matching faculty in DB
    const faculty = activeFaculty.find(f => 
      f.empCode.toUpperCase() === baseName || 
      f.empCode.toUpperCase() === empCodeWithSlashes
    );

    if (!faculty) {
      unmatchedCount++;
      unmatchedList.push(file);
      console.log('Unmatched file:', file);
      continue;
    }

    const safeEmpCode = faculty.empCode.replace(/\//g, '-').replace(/\\/g, '-').toUpperCase();
    const cleanFileName = safeEmpCode + ext;
    const srcPath = path.join(inputDir, file);
    const destPath = path.join(targetDir, cleanFileName);

    // Copy file to target directory
    fs.copyFileSync(srcPath, destPath);

    // Update photoUrl in DB
    const photoUrl = '/api/faculty-photos/' + cleanFileName;
    await prisma.faculty.update({
      where: { id: faculty.id },
      data: { photoUrl }
    });

    matchedCount++;
    matchedList.push({
      file,
      empCode: faculty.empCode,
      name: faculty.empName,
      dept: faculty.department?.code
    });
  }

  console.log('\n--- PHOTO PROCESSING RESULTS ---');
  console.log('Successfully Matched & Updated:', matchedCount);
  console.log('Unmatched Files:', unmatchedCount);

  // Check remaining pending faculty without photos
  const updatedActiveFaculty = await prisma.faculty.findMany({
    where: { resignDate: null },
    include: { department: true },
    orderBy: { empCode: 'asc' }
  });

  const pendingFaculty = updatedActiveFaculty.filter(f => !f.photoUrl || f.photoUrl.trim() === '');

  console.log('\nTotal Active Faculty:', updatedActiveFaculty.length);
  console.log('Active Faculty WITH Photo:', updatedActiveFaculty.length - pendingFaculty.length);
  console.log('Active Faculty STILL PENDING Photo:', pendingFaculty.length);

  // Remove temporary folder
  console.log('\nDeleting temporary folder:', inputDir);
  fs.rmSync(inputDir, { recursive: true, force: true });

  const downloadsDir = '/home/gvp/Downloads/Faculty Images/faculty-photos';
  if (fs.existsSync(downloadsDir)) {
    fs.rmSync(downloadsDir, { recursive: true, force: true });
    console.log('Deleted downloads folder:', downloadsDir);
  }

  console.log('\nPending Faculty List:', JSON.stringify(pendingFaculty.map(f => ({
    empCode: f.empCode,
    name: f.empName,
    dept: f.department?.code || 'N/A'
  })), null, 2));
}

processFacultyPhotos().catch(console.error).finally(() => prisma.$disconnect());
