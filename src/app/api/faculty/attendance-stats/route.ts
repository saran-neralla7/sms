import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role;
        const userId = session.user.id;
        const username = session.user.username;

        const { searchParams } = new URL(req.url);
        const subjectId = searchParams.get("subjectId");
        const sectionId = searchParams.get("sectionId");
        let academicYearId = searchParams.get("academicYearId");

        if (!subjectId || !sectionId) {
            return NextResponse.json({ error: "Missing subjectId or sectionId" }, { status: 400 });
        }

        // Fetch academic year from cookies if not provided
        if (!academicYearId) {
            const cookieStore = await cookies();
            academicYearId = cookieStore.get("academic-year-id")?.value || null;
            if (!academicYearId) {
                const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
                if (currentYear) academicYearId = currentYear.id;
            }
        }

        // Role-based Access Control Validation
        if (role === "FACULTY") {
            // Verify if faculty is mapped to this subject and section
            const mapping = await prisma.facultySubjectMapping.findFirst({
                where: {
                    faculty: { user: { username: username } },
                    subjectId,
                    sectionId,
                    academicYearId: academicYearId || undefined
                }
            });
            if (!mapping) {
                return NextResponse.json({ error: "Access Denied: You are not assigned to this subject/section." }, { status: 403 });
            }
        } else if (role === "HOD") {
            // HOD can only view mappings belonging to their department
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { departmentId: true }
            });
            const subject = await prisma.subject.findUnique({
                where: { id: subjectId },
                select: { departmentId: true }
            });
            if (!dbUser || !subject || dbUser.departmentId !== subject.departmentId) {
                return NextResponse.json({ error: "Access Denied: You can only view statistics for subjects in your department." }, { status: 403 });
            }
        } else if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
            return NextResponse.json({ error: "Access Denied: Unauthorized role." }, { status: 403 });
        }

        // Fetch mapped faculty details for this subject/section
        const mappings = await prisma.facultySubjectMapping.findMany({
            where: {
                subjectId,
                sectionId,
                academicYearId: academicYearId || undefined
            },
            include: {
                faculty: {
                    select: {
                        empName: true,
                        photoUrl: true,
                        empCode: true,
                        designation: true
                    }
                }
            }
        });

        const mappedFaculty = mappings.map(m => ({
            name: m.faculty.empName,
            photoUrl: m.faculty.photoUrl,
            empCode: m.faculty.empCode,
            designation: m.faculty.designation
        }));

        // Fetch all attendance records
        const records = await prisma.attendanceHistory.findMany({
            where: {
                subjectId,
                sectionId,
                academicYearId: academicYearId || undefined
            },
            include: {
                period: true
            },
            orderBy: [
                { date: "asc" },
                { period: { order: "asc" } }
            ]
        });

        if (records.length === 0) {
            return NextResponse.json({
                totalSessions: 0,
                overallAttendanceRate: 0,
                trendData: [],
                dayOfWeekData: [],
                studentsStats: [],
                dailyLogs: [],
                mappedFaculty
            });
        }

        // Aggregation tables
        const studentMap = new Map<string, { name: string; present: number; absent: number; total: number }>();
        const trendData: any[] = [];
        const dailyLogs: any[] = [];
        
        // Day of Week totals
        // index 0 = Sun, 1 = Mon, ..., 6 = Sat
        const dayOfWeekTotals = Array.from({ length: 7 }, () => ({ totalPresent: 0, totalAbsent: 0, count: 0 }));

        for (const record of records) {
            let presentCount = 0;
            let absentCount = 0;
            const absentStudents: any[] = [];

            try {
                const studentsList = JSON.parse(record.details || "[]");
                for (const s of studentsList) {
                    const roll = s["Roll Number"];
                    const name = s["Name"];
                    const status = s["Status"] || "Absent";

                    const current = studentMap.get(roll) || { name, present: 0, absent: 0, total: 0 };
                    if (status === "Present") {
                        current.present++;
                        presentCount++;
                    } else {
                        current.absent++;
                        absentCount++;
                        absentStudents.push({ rollNumber: roll, name });
                    }
                    current.total++;
                    studentMap.set(roll, current);
                }
            } catch (e) {
                console.error("Failed to parse attendance details JSON:", e);
            }

            const totalInSession = presentCount + absentCount;
            const rate = totalInSession > 0 ? Math.round((presentCount / totalInSession) * 100) : 0;

            const dateObj = new Date(record.date);
            const dayOfWeek = dateObj.getDay();

            // Accumulate for day of week average
            if (totalInSession > 0) {
                dayOfWeekTotals[dayOfWeek].totalPresent += presentCount;
                dayOfWeekTotals[dayOfWeek].totalAbsent += absentCount;
                dayOfWeekTotals[dayOfWeek].count++;
            }

            const sessionInfo = {
                id: record.id,
                date: record.date.toISOString().split("T")[0],
                periodName: record.period?.name || "N/A",
                startTime: record.period?.startTime || "",
                endTime: record.period?.endTime || "",
                presentCount,
                absentCount,
                totalStudents: totalInSession,
                attendanceRate: rate,
                topicsTaught: record.topicsTaught || ""
            };

            trendData.push({
                date: sessionInfo.date,
                period: sessionInfo.periodName,
                rate: sessionInfo.attendanceRate
            });

            dailyLogs.push({
                ...sessionInfo,
                absentees: absentStudents
            });
        }

        // Convert student map to sorted array
        const studentsStats = Array.from(studentMap.entries()).map(([rollNumber, stats]) => {
            const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
            return {
                rollNumber,
                name: stats.name,
                present: stats.present,
                absent: stats.absent,
                total: stats.total,
                rate
            };
        }).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

        // Format day of week data
        const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayOfWeekData = dayOfWeekTotals.map((day, idx) => {
            const total = day.totalPresent + day.totalAbsent;
            const rate = total > 0 ? Math.round((day.totalPresent / total) * 100) : 0;
            return {
                day: weekdays[idx],
                rate,
                sessions: day.count
            };
        }).filter(d => d.sessions > 0); // Only return days with classes

        // Overall stats
        const totalSessions = records.length;
        const totalPresentAll = studentsStats.reduce((acc, s) => acc + s.present, 0);
        const totalPossibleAll = studentsStats.reduce((acc, s) => acc + s.total, 0);
        const overallAttendanceRate = totalPossibleAll > 0 ? Math.round((totalPresentAll / totalPossibleAll) * 100) : 0;

        return NextResponse.json({
            totalSessions,
            overallAttendanceRate,
            trendData,
            dayOfWeekData,
            studentsStats,
            dailyLogs,
            mappedFaculty
        });

    } catch (error) {
        console.error("Attendance Stats API Error:", error);
        return NextResponse.json({ error: "Failed to generate attendance statistics" }, { status: 500 });
    }
}
