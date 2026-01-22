import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

// Helper to normalized date from Excel
// Excel dates are numbers (days since 1900). Strings might be "DD-MM-YYYY".
function parseDate(value: any): Date | null {
    if (!value) return null;

    if (value instanceof Date) return value;

    // Handle Excel Serial Date
    if (typeof value === 'number') {
        // -25569 = Days between 1970 and 1900
        // 86400 = Seconds in a day
        // This is a rough estimation, for robust parsing we might use a library, 
        // but typically xlsx 'cellDates: true' handles this.
        // However, if we receive a raw number:
        return new Date(Math.round((value - 25569) * 86400 * 1000));
    }

    // Handle String DD-MM-YYYY or DD/MM/YYYY
    if (typeof value === 'string') {
        const parts = value.split(/[-/]/);
        if (parts.length === 3) {
            // Assuming DD-MM-YYYY
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    }

    return new Date(value); // Fallback
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const sectionId = formData.get("sectionId") as string;
        const departmentId = formData.get("departmentId") as string;
        const year = formData.get("year") as string;
        const semester = formData.get("semester") as string;

        if (!file || !sectionId || !departmentId || !year || !semester) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON (Array of Arrays)
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Data Verification
        if (rawData.length < 3) {
            return NextResponse.json({ error: "Invalid file format. Header or data missing." }, { status: 400 });
        }

        // Row 1: Headers (Student Roll Numbers starts at Index 3 -> Column D)
        const headerRow = rawData[0];
        const studentRolls = headerRow.slice(3).map(r => String(r).trim());

        // Fetch Valid Subjects and Periods for fuzzy matching
        // We fetch ALL subjects for the department to ensure matching works even if elective...
        // Or strictly filter by Year/Sem? Better strictly filter to avoid cross-year confusion.
        const validSubjects = await prisma.subject.findMany({
            where: { departmentId, year, semester }
        });

        const validPeriods = await prisma.period.findMany({});

        // Fetch Students to get their names for the JSON details
        // We assume the roll numbers in header are correct, but valid students map is needed.
        const validStudents = await prisma.student.findMany({
            where: { sectionId },
            select: { rollNumber: true, name: true, id: true, mobile: true }
        });

        const studentMap = new Map<string, typeof validStudents[0]>();
        validStudents.forEach(s => studentMap.set(s.rollNumber, s));

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Iterate Rows starting from Row 3 (Index 2)
        // Row 1 = Headers, Row 2 = Info, Row 3 = Data
        for (let i = 2; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            const dateRaw = row[0];
            const periodName = String(row[1] || "").trim();
            const subjectNameRaw = String(row[2] || "").trim();

            // 1. Validate Meta
            if (!dateRaw || !periodName || !subjectNameRaw) {
                results.errors.push(`Row ${i + 1}: Missing Date, Period, or Subject.`);
                results.failed++;
                continue;
            }

            const date = parseDate(dateRaw);
            if (!date || isNaN(date.getTime())) {
                results.errors.push(`Row ${i + 1}: Invalid Date format.`);
                results.failed++;
                continue;
            }

            // 2. Find Period
            // Normalized match
            const period = validPeriods.find(p =>
                p.name.toLowerCase() === periodName.toLowerCase() ||
                `period ${p.name}`.toLowerCase() === periodName.toLowerCase() ||
                p.name.toLowerCase().includes(periodName.toLowerCase()) // Lax matching if needed
            );
            if (!period) {
                results.errors.push(`Row ${i + 1}: Invalid Period '${periodName}'.`);
                results.failed++;
                continue;
            }

            // 3. Find Subject (Name or Code)
            const subject = validSubjects.find(s =>
                s.name.toLowerCase() === subjectNameRaw.toLowerCase() ||
                s.code.toLowerCase() === subjectNameRaw.toLowerCase()
            );
            if (!subject) {
                results.errors.push(`Row ${i + 1}: Invalid Subject '${subjectNameRaw}' for this Year/Sem.`);
                results.failed++;
                continue;
            }

            // 4. Build Student Attendance
            // Iterate columns starting from D (Index 3)
            const studentDetails: any[] = [];
            let presentCount = 0;
            let absentCount = 0;

            studentRolls.forEach((roll, index) => {
                const rawStatus = row[index + 3];
                const student = studentMap.get(roll);

                if (student) {
                    // Determine Status
                    // P, Present, 1 = Present
                    // A, Absent, 0, null = Absent
                    let status = "Absent";
                    if (rawStatus) {
                        const s = String(rawStatus).toLowerCase().trim();
                        if (s === 'p' || s === 'present' || s === '1') {
                            status = "Present";
                            presentCount++;
                        } else {
                            absentCount++;
                        }
                    } else {
                        absentCount++; // Treat empty as Absent? Or skip? Standard is usually empty = absent or explicit A. Let's assume empty code = absent for safety, or we could require explicit.
                        // Let's assume P = Present, anything else = Absent.
                    }

                    studentDetails.push({
                        "id": student.id,
                        "Roll Number": student.rollNumber,
                        "Name": student.name,
                        "Mobile": student.mobile, // Optional but good for details
                        "Status": status
                    });
                }
            });

            // 5. Create Record
            // Check for duplicates?
            // upsert might be better but let's just create. If specific logic needed we can check.
            // We shouldn't duplicate section+date+period+subject.

            const existing = await prisma.attendanceHistory.findFirst({
                where: {
                    sectionId,
                    date: date,
                    periodId: period.id,
                    subjectId: subject.id,
                }
            });

            if (existing) {
                results.errors.push(`Row ${i + 1}: Record already exists for ${date.toDateString()} - ${period.name}. Skipped.`);
                results.failed++;
                continue; // Skip Overlap
            }

            await prisma.attendanceHistory.create({
                data: {
                    year,
                    semester,
                    sectionId,
                    departmentId,
                    status: "Marked Present", // Or derive from majority? Usually "Marked Present" means the process was done.
                    fileName: `Bulk Upload - ${date.toDateString()}`,
                    downloadedBy: session.user.id,
                    date: date,
                    subjectId: subject.id,
                    periodId: period.id,
                    details: JSON.stringify(studentDetails)
                }
            });

            results.success++;
        }

        return NextResponse.json(results);

    } catch (error) {
        console.error("Bulk Upload Error:", error);
        return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
    }
}
