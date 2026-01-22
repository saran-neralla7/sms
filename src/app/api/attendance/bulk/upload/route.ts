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

        // Grouped Matrix Parsing
        // Row 0: Date (Merged - so we need to fill forward)
        // Row 1: Subject (Per Column)
        // Row 2: Period (Per Column)
        // Row 3: Data Start

        if (rawData.length < 4) {
            return NextResponse.json({ error: "Invalid File Format. Too few rows." }, { status: 400 });
        }

        const dateRow = rawData[0];
        const subjectRow = rawData[1];
        const periodRow = rawData[2];

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        // Identify Valid Columns (Index >= 2 usually, check headers)
        const validColumns: { index: number; date: Date; periodId: string; subjectId: string }[] = [];

        let lastValidDate: Date | null = null;

        // Iterate columns from Index 2 (C) to end
        // Assuming A & B are Roll/Name
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
                        if (parts.length === 3) {
                            if (parts[0].length === 2 && parts[2].length === 4) {
                                lastValidDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            } else {
                                lastValidDate = new Date(String(rawDate));
                            }
                        } else {
                            lastValidDate = new Date(String(rawDate));
                        }
                    }
                    if (isNaN(lastValidDate.getTime())) throw new Error("Invalid Date");
                } catch (e) {
                    // If date parse fails, do we propagate previous?
                    // If specific cell has bad date, maybe error.
                    // But merged cells usually have only top-left value.
                    // Empty cells follow previous.
                    // If non-empty but invalid -> Error.
                    results.errors.push(`Column ${j + 1}: Invalid Date '${rawDate}'`);
                    lastValidDate = null;
                    continue;
                }
            }

            // If current cell is empty, we use lastValidDate (Merged Cell behavior)
            if (!rawDate && !lastValidDate) {
                // No date context yet
                continue;
            }

            const date = lastValidDate!;

            const rawPeriod = periodRow[j];
            const rawSubject = subjectRow[j];

            if (!rawPeriod) continue; // Skip columns without Period (likely empty)

            // Validate Period
            const periodStr = String(rawPeriod).toLowerCase().replace(/[^a-z0-9]/g, "");
            const period = validPeriods.find(p => p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === periodStr);
            let finalPeriod = period;

            if (!finalPeriod) {
                // Fuzzy: "1st Hour" -> "1"
                const numeric = periodStr.match(/\d+/)?.[0];
                if (numeric) {
                    finalPeriod = validPeriods.find(p => p.name.includes(numeric));
                }
            }

            if (!finalPeriod) {
                results.errors.push(`Column ${j + 1}: Period '${rawPeriod}' not found`);
                continue;
            }

            // Validate Subject
            // If subject is empty, we might error or allow? 
            // Attendance requires Subject usually.
            const subjStr = String(rawSubject || "").toLowerCase().trim();
            if (!subjStr) {
                results.errors.push(`Column ${j + 1}: Subject Name missing`);
                continue;
            }

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
            return NextResponse.json({ error: "No valid columns found. Check Date/Subject/Period rows." }, { status: 400 });
        }

        // Context Check for Duplicates before processing rows
        // To optimized, we can fetch all existing history for these contexts
        // But basic impl first.

        // Process Each Column (Session)
        for (const col of validColumns) {
            const studentDetails: any[] = [];

            // Data starts Row 3
            for (let i = 3; i < rawData.length; i++) {
                const row = rawData[i];
                const rollNumber = String(row[0] || "");
                if (!rollNumber) continue;

                const name = String(row[1] || "");
                const statusRaw = row[col.index];

                let status = "Absent"; // Default
                // Interpret: P, Present, 1 -> Present. Else Absent.
                if (statusRaw) {
                    const s = String(statusRaw).toUpperCase();
                    if (["P", "PRESENT", "1", "YES"].includes(s)) status = "Present";
                }

                studentDetails.push({
                    "Roll Number": rollNumber,
                    "Name": name,
                    "Status": status
                });
            }

            if (studentDetails.length > 0) {
                try {
                    // Check duplicate
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
                        results.errors.push(`Session ${col.date.toDateString()} (Period: ${col.index}) already exists. Skipped.`);
                        continue; // Skip without counting failure? Or count as failed?
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
