const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const filename = 'department_wise_selection.xlsx';
    console.log(`Reading workbook ${filename}...`);
    const wb = XLSX.readFile(filename);
    const sheet = wb.Sheets['All Departments'];
    const excelRows = XLSX.utils.sheet_to_json(sheet);

    // Group excel counts by Category and Subject Code
    const excelCounts = {};
    excelRows.forEach(row => {
        const cat = String(row["Elective Category"] || row["Category"] || "").trim().toUpperCase();
        const code = String(row["Subject Code"] || "").trim().toUpperCase();
        const key = `${cat}:${code}`;
        excelCounts[key] = (excelCounts[key] || 0) + 1;
    });

    console.log("\n=== COMPARE EXCEL VS DATABASE ===");
    console.log(String("").padEnd(30) + " | " + "Excel Count".padStart(12) + " | " + "DB Count".padStart(12) + " | " + "Difference".padStart(12));
    console.log("-".repeat(75));

    // Get all database subjects that are electives
    const dbSubjects = await prisma.subject.findMany({
        where: { isElective: true },
        include: {
            electiveSlotRelation: true,
            _count: {
                select: { students: true }
            }
        }
    });

    const dbMap = {};
    dbSubjects.forEach(sub => {
        let slotName = sub.electiveSlotRelation?.name || "";
        // Normalize slotName to category
        let cat = "";
        if (slotName === "OPEN ELECTIVE I") cat = "OPEN ELECTIVE I";
        else if (slotName === "OE-3") cat = "OPEN ELECTIVE III";
        else if (slotName === "OE-4") cat = "OPEN ELECTIVE IV";
        else if (slotName === "PE-2") cat = "PE-2";
        else cat = slotName;

        const key = `${cat.toUpperCase()}:${sub.code.toUpperCase()}`;
        dbMap[key] = (dbMap[key] || 0) + sub._count.students;
    });

    // Merge keys
    const allKeys = Array.from(new Set([...Object.keys(excelCounts), ...Object.keys(dbMap)])).sort();

    allKeys.forEach(key => {
        const excelVal = excelCounts[key] || 0;
        const dbVal = dbMap[key] || 0;
        const diff = excelVal - dbVal;
        console.log(key.padEnd(30) + " | " + String(excelVal).padStart(12) + " | " + String(dbVal).padStart(12) + " | " + String(diff).padStart(12));
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
