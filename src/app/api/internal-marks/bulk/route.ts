import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const academicYearId = formData.get("academicYearId") as string;
        const departmentId = formData.get("departmentId") as string;
        const year = formData.get("year") as string;
        const semester = formData.get("semester") as string;
        const sectionId = formData.get("sectionId") as string;

        if (!file || !academicYearId || !departmentId || !year || !semester || !sectionId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Verify the user permissions to upload for this department
        if (role === "HOD") {
            const userDept = (session.user as any).departmentId;
            if (userDept !== departmentId) {
                return NextResponse.json({ error: "You can only upload marks for your department" }, { status: 403 });
            }
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (data.length < 2) {
            return NextResponse.json({ error: "Empty or invalid Excel file" }, { status: 400 });
        }

        const headerRow = data[0];
        // Expected Header: ["Roll Number", "Name", "CS101 - Subject A", "CS102 - Subject B", ...]
        if (headerRow[0] !== "Roll Number" || headerRow[1] !== "Name") {
            return NextResponse.json({ error: "Invalid template format. The first two columns must be 'Roll Number' and 'Name'." }, { status: 400 });
        }

        // Extract subjects from headers
        const subjectCols: { index: number, code: string, subjectId: string }[] = [];
        
        // Fetch valid subjects for the context
        const validSubjects = await prisma.subject.findMany({
            where: { departmentId, year, semester }
        });

        for (let i = 2; i < headerRow.length; i++) {
            const header = (headerRow[i] || "").toString().trim();
            if (!header) continue;
            
            // Format: "CODE - Name"
            const codeParts = header.split(" - ");
            const code = codeParts[0].trim();
            
            const matchedSubject = validSubjects.find(s => s.code === code);
            if (matchedSubject) {
                subjectCols.push({ index: i, code, subjectId: matchedSubject.id });
            }
        }

        if (subjectCols.length === 0) {
            return NextResponse.json({ error: "No valid subjects found in the template headers matching this semester." }, { status: 400 });
        }

        // Fetch students to map roll numbers to student IDs
        const students = await prisma.student.findMany({
            where: { departmentId, year, semester, sectionId },
            select: { id: true, rollNumber: true }
        });

        const studentMap = new Map(students.map(s => [s.rollNumber.toUpperCase(), s.id]));

        const operations: any[] = [];
        let skippedRows = 0;
        let invalidMarks = 0;

        // Process data rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const rawRoll = (row[0] || "").toString().trim().toUpperCase();
            if (!rawRoll) continue;

            const studentId = studentMap.get(rawRoll);
            if (!studentId) {
                skippedRows++;
                continue; // Student might have changed sections or left
            }

            // Loop through each matched subject column
            for (const subCol of subjectCols) {
                const markRaw = row[subCol.index];
                
                // Allow explicit 0, but skip empty or null
                if (markRaw === null || markRaw === undefined || markRaw === "") continue;

                let markVal = parseFloat(markRaw.toString());
                
                if (isNaN(markVal)) {
                    invalidMarks++;
                    continue;
                }

                // Strictly enforce marks between 0 and 30
                if (markVal < 0) markVal = 0;
                if (markVal > 30) markVal = 30;

                // Prepare Upsert (Unique constraint: studentId, subjectId, academicYearId)
                operations.push(prisma.internalMark.upsert({
                    where: {
                        studentId_subjectId_academicYearId: {
                            studentId,
                            subjectId: subCol.subjectId,
                            academicYearId
                        }
                    },
                    update: {
                        marksObtained: markVal,
                        recordedById: session.user.id
                    },
                    create: {
                        studentId,
                        subjectId: subCol.subjectId,
                        academicYearId,
                        marksObtained: markVal,
                        maxMarks: 30,
                        recordedById: session.user.id
                    }
                }));
            }
        }

        // Execute transactions
        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    action: "UPLOAD_INTERNAL_MARKS",
                    entity: "InternalMark",
                    details: JSON.stringify({
                        recordsProcessed: operations.length,
                        skippedRows,
                        invalidMarks
                    }),
                    performedBy: session.user.id
                }
            });
        } catch(e) { console.error("Failed to log internal marks upload audit", e); }

        return NextResponse.json({
            success: true,
            recordsUpdated: operations.length,
            skippedStudentRows: skippedRows,
            invalidMarksIgnored: invalidMarks
        });

    } catch (error: any) {
        console.error("Bulk Internal Marks Upload Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process upload" }, { status: 500 });
    }
}
