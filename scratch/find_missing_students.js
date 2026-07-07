const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const filename = 'department_wise_selection.xlsx';
    const wb = XLSX.readFile(filename);
    const sheet = wb.Sheets['All Departments'];
    const excelRows = XLSX.utils.sheet_to_json(sheet);

    console.log("Checking each row in Excel...");
    let missingRolls = [];
    let notEnrolled = [];

    for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];
        const roll = String(row["Roll Number"] || "").trim();
        const code = String(row["Subject Code"] || "").trim().toUpperCase();
        const cat = String(row["Elective Category"] || "").trim().toUpperCase();

        const student = await prisma.student.findUnique({
            where: { rollNumber: roll },
            include: { subjects: true }
        });

        if (!student) {
            missingRolls.push({ row: i+2, roll, code, cat, reason: "Student NOT FOUND in DB" });
        } else {
            // Check if mapped to this subject
            const hasSub = student.subjects.some(s => s.code.toUpperCase() === code);
            if (!hasSub) {
                notEnrolled.push({
                    row: i+2,
                    roll,
                    studentName: student.name,
                    code,
                    cat,
                    reason: "Student found, but NOT connected to subject in DB",
                    dbSubjects: student.subjects.map(s => `${s.code} (${s.electiveSlotId ? 'Elective' : 'Core'})`)
                });
            }
        }
    }

    console.log(`\n=== MISSING STUDENTS IN DB (${missingRolls.length}) ===`);
    missingRolls.forEach(m => {
        console.log(`Row ${m.row}: Roll ${m.roll} -> Sub: ${m.code} (${m.cat})`);
    });

    console.log(`\n=== FOUND IN DB BUT NOT MAPPED TO ELECTIVE (${notEnrolled.length}) ===`);
    notEnrolled.forEach(m => {
        console.log(`Row ${m.row}: Roll ${m.roll} (${m.studentName}) -> Expected Sub: ${m.code} (${m.cat}) | Current DB Subs: ${m.dbSubjects.join(', ')}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
