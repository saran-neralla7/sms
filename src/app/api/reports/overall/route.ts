import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!year || !semester || !sectionId || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing filters" }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);

        // 1. Fetch all subjects for this context
        const subjects = await prisma.subject.findMany({
            where: {
                year,
                semester,
                departmentId: departmentId || undefined
            },
            orderBy: { name: 'asc' }
        });

        // 2. Fetch all students in the section
        const students = await prisma.student.findMany({
            where: {
                year,
                semester,
                sectionId,
                departmentId: departmentId || undefined
            },
            orderBy: { rollNumber: 'asc' },
            select: { id: true, rollNumber: true, name: true }
        });

        // 3. Fetch all history records for this range
        const history = await prisma.attendanceHistory.findMany({
            where: {
                sectionId,
                date: { gte: start, lte: end },
                user: { role: { not: "USER" } }
            },
            include: { subject: true }
        });

        // Data Structure: 
        // studentStats = { [studentId]: { details: student, subjects: { [subjectId]: { present: 0, total: 0 } } } }
        // subjectTotals = { [subjectId]: totalClasses } (Wait, total classes depends on if the class happened for the section)

        // Actually, total classes per subject is simply the count of history records for that subject.
        // HOWEVER, electives are tricky. 
        // If "BDA" happened, it counts as a class for the SECTION, but only ENROLLED students should be penalized?
        // OR: Total Classes = Count of history records where subjectId = X.
        // Present = Count where student is marked present.
        // OR: Total Classes = Count where student is marked present.

        // FOR ELECTIVES:
        // Ideally, we should check if the student is enrolled.
        // But for this report, simplicity is key.
        // Let's iterate history records.

        // Calculate Global Subject Totals (How many times was this subject taught?)
        // And Per-Student Attendance

        const subjectTotals: Record<string, number> = {};
        subjects.forEach(s => subjectTotals[s.name] = 0);

        // Init Student Map
        const studentMap: Record<string, any> = {};
        students.forEach(s => {
            studentMap[s.rollNumber] = {
                rollNumber: s.rollNumber,
                name: s.name,
                subjects: {} // { [subjectName]: presentCount }
            };
            subjects.forEach(sub => {
                studentMap[s.rollNumber].subjects[sub.name] = 0;
            });
        });

        history.forEach(record => {
            if (!record.subjectId || !record.subject) return;
            const subName = record.subject.name;

            // Increment global total for this subject
            if (subjectTotals[subName] !== undefined) {
                subjectTotals[subName] += 1;
            }

            try {
                const details = JSON.parse(record.details);
                details.forEach((s: any) => {
                    const roll = s["Roll Number"];
                    if (studentMap[roll]) {
                        if (studentMap[roll].subjects[subName] === undefined) {
                            studentMap[roll].subjects[subName] = 0;
                        }

                        // We only count PRESENT classes now
                        if (s["Status"] === "Present") {
                            studentMap[roll].subjects[subName] += 1;
                        }
                    }
                });
            } catch (e) {
                console.error("Error parsing history details", e);
            }
        });

        // Format subjects array to include total
        const subjectResponse = subjects.map(s => ({
            name: s.name,
            total: subjectTotals[s.name] || 0
        }));

        return NextResponse.json({
            subjects: subjectResponse,
            students: Object.values(studentMap)
        });

    } catch (error) {
        console.error("Overall Report Error:", error);
        return NextResponse.json({ error: "Failed to generate Overall Report" }, { status: 500 });
    }
}
