import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { formatISTDate } from "@/lib/dateUtils";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const sectionId = formData.get("sectionId") as string;
        const departmentId = formData.get("departmentId") as string;
        const year = formData.get("year") as string;
        const semester = formData.get("semester") as string;

        if (!file || !sectionId || !departmentId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // STRICT SECURITY: Prevent stale cookies / unauthorized department uploads
        const dbUser = await prisma.user.findUnique({ where: { id: (session.user as any).id } });
        if (dbUser?.role === "SMS_USER" && dbUser.departmentId) {
            if (departmentId !== dbUser.departmentId) {
                return NextResponse.json({
                    error: "Access Denied: You cannot upload attendance for a different department. Please log out and back in to refresh your assigned department session."
                }, { status: 403 });
            }
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Read raw data as 2D array
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Get Active Context
        const validSubjects = await prisma.subject.findMany({
            where: {
                departmentId,
                year,
                semester
            }
        });
        const validPeriods = await prisma.period.findMany();

        // Grouped Matrix Parsing
        // Row 0: Date
        // Row 1: Subject
        // Row 2: Period
        // Row 3: Data Start

        if (rawData.length < 4) {
            return NextResponse.json({ error: "Invalid File Format. Too few rows." }, { status: 400 });
        }

        const dateRow = rawData[0];
        const subjectRow = rawData[1];
        const periodRow = rawData[2];

        const errors: string[] = [];

        // Identify Valid Columns (Index >= 2)
        const validColumns: { index: number; date: Date; periodId: string; subjectId: string | null }[] = [];

        let lastValidDate: Date | null = null;
        let existingSessionCheck: Promise<any>[] = [];

        // --- PHASE 1: VALIDATION ---
        for (let j = 2; j < dateRow.length; j++) {
            let rawDate = dateRow[j];

            // Date Fill Forward Logic
            if (rawDate) {
                // Parse New Date
                try {
                    if (typeof rawDate === 'number') {
                        lastValidDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                    } else {
                        const parts = String(rawDate).split(/[-/.]/);
                        if (parts.length === 3 && parts[2].length === 4) {
                            lastValidDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        } else {
                            lastValidDate = new Date(String(rawDate));
                        }
                    }
                    if (isNaN(lastValidDate.getTime())) throw new Error("Invalid Date");
                } catch (e) {
                    errors.push(`Column ${j + 1}: Invalid Date value '${rawDate}'`);
                    lastValidDate = null;
                    continue;
                }
            }

            if (!rawDate && !lastValidDate) continue; // Skip if no date context

            const date = lastValidDate!;
            const rawPeriod = periodRow[j];
            const rawSubject = subjectRow[j];

            if (!rawPeriod) continue; // Skip columns without Period (likely empty)

            // Validate Subject (Strict depending on Role)
            const subjStr = String(rawSubject || "").toLowerCase().trim();
            let finalSubjectId: string | null = null;

            // SMS Users should NEVER save subject data, even if it's accidentally in the Excel sheet.
            if (dbUser?.role !== "SMS_USER" && dbUser?.role !== "USER") {
                if (!subjStr) {
                    // Check if this column has ANY attendance data filled in rows 3+
                    let hasData = false;
                    for (let k = 3; k < rawData.length; k++) {
                        if (rawData[k][j]) {
                            hasData = true;
                            break;
                        }
                    }

                    if (hasData) {
                        errors.push(`Column ${j + 1} (${formatISTDate(date)} - ${rawPeriod}): Subject Name missing.`);
                    }
                    // If subject is empty AND no data, we simply skip this column (it's unused)
                    continue;
                }

                // Fuzzy match allowed, but MUST find a matching subject
                const subject = validSubjects.find(s => s.name.toLowerCase().includes(subjStr) || s.code.toLowerCase().includes(subjStr));
                if (!subject) {
                    errors.push(`Column ${j + 1}: Subject '${rawSubject}' does not match any valid subject for this class.`);
                    continue;
                }
                finalSubjectId = subject.id;
            }

            // Validate Period
            const periodStr = String(rawPeriod).toLowerCase().replace(/[^a-z0-9]/g, "");
            const period = validPeriods.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === periodStr);
            let finalPeriod = period;

            if (!finalPeriod) {
                const numeric = periodStr.match(/\d+/)?.[0];
                if (numeric) finalPeriod = validPeriods.find(p => p.name.includes(numeric));
            }

            if (!finalPeriod) {
                errors.push(`Column ${j + 1}: Period '${rawPeriod}' not recognized.`);
                continue;
            }

            // Check Duplicates in DB
            existingSessionCheck.push(
                prisma.attendanceHistory.findFirst({
                    where: {
                        sectionId,
                        date,
                        periodId: finalPeriod.id
                    },
                    select: { id: true, date: true, period: { select: { name: true } } }
                })
            );

            validColumns.push({
                index: j,
                date: date,
                periodId: finalPeriod.id,
                subjectId: finalSubjectId
            });
        }

        if (errors.length > 0) {
            return NextResponse.json({ error: "Validation Failed", details: errors }, { status: 400 });
        }

        // Await Duplicate Checks
        const existingSessions = await Promise.all(existingSessionCheck);
        const duplicates = existingSessions.filter(s => s !== null);
        if (duplicates.length > 0) {
            const dupErrors = duplicates.map(d => `Attendance already exists for ${formatISTDate(d.date)} - ${d.period.name}`);
            return NextResponse.json({ error: "Duplicate Sessions Found", details: dupErrors }, { status: 409 });
        }

        if (validColumns.length === 0) {
            return NextResponse.json({ error: "No valid columns found." }, { status: 400 });
        }

        // --- PHASE 2: TRANSACTIONAL INSERT ---

        // Fetch valid students for this exact class
        const validStudents = await prisma.student.findMany({
            where: {
                departmentId,
                year,
                semester,
                sectionId
            },
            select: { rollNumber: true, name: true }
        });

        // Create a fast lookup Set for valid roll numbers
        const validRollNumbers = new Set(validStudents.map(s => s.rollNumber.toLowerCase()));

        const operations = await prisma.$transaction(async (tx) => {
            let insertedCount = 0;

            for (const col of validColumns) {
                const studentDetails: any[] = [];

                // Iterate rows for this column
                for (let i = 3; i < rawData.length; i++) {
                    const row = rawData[i];
                    const rollNumberRaw = String(row[0] || "").trim();
                    if (!rollNumberRaw) continue;

                    const rollNumber = rollNumberRaw.toLowerCase();

                    // VALIDATION CHECK: Is this student actually in this section?
                    if (!validRollNumbers.has(rollNumber)) {
                        continue; // Skip student - they don't belong here
                    }

                    // Look up correct name from DB or fallback to Excel name
                    const matchingStudent = validStudents.find(s => s.rollNumber.toLowerCase() === rollNumber);
                    const name = matchingStudent?.name || String(row[1] || "");
                    const statusRaw = row[col.index];

                    let status = "Absent";
                    if (statusRaw) {
                        const s = String(statusRaw).toUpperCase();
                        if (["P", "PRESENT", "1", "YES"].includes(s)) status = "Present";
                    }

                    studentDetails.push({
                        "Roll Number": matchingStudent?.rollNumber || rollNumberRaw.toUpperCase(),
                        "Name": name,
                        "Status": status
                    });
                }

                if (studentDetails.length > 0) {
                    await tx.attendanceHistory.create({
                        data: {
                            date: col.date,
                            year,
                            semester,
                            sectionId,
                            departmentId,
                            subjectId: col.subjectId,
                            periodId: col.periodId,
                            status: "Bulk Upload",
                            type: dbUser?.role === "SMS_USER" ? "SMS" : "ACADEMIC",
                            fileName: file.name,
                            downloadedBy: session.user.id,
                            details: JSON.stringify(studentDetails)
                        }
                    });
                    insertedCount += studentDetails.length;
                }
            }
            return insertedCount;
        });

        return NextResponse.json({ success: operations, failed: 0, errors: [] }); // Simple success response

    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
