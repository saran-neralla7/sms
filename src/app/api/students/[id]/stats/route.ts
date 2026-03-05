import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { id } = await params;

        // Fetch Student
        const student = await prisma.student.findUnique({
            where: { id: id }, // Assuming ID is UUID. If rollNumber passed as ID, adjust. Current route is [id], usually ID.
            include: { department: true }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const url = new URL(request.url);
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        const targetYear = url.searchParams.get("year") || student.year;
        const targetSemester = url.searchParams.get("semester") || student.semester;

        // 2. Fetch All Subjects for this Student's Context (Current or Past)
        let subjects = await prisma.subject.findMany({
            where: {
                year: targetYear,
                semester: targetSemester,
                departmentId: student.departmentId
            }
        });

        // ... sub filtering ...

        const subjectMap = new Map<string, string>();
        subjects.forEach(s => subjectMap.set(s.id, s.name));

        // 3. Build Where Clause
        // If we are looking at the current year/sem, we can optimize with sectionId.
        // If looking at past, we ignore sectionId to account for section changes/merges.
        const isCurrentContext = targetYear === student.year && targetSemester === student.semester;

        const whereClause: any = {
            year: targetYear,
            semester: targetSemester,
            departmentId: student.departmentId,
        };

        if (isCurrentContext) {
            whereClause.sectionId = student.sectionId;
        }

        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) // Include end of day
            };
        }

        // 4. Fetch Attendance History
        const attendanceRecords = await prisma.attendanceHistory.findMany({
            where: {
                ...whereClause,
                user: { role: { not: "USER" } }, // Exclude SMS/Notification attendance (redundant if using type, but safe)
                type: "ACADEMIC"
            },
            include: {
                subject: true
            },
            orderBy: { date: 'desc' }
        });

        // 5. Aggregate Stats
        let overallTotal = 0;
        let overallAttended = 0;

        const subjectStats: Record<string, {
            id: string;
            name: string;
            total: number;
            attended: number;
        }> = {};

        // Initialize from Subject List
        subjects.forEach(sub => {
            subjectStats[sub.id] = {
                id: sub.id,
                name: sub.name,
                total: 0,
                attended: 0
            };
        });

        for (const record of attendanceRecords) {
            const subjectId = record.subjectId;
            const subjectName = record.subject?.name || subjectMap.get(record.subjectId || "") || "Unknown Subject";

            const key = subjectId || "unassigned";
            const name = subjectId ? subjectName : "Unassigned"; // Fallback Renamed

            if (!subjectStats[key]) {
                subjectStats[key] = { id: key, name, total: 0, attended: 0 };
            }

            // Parse Details
            let isPresent = false;
            let recordAppliesToStudent = false;

            try {
                const details = JSON.parse(record.details);
                const studentRecord = details.find((d: any) =>
                    d["Roll Number"] === student.rollNumber ||
                    d["rollNumber"] === student.rollNumber
                );

                if (studentRecord) {
                    recordAppliesToStudent = true;
                    // Check status
                    const status = String(studentRecord["Status"] || studentRecord["status"]).toLowerCase();
                    if (status === "present") {
                        isPresent = true;
                    }
                } else {
                    // Student not in list. 
                    // Case: Record is type "Marked Absent" (Only absentees saved).
                    // If so, student is implied Present.
                    // Note: 'status' field on record tells us the mode.
                    if (record.status === "Marked Absent") {
                        recordAppliesToStudent = true;
                        isPresent = true;
                    }
                    // Else: "Manual Save" or "Marked Present" (Full list saved).
                    // If missing from full list, they were not part of this class (e.g. Lab Batch or Wrong Dept).
                    // keep recordAppliesToStudent = false
                }
            } catch (e) {
                // Ignore parse errors, assume doesn't apply? Or count as total but not present?
                // Safer to ignore to prevent inflation.
            }

            if (recordAppliesToStudent) {
                subjectStats[key].total++;
                if (isPresent) subjectStats[key].attended++;

                overallTotal++;
                if (isPresent) overallAttended++;
            }
        }

        // 6. Calculate Monthly Trend
        const monthlyStats: Record<string, { total: number; attended: number; date: Date }> = {};

        for (const record of attendanceRecords) {
            const date = new Date(record.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`; // e.g. "2025-0" for Jan 2025

            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = { total: 0, attended: 0, date: date };
            }

            // Re-check student status for this record (optimization: could store earlier)
            let isPresent = false;
            let recordAppliesToStudent = false;

            try {
                const details = JSON.parse(record.details);
                const studentRecord = details.find((d: any) =>
                    d["Roll Number"] === student.rollNumber ||
                    d["rollNumber"] === student.rollNumber
                );

                if (studentRecord) {
                    recordAppliesToStudent = true;
                    const status = String(studentRecord["Status"] || studentRecord["status"]).toLowerCase();
                    if (status === "present") isPresent = true;
                } else {
                    if (record.status === "Marked Absent") {
                        recordAppliesToStudent = true;
                        isPresent = true;
                    }
                }
            } catch (e) { }

            if (recordAppliesToStudent) {
                monthlyStats[monthKey].total++;
                if (isPresent) monthlyStats[monthKey].attended++;
            }
        }

        const monthlyTrend = Object.values(monthlyStats)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(stat => {
                const percentage = stat.total > 0 ? Math.round((stat.attended / stat.total) * 100) : 0;
                return {
                    month: stat.date.toLocaleString('default', { month: 'short', year: 'numeric' }), // "Jan 2025"
                    percentage,
                    total: stat.total,
                    attended: stat.attended
                };
            });

        // Format Response
        const subjectList = Object.values(subjectStats).map(stat => ({
            ...stat,
            percentage: stat.total > 0 ? Math.round((stat.attended / stat.total) * 100) : 0
        })).sort((a, b) => {
            if (a.name === "Unassigned") return 1; // Unassigned at bottom
            if (b.name === "Unassigned") return -1;
            return a.name.localeCompare(b.name);
        });

        const overallPercentage = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0;

        return NextResponse.json({
            overall: {
                total: overallTotal,
                attended: overallAttended,
                percentage: overallPercentage
            },
            subjects: subjectList,
            monthlyTrend
        });

    } catch (error) {
        console.error("Stats Error:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
