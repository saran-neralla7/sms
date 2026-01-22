import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

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

        // Matrix Parsing
        // Row 0: Date
        // Row 1: Period
        // Row 2: Subject
        // Row 3: Headers
        // Row 4+: Data

        if (rawData.length < 5) {
            return NextResponse.json({ error: "Invalid File Format. Too few rows." }, { status: 400 });
        }

        const dateRow = rawData[0];
        const periodRow = rawData[1];
        const subjectRow = rawData[2];

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Identify Valid Columns (Index >= 2)
        const validColumns: { index: number; date: Date; periodId: string; subjectId: string }[] = [];

        // Parse Headers for Columns
        for (let j = 2; j < dateRow.length; j++) {
            const rawDate = dateRow[j];
            const rawPeriod = periodRow[j];
            const rawSubject = subjectRow[j];

            if (!rawDate && !rawPeriod && !rawSubject) continue; // Empty column

            // Validate Date
            let date: Date;
            try {
                if (typeof rawDate === 'number') {
                    date = new Date(Math.round((rawDate - 25569) * 86400 * 1000)); // Excel serial date
                } else {
                    // Try parsing DD-MM-YYYY or YYYY-MM-DD
                    const parts = String(rawDate).split(/[-/.]/);
                    if (parts.length === 3) {
                        // Assume DD-MM-YYYY if parts[0] is day-like (e.g. <=31) and parts[2] is year-like (>=2000)
                        if (parts[0].length === 2 && parts[2].length === 4) {
                            date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        } else {
                            date = new Date(String(rawDate));
                        }
                    } else {
                        date = new Date(String(rawDate));
                    }
                }
                if (isNaN(date.getTime())) throw new Error("Invalid Date");
            } catch (e) {
                results.errors.push(`Column ${j + 1}: Invalid Date '${rawDate}'`);
                continue;
            }

            // Validate Period
            const periodStr = String(rawPeriod || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            const period = validPeriods.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === periodStr || p.startTime.includes(periodStr) || periodStr.includes(p.name.toLowerCase()));
            let finalPeriod = period;

            if (!finalPeriod && rawPeriod) { // If period provided but not found
                // Try fuzzy match "1" -> "1st Hour"
                const numeric = periodStr.match(/\d/)?.[0];
                if (numeric) {
                    finalPeriod = validPeriods.find(p => p.name.includes(numeric));
                }
            }

            if (!finalPeriod) {
                results.errors.push(`Column ${j + 1}: Period '${rawPeriod}' not found`);
                continue;
            }

            // Validate Subject
            const subjStr = String(rawSubject || "").toLowerCase().trim();
            const subject = validSubjects.find(s => s.name.toLowerCase().includes(subjStr) || s.code.toLowerCase().includes(subjStr));
            if (!subject) {
                results.errors.push(`Column ${j + 1}: Subject '${rawSubject}' not found`);
                continue;
            }

            validColumns.push({
                index: j,
                date: date,
                periodId: finalPeriod.id,
                subjectId: subject.id
            });
        }

        if (validColumns.length === 0) {
            return NextResponse.json({ error: "No valid session columns found. Check Date/Period/Subject headers." }, { status: 400 });
        }

        // Process Each Column (Session)
        for (const col of validColumns) {
            const studentDetails: any[] = [];

            for (let i = 4; i < rawData.length; i++) {
                const row = rawData[i];
                const rollNumber = String(row[0] || "");
                if (!rollNumber) continue;

                const name = String(row[1] || "");
                const statusRaw = row[col.index];

                let status = "Absent"; // Default
                if (statusRaw) {
                    const s = String(statusRaw).toUpperCase();
                    if (["P", "PRESENT", "1", "YES"].includes(s)) status = "Present";
                    // If A/Absent/0/Empty -> Absent
                }

                studentDetails.push({
                    "Roll Number": rollNumber,
                    "Name": name,
                    "Status": status
                });
            }

            if (studentDetails.length > 0) {
                // Create History Record for this Session
                try {
                    // Check if already exists to avoid duplicates
                    const existing = await prisma.attendanceHistory.findFirst({
                        where: {
                            sectionId,
                            date: col.date,
                            year,
                            semester,
                            periodId: col.periodId,
                            subjectId: col.subjectId
                        }
                    });

                    if (existing) {
                        results.errors.push(`Session ${col.date.toDateString()} (Period ${col.index}) already exists. Skipped.`);
                        results.failed += studentDetails.length;
                        continue;
                    }

                    await prisma.attendanceHistory.create({
                        data: {
                            date: col.date,
                            year,
                            semester,
                            sectionId,
                            departmentId,
                            subjectId: col.subjectId,
                            periodId: col.periodId,
                            status: "Bulk Upload",
                            fileName: file.name,
                            downloadedBy: session.user.id,
                            details: JSON.stringify(studentDetails)
                        }
                    });
                    results.success += studentDetails.length;
                } catch (e) {
                    console.error(e);
                    results.failed += studentDetails.length;
                    results.errors.push(`Failed to save session for ${col.date.toDateString()}`);
                }
            }
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }
}
