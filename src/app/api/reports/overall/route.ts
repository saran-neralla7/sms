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
                date: { gte: start, lte: end }
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

        // FOR ELECTIVES:
        // Ideally, we should check if the student is enrolled.
        // But for this report, simplicity is key.
        // Let's iterate history records.

        const subjectStats: Record<string, { id: string, name: string, totalClasses: number }> = {};
        subjects.forEach(s => {
            subjectStats[s.id] = { id: s.id, name: s.name, totalClasses: 0 };
        });

        // Init Student Map
        const studentMap: Record<string, any> = {};
        students.forEach(s => {
            studentMap[s.rollNumber] = {
                rollNumber: s.rollNumber,
                name: s.name,
                subjects: {} // will store { [subjectName]: { present: 0, total: 0 } }
            };
            // Init subjects for student
            subjects.forEach(sub => {
                studentMap[s.rollNumber].subjects[sub.name] = { present: 0, total: 0 };
            });
        });

        // Process History
        history.forEach(record => {
            if (!record.subjectId) return; // Skip records without subject
            const subName = record.subject?.name;
            if (!subName) return;

            // Increment global total for this subject (for this section)
            // But wait, if it's an elective, does "total classes" mean simplified total?
            // Yes, let's assume if the record exists, the class happened.
            // Note: Parallel electives might mean BDA=20 classes, ML=18 classes. This is fine.

            // We need to know which students were "supposed" to be there.
            // If the record has a list of students (Manual Save), we can use that?
            // Or just check if the student is in the JSON?

            try {
                const details = JSON.parse(record.details);
                // details is the list of students involved in this specific class.
                // If it's an elective, only enrolled students are in `details` (usually).
                // If it's core, everyone is in `details`.

                // So, for every student in `details`, we increment their "Subject Total".
                // And if status is Present, we increment "Subject Present".

                details.forEach((s: any) => {
                    const roll = s["Roll Number"];
                    if (studentMap[roll]) {
                        // Init if missing (e.g. subject name diff?)
                        if (!studentMap[roll].subjects[subName]) {
                            studentMap[roll].subjects[subName] = { present: 0, total: 0 };
                        }

                        const stats = studentMap[roll].subjects[subName];
                        stats.total += 1;
                        if (s["Status"] === "Present") {
                            stats.present += 1;
                        }
                    }
                });

            } catch (e) {
                console.error("Error parsing history details", e);
            }
        });

        return NextResponse.json({
            subjects: subjects.map(s => s.name),
            students: Object.values(studentMap)
        });

    } catch (error) {
        console.error("Overall Report Error:", error);
        return NextResponse.json({ error: "Failed to generate Overall Report" }, { status: 500 });
    }
}
