const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const XLSX = require('xlsx');

function parseSlotName(category) {
    const clean = String(category || "").toUpperCase().trim().replace(/\s+/g, ' ');
    if (clean.includes("OPEN ELECTIVE I") && !clean.includes("II") && !clean.includes("III") && !clean.includes("IV")) return "OE-1";
    if (clean.includes("OPEN ELECTIVE II") && !clean.includes("III")) return "OE-2";
    if (clean.includes("OPEN ELECTIVE III")) return "OE-3";
    if (clean.includes("OPEN ELECTIVE IV")) return "OE-4";
    if (clean.includes("PROFESSIONAL ELECTIVE I") && !clean.includes("II") && !clean.includes("III") && !clean.includes("IV") && !clean.includes("V")) return "PE-1";
    if (clean.includes("PROFESSIONAL ELECTIVE II") && !clean.includes("III")) return "PE-2";
    if (clean.includes("PROFESSIONAL ELECTIVE III")) return "PE-3";
    if (clean.includes("PROFESSIONAL ELECTIVE IV")) return "PE-4";
    if (clean.includes("PROFESSIONAL ELECTIVE V")) return "PE-5";
    
    const matchOe = clean.match(/^OE-?(\d+)/);
    if (matchOe) return `OE-${matchOe[1]}`;
    const matchPe = clean.match(/^PE-?(\d+)/);
    if (matchPe) return `PE-${matchPe[1]}`;

    return clean;
}

function getOfferingDeptCode(subjectCode) {
    const code = String(subjectCode || "").toUpperCase().trim();
    if (["BEE", "DC", "FCS"].includes(code)) return "ECE";
    if (["BME", "NCES", "AM"].includes(code)) return "MECH";
    if (["IAI", "GENAI", "IDL"].includes(code)) return "CSM";
    if (["C++", "IDS", "AI"].includes(code)) return "CSE";
    if (["ICE", "SURVEYING", "ESWM"].includes(code)) return "CIVIL";
    return "";
}

async function main() {
    console.log("Starting Excel import into SMS database...");
    const wb = XLSX.readFile('/home/gvp/student-management-system/department_wise_selection.xlsx');
    
    const departments = await prisma.department.findMany();
    const regulations = await prisma.regulation.findMany();
    const electiveSlots = await prisma.electiveSlot.findMany();

    const sheetName = 'All Departments';
    const ws = wb.Sheets[sheetName];
    if (!ws) {
        console.error("Sheet 'All Departments' not found in Excel file.");
        return;
    }

    const rows = XLSX.utils.sheet_to_json(ws);
    console.log(`Found ${rows.length} rows in sheet.`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        try {
            const rollNumber = String(row["Roll Number"] || row["rollNumber"] || "").trim();
            const category = String(row["Elective Category"] || row["electiveCategory"] || "").trim();
            const subjectCode = String(row["Subject Code"] || row["subjectCode"] || "").trim();
            const subjectName = String(row["Subject Name"] || row["subjectName"] || "").trim();
            const studentDeptCodeInRow = String(row["Student Department"] || "").trim().toUpperCase();

            if (!rollNumber || !category || !subjectCode || !subjectName) {
                throw new Error("Missing required columns");
            }

            // 1. Find Student
            const student = await prisma.student.findUnique({
                where: { rollNumber },
                include: { subjects: true }
            });
            if (!student) {
                throw new Error(`Student with Roll Number '${rollNumber}' not found in SMS database`);
            }

            // 2. Resolve Elective Slot
            const slotName = parseSlotName(category);
            let electiveSlot = electiveSlots.find(s => s.name === slotName);
            if (!electiveSlot) {
                electiveSlot = await prisma.electiveSlot.create({
                    data: { name: slotName }
                });
                electiveSlots.push(electiveSlot);
                console.log(`Created new elective slot: ${slotName}`);
            }

            // 3. Resolve Offering Department
            let rawOfferingDept = getOfferingDeptCode(subjectCode);
            if (!rawOfferingDept) {
                rawOfferingDept = studentDeptCodeInRow || "CSE";
            }
            const offeringDeptCode = rawOfferingDept.toUpperCase() === "MECHANICAL" ? "MECH" : rawOfferingDept.toUpperCase();
            const offeringDept = departments.find(d => d.code.toUpperCase() === offeringDeptCode || d.name.toUpperCase() === offeringDeptCode);
            if (!offeringDept) {
                throw new Error(`Offering Department '${rawOfferingDept}' not found in database`);
            }

            // 4. Resolve Regulation
            let regulationId = student.regulationId;
            if (!regulationId) {
                const defaultReg = regulations.find(r => r.name === "R22");
                regulationId = defaultReg ? defaultReg.id : null;
            }

            // 5. Resolve Subject (Find or Create)
            let subject = await prisma.subject.findFirst({
                where: {
                    code: subjectCode,
                    departmentId: offeringDept.id,
                    regulationId: regulationId
                }
            });

            if (!subject) {
                const year = String(row["Year"] || row["year"] || student.year);
                const semester = student.semester;
                const isLab = subjectCode.toLowerCase().includes("lab");

                subject = await prisma.subject.create({
                    data: {
                        code: subjectCode,
                        name: subjectName,
                        year,
                        semester,
                        type: isLab ? "LAB" : "THEORY",
                        isElective: true,
                        regulationId,
                        electiveSlotId: electiveSlot.id,
                        departmentId: offeringDept.id
                    }
                });
                console.log(`Created new subject in SMS: ${subjectCode} (${subjectName}) for department ${offeringDept.code}`);
            }

            // 6. Connect Student to Subject (disconnect other subjects in the same elective slot)
            const existingInSlot = student.subjects.filter(s => s.electiveSlotId === electiveSlot.id);
            
            await prisma.student.update({
                where: { id: student.id },
                data: {
                    subjects: {
                        disconnect: existingInSlot.map(s => ({ id: s.id })),
                        connect: { id: subject.id }
                    }
                }
            });

            successCount++;
        } catch (err) {
            errorCount++;
            if (errorCount <= 10) {
                console.error(`Row ${rowNum} Error: ${err.message}`);
            }
        }
    }

    console.log(`Import finished. Success: ${successCount}, Errors: ${errorCount}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
