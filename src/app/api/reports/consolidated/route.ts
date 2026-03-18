import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!year || !semester || !sectionId || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing required filters" }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include the entire end date

        // 1. Fetch History Records for the range
        console.log(`[DEBUG REPORT] Fetching consolidated. Dept: ${departmentId}, Sec: ${sectionId}, Sem: ${semester}, Start: ${start.toISOString()}, End: ${end.toISOString()}`);

        const history = await prisma.attendanceHistory.findMany({
            where: {
                semester,
                sectionId,
                departmentId: departmentId || undefined,
                ...(searchParams.get("subjectId") ? { subjectId: searchParams.get("subjectId") ?? undefined } : {}),
                date: {
                    gte: start,
                    lte: end
                },
                type: "ACADEMIC" // Exclude SMS logs
            },
            select: {
                id: true,
                details: true,
                date: true,
                status: true
            }
        });

        console.log(`[DEBUG REPORT] Found ${history.length} records.`);

        // 2. Aggregate Data
        const studentStats: Record<string, {
            id: string,
            name: string,
            rollNumber: string,
            totalClasses: number,
            present: number,
            absent: number
        }> = {};

        // STRICT FETCH: Only get students mathematically enrolled in this specific class
        const students = await prisma.student.findMany({
            where: {
                year,
                semester,
                sectionId,
                departmentId: departmentId || undefined
            },
            select: { id: true, rollNumber: true, name: true },
            orderBy: { rollNumber: "asc" }
        });

        // Initialize everyone with 0
        students.forEach(s => {
            studentStats[s.rollNumber.toLowerCase()] = {
                id: s.id,
                name: s.name,
                rollNumber: s.rollNumber,
                totalClasses: 0,
                present: 0,
                absent: 0
            };
        });

        history.forEach((record, index) => {
            try {
                const details = JSON.parse(record.details);
                // details is either Full List (Manual Save) or Partial List (Marked Absent)
                // We must map it for quick lookup
                const recordStatusMap = new Map<string, string>();
                details.forEach((s: any) => {
                    // normalize keys: manual uses camelCase, bulk/old uses Title Case
                    const rollRaw = s["Roll Number"] || s["rollNumber"];
                    if (rollRaw) {
                        const roll = String(rollRaw).toLowerCase();
                        const status = s["Status"] || s["status"];
                        recordStatusMap.set(roll, status);
                    }
                });

                // Iterate over ALL students in the section to update their stats for this record
                Object.values(studentStats).forEach((stat, sIdx) => {
                    const roll = stat.rollNumber.toLowerCase();

                    // Increment total classes for everyone since the class happened for the section
                    stat.totalClasses += 1;

                    if (recordStatusMap.has(roll)) {
                        // Explicit status found
                        const status = recordStatusMap.get(roll);
                        if (status === "Present" || status === "present") {
                            stat.present += 1;
                        } else {
                            stat.absent += 1;
                        }
                    } else {
                        // Status NOT found in this record.
                        // Infer based on record.status
                        // If record was "Marked Absent", it means this list ONLY contains absentees. 
                        // So if you are not in it, you are Present.
                        if (record.status === "Marked Absent") {
                            stat.present += 1;
                        } else {
                            // For "Manual Save" or "Marked Present", missing might mean they weren't in the list then?
                            // Or imply Absent? 
                            // Creating consistency: "Manual Save" saves ALL students. If missing, student didn't exist then.
                            // If student didn't exist then, we technically shouldn't count this class for them?
                            // But we just incremented totalClasses.
                            // To be accurate: if not in details of a FULL report, decrement totalClasses back?
                            // For now, let's assume if it's not "Marked Absent", and missing, we ignore this class for this student.

                            stat.totalClasses -= 1;
                        }
                    }
                });

            } catch (e) {
                console.error("Error parsing details for record", record);
            }
        });

        const report = Object.values(studentStats).map(stat => ({
            ...stat,
            percentage: stat.totalClasses > 0
                ? ((stat.present / stat.totalClasses) * 100).toFixed(2)
                : "0.00"
        })).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

        return NextResponse.json(report);

    } catch (error) {
        console.error("Consolidated report error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
