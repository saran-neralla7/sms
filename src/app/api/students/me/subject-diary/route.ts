import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "STUDENT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");

    if (!subjectId || !year || !semester) {
        return NextResponse.json({ error: "Missing required parameters: subjectId, year, semester" }, { status: 400 });
    }

    try {
        const username = (session.user as any).username;
        const student = await prisma.student.findUnique({
            where: { rollNumber: username }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Get the active academic year
        const activeYear = await prisma.academicYear.findFirst({
            where: { isCurrent: true }
        });

        if (!activeYear) {
            return NextResponse.json({ error: "Active academic year not found" }, { status: 500 });
        }

        // Resolve target academic year based on student's batch and requested year
        let targetYear = activeYear;
        if (student.batchId) {
            const studentBatch = await prisma.batch.findUnique({
                where: { id: student.batchId }
            });
            if (studentBatch && studentBatch.startYear) {
                const reqYearInt = parseInt(year);
                if (!isNaN(reqYearInt)) {
                    const startYearNum = studentBatch.startYear;
                    const calculatedStart = startYearNum + reqYearInt - 1;
                    const calculatedEnd = startYearNum + reqYearInt;
                    const targetYearName = `${calculatedStart}-${calculatedEnd}`;
                    
                    const foundYear = await prisma.academicYear.findUnique({
                        where: { name: targetYearName }
                    });
                    if (foundYear) {
                        targetYear = foundYear;
                    }
                }
            }
        }

        // Fetch all attendance records (representing class periods conducted) for this section & subject
        const attendanceRecords = await prisma.attendanceHistory.findMany({
            where: {
                academicYearId: targetYear.id,
                subjectId: subjectId,
                sectionId: student.sectionId,
                year: year,
                semester: semester
            },
            include: {
                period: true
            },
            orderBy: {
                date: "asc"
            }
        });

        const diaryAndAttendance = attendanceRecords.map((record) => {
            let status = "N/A";
            try {
                const detailsList = JSON.parse(record.details || "[]");
                const studentEntry = detailsList.find((d: any) => {
                    const roll = d["Roll Number"] || d.rollNumber;
                    return roll && String(roll).toLowerCase() === String(student.rollNumber).toLowerCase();
                });
                if (studentEntry) {
                    status = studentEntry["Status"] || studentEntry.status || "Absent";
                }
            } catch (e) {
                console.error("Error parsing attendance details for record:", record.id, e);
            }

            return {
                id: record.id,
                date: record.date.toISOString().split("T")[0],
                period: record.period ? {
                    name: record.period.name,
                    startTime: record.period.startTime,
                    endTime: record.period.endTime
                } : null,
                topicsTaught: record.topicsTaught || null,
                facultyAddedDiary: !!record.topicsTaught && record.topicsTaught.trim().length > 0,
                status: status
            };
        });

        return NextResponse.json(diaryAndAttendance);

    } catch (error) {
        console.error("Fetch student subject diary error:", error);
        return NextResponse.json({ error: "Failed to fetch subject diary" }, { status: 500 });
    }
}
