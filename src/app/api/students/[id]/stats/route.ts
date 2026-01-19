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
        const url = new URL(request.url);
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");

        // 1. Fetch Student Details
        const student = await prisma.student.findUnique({
            where: { id },
            include: {
                section: true,
                department: true,
            }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // 2. Fetch All Subjects for this Student's Context
        const subjects = await prisma.subject.findMany({
            where: {
                year: student.year,
                semester: student.semester,
                departmentId: student.departmentId
            }
        });

        const subjectMap = new Map<string, string>();
        subjects.forEach(s => subjectMap.set(s.id, s.name));

        // 3. Build Where Clause
        const whereClause: any = {
            year: student.year,
            semester: student.semester,
            sectionId: student.sectionId,
            departmentId: student.departmentId,
        };

        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) // Include end of day
            };
        }

        // 4. Fetch Attendance History
        const attendanceRecords = await prisma.attendanceHistory.findMany({
            where: whereClause,
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
            try {
                const details = JSON.parse(record.details);
                const studentRecord = details.find((d: any) =>
                    d["Roll Number"] === student.rollNumber ||
                    d["rollNumber"] === student.rollNumber
                );

                if (studentRecord) {
                    const status = String(studentRecord["Status"] || studentRecord["status"]).toLowerCase();
                    if (status === "present") {
                        isPresent = true;
                    }
                }
            } catch (e) {
                // Ignore parse errors
            }

            subjectStats[key].total++;
            if (isPresent) subjectStats[key].attended++;

            overallTotal++;
            if (isPresent) overallAttended++;
        }

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
            subjects: subjectList
        });

    } catch (error) {
        console.error("Stats Error:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
