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
        // (To ensure we have names for all potential subjects)
        const subjects = await prisma.subject.findMany({
            where: {
                year: student.year,
                semester: student.semester,
                departmentId: student.departmentId
            }
        });

        const subjectMap = new Map<string, string>();
        subjects.forEach(s => subjectMap.set(s.id, s.name));

        // 3. Fetch Attendance History for Student's Section
        // We only care about records that match the student's current state
        const attendanceRecords = await prisma.attendanceHistory.findMany({
            where: {
                year: student.year,
                semester: student.semester,
                sectionId: student.sectionId,
                departmentId: student.departmentId,
            },
            include: {
                subject: true
            },
            orderBy: { date: 'desc' }
        });

        // 4. Aggregate Stats
        let overallTotal = 0;
        let overallAttended = 0;

        const subjectStats: Record<string, {
            id: string;
            name: string;
            total: number;
            attended: number;
        }> = {};

        // Initialize from Subject List (to show 0/0 for subjects with no classes yet)
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

            // Should strictly be a subject-based record?
            // If subjectId is null, it might be an old record or generic.
            // For this feature, we focus on Subject-wise.
            // If unknown subject, group under "Others" or skip? 
            // Let's key by ID if possible, else Name.

            const key = subjectId || "others";
            const name = subjectId ? subjectName : "General / Lab"; // Fallback

            if (!subjectStats[key]) {
                subjectStats[key] = { id: key, name, total: 0, attended: 0 };
            }

            // Parse Details
            let isPresent = false;
            try {
                // Details is JSON string: [{ "Roll Number": "...", "Status": "Present" }, ...]
                const details = JSON.parse(record.details);
                const studentRecord = details.find((d: any) =>
                    d["Roll Number"] === student.rollNumber ||
                    d["rollNumber"] === student.rollNumber
                );

                if (studentRecord) {
                    // Check status
                    const status = String(studentRecord["Status"] || studentRecord["status"]).toLowerCase();
                    if (status === "present") {
                        isPresent = true;
                    }
                }
            } catch (e) {
                // If parse fails, assume absent or ignore? Safe to ignore.
            }

            subjectStats[key].total++;
            if (isPresent) subjectStats[key].attended++;

            // Update Overall (Only count valid classes)
            overallTotal++;
            if (isPresent) overallAttended++;
        }

        // Format Response
        const subjectList = Object.values(subjectStats).map(stat => ({
            ...stat,
            percentage: stat.total > 0 ? Math.round((stat.attended / stat.total) * 100) : 0
        })).sort((a, b) => a.name.localeCompare(b.name));

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
