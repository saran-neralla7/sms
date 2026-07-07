const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const workbook = XLSX.readFile('./department_wise_selection.xlsx');
    console.log("Excel Sheets:", workbook.SheetNames);
    
    let totalExcelRows = 0;
    const excelCounts = {};

    for (const sheetName of workbook.SheetNames) {
        if (sheetName === 'All Departments') continue;
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        excelCounts[sheetName] = rows.length;
        totalExcelRows += rows.length;
        console.log(`Excel sheet [${sheetName}]: ${rows.length} rows`);
    }
    console.log(`Total rows in Excel (excluding summary): ${totalExcelRows}`);

    // Count in DB
    const studentCount = await prisma.student.count({
        where: {
            subjects: {
                some: {
                    isElective: true,
                    electiveSlotRelation: {
                        name: {
                            in: ['PE-1', 'PE-2', 'PE-3', 'PE-4', 'PE-5', 'OE-1', 'OE-2', 'OE-3', 'OE-4', 'OPEN ELECTIVE I']
                        }
                    }
                }
            }
        }
    });

    console.log(`Students with mapped electives in DB: ${studentCount}`);

    // Print count of mappings per subject in DB
    console.log("\n=== Subject-wise Enrollment Count in DB ===");
    const subjects = await prisma.subject.findMany({
        where: { isElective: true },
        select: {
            code: true,
            name: true,
            electiveSlotRelation: { select: { name: true } },
            _count: { select: { students: true } }
        }
    });
    subjects.forEach(s => {
        console.log(`- ${s.name} (${s.code}) [Slot: ${s.electiveSlotRelation?.name || 'N/A'}]: ${s._count.students} students`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
