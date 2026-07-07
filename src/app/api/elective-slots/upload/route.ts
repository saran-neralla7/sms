import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

function parseSlotName(category: string): string {
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
    
    // Normalize format like OE-3 or PE-3
    const matchOe = clean.match(/^OE-?(\d+)/);
    if (matchOe) return `OE-${matchOe[1]}`;
    const matchPe = clean.match(/^PE-?(\d+)/);
    if (matchPe) return `PE-${matchPe[1]}`;

    return clean;
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "buffer" });

        const report = {
            totalRowsProcessed: 0,
            successCount: 0,
            errors: [] as string[]
        };

        // Cache lookups
        const departments = await prisma.department.findMany();
        const regulations = await prisma.regulation.findMany();
        const electiveSlots = await prisma.electiveSlot.findMany();

        // Process individual sheets (ignoring 'All Departments' to fetch 'Offering Department' info)
        const targetSheets = wb.SheetNames.filter(name => name !== "All Departments");
        
        // If there is only 'All Departments' or no other sheets, we fall back to processing sheet 0
        const sheetsToProcess = targetSheets.length > 0 ? targetSheets : wb.SheetNames;

        for (const sheetName of sheetsToProcess) {
            const ws = wb.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(ws);

            // Determine Student Department from sheet name
            const studentDeptCode = sheetName.toUpperCase() === "MECHANICAL" ? "MECH" : sheetName.toUpperCase();
            const studentDept = departments.find(d => d.code.toUpperCase() === studentDeptCode);

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNum = i + 2; // +1 for 0-index, +1 for header
                report.totalRowsProcessed++;

                try {
                    const rollNumber = String(row["Roll Number"] || row["rollNumber"] || "").trim();
                    const category = String(row["Elective Category"] || row["electiveCategory"] || "").trim();
                    const subjectCode = String(row["Subject Code"] || row["subjectCode"] || "").trim();
                    const subjectName = String(row["Subject Name"] || row["subjectName"] || "").trim();
                    const rawOfferingDept = String(row["Offering Department"] || row["offeringDepartment"] || studentDeptCode).trim();

                    if (!rollNumber || !category || !subjectCode || !subjectName) {
                        throw new Error("Missing required columns: Roll Number, Elective Category, Subject Code, or Subject Name");
                    }

                    // 1. Find Student
                    const student = await prisma.student.findUnique({
                        where: { rollNumber },
                        include: { subjects: true }
                    });
                    if (!student) {
                        throw new Error(`Student with Roll Number '${rollNumber}' not found in database`);
                    }

                    // 2. Resolve Elective Slot
                    const slotName = parseSlotName(category);
                    let electiveSlot = electiveSlots.find(s => s.name === slotName);
                    if (!electiveSlot) {
                        // Lazy create slot
                        electiveSlot = await prisma.electiveSlot.create({
                            data: { name: slotName }
                        });
                        electiveSlots.push(electiveSlot); // cache
                    }

                    // 3. Resolve Offering Department
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
                        // Create Subject
                        const year = String(row["Year"] || row["year"] || student.year);
                        const semester = student.semester; // use student's current semester
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
                    }

                    // 6. Connect student to subject, disconnecting from any other subject in this same elective slot
                    const existingInSlot = student.subjects.filter(s => s.electiveSlotId === electiveSlot!.id);

                    await prisma.student.update({
                        where: { id: student.id },
                        data: {
                            subjects: {
                                disconnect: existingInSlot.map(s => ({ id: s.id })),
                                connect: { id: subject.id }
                            }
                        }
                    });

                    report.successCount++;
                } catch (err: any) {
                    report.errors.push(`Sheet [${sheetName}], Row ${rowNum}: ${err.message}`);
                }
            }
        }

        return NextResponse.json({
            message: `Processed ${report.totalRowsProcessed} records.`,
            report
        });

    } catch (error: any) {
        console.error("Elective Selections Upload Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process upload file" }, { status: 500 });
    }
}
