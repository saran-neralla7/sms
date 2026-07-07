import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";
import { logActivity } from "@/lib/logging";
import { cookies } from "next/headers";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId: userDeptId } = session.user as any;
    const isBSH = isBSHHod(session.user);

    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as Blob;
        const reqDepartmentId = formData.get("departmentId") as string;
        const reqYear = formData.get("year") as string;
        const reqSemester = formData.get("semester") as string;
        const reqSectionId = formData.get("sectionId") as string;
        const activationDate = formData.get("activationDate") as string;

        if (!file || !reqDepartmentId || !reqYear || !reqSemester || !reqSectionId) {
            return NextResponse.json({ error: "Missing file or required filters" }, { status: 400 });
        }

        // Scope validation
        if (role === "HOD") {
            if (isBSH) {
                if (reqYear !== "1") {
                    return NextResponse.json({ error: "BSH HOD can only manage Year 1 timetables" }, { status: 403 });
                }
            } else {
                if (reqDepartmentId !== userDeptId) {
                    return NextResponse.json({ error: "You can only manage timetables for your own department" }, { status: 403 });
                }
            }
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const ws = workbook.Sheets[sheetName];
        if (!ws) {
            return NextResponse.json({ error: "Excel sheet is empty" }, { status: 400 });
        }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (rows.length < 14) {
            return NextResponse.json({ error: "Invalid template format: Too few rows" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const academicYearId = cookieStore.get("academic-year-id")?.value;

        // Fetch active validation data from DB
        const [department, section, periods, subjects, batches, slots, activeAy] = await Promise.all([
            prisma.department.findUnique({ where: { id: reqDepartmentId } }),
            prisma.section.findUnique({ where: { id: reqSectionId } }),
            prisma.period.findMany({ orderBy: { order: "asc" } }),
            prisma.subject.findMany({
                where: {
                    departmentId: reqDepartmentId,
                    year: String(reqYear),
                    semester: String(reqSemester)
                }
            }),
            prisma.labBatch.findMany({
                where: {
                    departmentId: reqDepartmentId,
                    sectionId: reqSectionId,
                    year: String(reqYear),
                    semester: String(reqSemester)
                }
            }),
            prisma.electiveSlot.findMany(),
            academicYearId
                ? prisma.academicYear.findUnique({ where: { id: academicYearId } })
                : prisma.academicYear.findFirst({ where: { isCurrent: true } })
        ]);

        if (!department || !section) {
            return NextResponse.json({ error: "Selected Department or Section not found in database" }, { status: 404 });
        }

        // 1. Validate Metadata against database records
        const excelDeptName = String(rows[1]?.[1] || "").trim();
        const excelSectionName = String(rows[2]?.[1] || "").trim();
        const excelYear = String(rows[3]?.[1] || "").trim();
        const excelSemester = String(rows[4]?.[1] || "").trim();
        const excelAyName = String(rows[5]?.[1] || "").trim();

        const expectedAyName = activeAy ? activeAy.name : "N/A";

        if (excelDeptName.toLowerCase() !== department.name.toLowerCase()) {
            return NextResponse.json({ error: `Department mismatch: The uploaded file is for '${excelDeptName}' but you are loading for '${department.name}'` }, { status: 400 });
        }
        if (excelSectionName.toLowerCase() !== section.name.toLowerCase()) {
            return NextResponse.json({ error: `Section mismatch: The uploaded file is for section '${excelSectionName}' but you are loading for '${section.name}'` }, { status: 400 });
        }
        if (excelYear !== reqYear) {
            return NextResponse.json({ error: `Year mismatch: Selected Year ${reqYear} but file contains Year ${excelYear}` }, { status: 400 });
        }
        if (excelSemester !== reqSemester) {
            return NextResponse.json({ error: `Semester mismatch: Selected Sem ${reqSemester} but file contains Sem ${excelSemester}` }, { status: 400 });
        }
        if (excelAyName.toLowerCase() !== expectedAyName.toLowerCase()) {
            return NextResponse.json({ error: `Academic Year mismatch: Active Academic Year is '${expectedAyName}' but file is for '${excelAyName}'` }, { status: 400 });
        }

        // 2. Map Columns to Periods (Row 8, index 7)
        const headerRow = rows[7];
        if (!headerRow || headerRow.length < 2) {
            return NextResponse.json({ error: "Grid header row (Row 8) is missing or invalid" }, { status: 400 });
        }

        const periodColMap = new Map<number, string>(); // colIndex -> periodId
        for (let col = 1; col < headerRow.length; col++) {
            const headerVal = String(headerRow[col] || "").trim();
            if (!headerVal) continue;

            const matchedPeriod = periods.find(p => headerVal.startsWith(p.name) || headerVal.includes(p.name));
            if (matchedPeriod) {
                periodColMap.set(col, matchedPeriod.id);
            } else {
                // Fallback sequentially
                const pIndex = col - 1;
                if (periods[pIndex]) {
                    periodColMap.set(col, periods[pIndex].id);
                }
            }
        }

        // 3. Parse Grid Rows (Rows 9-14, indices 8-13)
        const dayMap: Record<string, number> = {
            "monday": 1,
            "tuesday": 2,
            "wednesday": 3,
            "thursday": 4,
            "friday": 5,
            "saturday": 6
        };

        const recordsToInsert: any[] = [];
        let activeDate = new Date();
        if (activationDate) {
            const [y, m, d] = activationDate.split("-").map(Number);
            activeDate = new Date(y, m - 1, d, 0, 0, 0, 0);
        }

        for (let i = 8; i <= 13; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const dayName = String(row[0] || "").trim().toLowerCase();
            const dayOfWeek = dayMap[dayName];
            if (!dayOfWeek) {
                return NextResponse.json({ error: `Invalid day name '${row[0]}' at row ${i + 1}` }, { status: 400 });
            }

            for (let col = 1; col < row.length; col++) {
                const periodId = periodColMap.get(col);
                if (!periodId) continue;

                const cellValue = String(row[col] || "").trim();
                if (!cellValue || cellValue.toLowerCase() === "empty") continue;

                if (cellValue.toLowerCase() === "lunch") {
                    recordsToInsert.push({
                        departmentId: reqDepartmentId,
                        year: reqYear,
                        semester: reqSemester,
                        sectionId: reqSectionId,
                        dayOfWeek,
                        periodId,
                        subjectId: null,
                        labBatchId: null,
                        electiveSlotId: null,
                        isLab: false,
                        isLunch: true,
                        validFrom: activeDate,
                        validTo: null
                    });
                    continue;
                }

                // Split parallel subjects
                const parts = cellValue.split("|");
                for (const part of parts) {
                    const trimmedPart = part.trim();
                    if (!trimmedPart) continue;

                    let subjectNameOrCode = trimmedPart;
                    let batchName: string | null = null;

                    // Match batch name in parentheses
                    const batchRegex = /\(([^)]+)\)/;
                    const match = trimmedPart.match(batchRegex);
                    if (match) {
                        batchName = match[1].trim();
                        subjectNameOrCode = trimmedPart.replace(batchRegex, "").trim();
                    }

                    // Resolve Subject or Elective Slot
                    const matchedSubject = subjects.find(s =>
                        s.code.toLowerCase() === subjectNameOrCode.toLowerCase() ||
                        (s.shortName && s.shortName.toLowerCase() === subjectNameOrCode.toLowerCase()) ||
                        s.name.toLowerCase() === subjectNameOrCode.toLowerCase()
                    );

                    const matchedSlot = slots.find(sl => sl.name.toLowerCase() === subjectNameOrCode.toLowerCase());

                    if (!matchedSubject && !matchedSlot) {
                        return NextResponse.json({
                            error: `Invalid subject or slot '${subjectNameOrCode}' in cell for ${row[0]} - column ${col + 1} (${headerRow[col] || "Period"}).`
                        }, { status: 400 });
                    }

                    // Resolve Lab Batch if specified
                    let labBatchId: string | null = null;
                    if (batchName) {
                        const matchedBatch = batches.find(b => b.name.toLowerCase() === batchName!.toLowerCase());
                        if (!matchedBatch) {
                            return NextResponse.json({
                                error: `Lab batch '${batchName}' not found for this section (in cell for ${row[0]} - column ${col + 1}).`
                            }, { status: 400 });
                        }
                        labBatchId = matchedBatch.id;
                    }

                    const isLab = matchedSubject ? (matchedSubject.type.toUpperCase() === "LAB" || matchedSubject.name.toLowerCase().includes("lab")) : false;

                    recordsToInsert.push({
                        departmentId: reqDepartmentId,
                        year: reqYear,
                        semester: reqSemester,
                        sectionId: reqSectionId,
                        dayOfWeek,
                        periodId,
                        subjectId: matchedSubject?.id || null,
                        electiveSlotId: matchedSlot?.id || null,
                        labBatchId,
                        isLab,
                        isLunch: false,
                        validFrom: activeDate,
                        validTo: null
                    });
                }
            }
        }

        if (recordsToInsert.length === 0) {
            return NextResponse.json({ error: "No valid timetable entries found in the grid" }, { status: 400 });
        }

        // Database Write in transaction
        await prisma.$transaction(async (tx) => {
            // Retain history by marking previous active timetables for this section as outdated
            await tx.timetable.updateMany({
                where: {
                    sectionId: reqSectionId,
                    validTo: null
                },
                data: {
                    validTo: activeDate
                }
            });

            // Insert new records
            await tx.timetable.createMany({
                data: recordsToInsert
            });
        });

        // Audit Log
        await logActivity(
            (session.user as any).id,
            "BULK_UPLOAD",
            "Timetable",
            reqSectionId,
            {
                departmentId: reqDepartmentId,
                year: reqYear,
                semester: reqSemester,
                entryCount: recordsToInsert.length
            }
        );

        return NextResponse.json({ success: true, message: `Successfully imported ${recordsToInsert.length} timetable entries.` });

    } catch (error: any) {
        console.error("Timetable Upload Error:", error);
        return NextResponse.json({ error: "Failed to upload and parse timetable" }, { status: 500 });
    }
}
