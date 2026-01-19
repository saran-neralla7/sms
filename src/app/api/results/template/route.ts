import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "USER") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const studentYear = searchParams.get("studentYear"); // Optional: The CURRENT year of the students
    const targetSectionIds = searchParams.get("sectionIds")?.split(",") || [];

    if (!departmentId || !year || !semester) {
        return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    try {
        // 1. Fetch Subjects for the EXAM Context (Result Year/Sem)
        const subjects = await prisma.subject.findMany({
            where: {
                departmentId,
                year,
                semester
            },
            select: { code: true, name: true },
            orderBy: { code: 'asc' }
        });

        // 2. Fetch Students
        // If studentYear is provided, we fetch students currently in that year.
        // Otherwise, we assume the student's current year matches the exam year.
        const whereStudent: any = {
            departmentId,
            year: studentYear || year,
        };

        if (targetSectionIds.length > 0) {
            whereStudent.sectionId = { in: targetSectionIds };
        }

        const students = await prisma.student.findMany({
            where: whereStudent,
            include: {
                results: {
                    where: { year, semester } // Results for the specific EXAM year/sem
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        // 3. Construct Data Rows
        const rows = students.map(student => {
            const result = student.results[0]; // Should be only one for this year/sem
            const grades = (result?.grades as any[]) || [];

            const row: any = {
                "Roll Number": student.rollNumber,
                "Name": student.name,
                "SGPA": result?.sgpa || "",
                "CGPA": result?.cgpa || ""
            };

            // Pre-fill grades if they exist
            subjects.forEach(sub => {
                const gradeEntry = grades.find(g => g.subjectCode === sub.code);
                row[sub.code] = gradeEntry ? gradeEntry.grade : "";
            });

            return row;
        });

        return NextResponse.json({
            subjects: subjects.map(s => s.code),
            rows
        });

    } catch (error) {
        console.error("Template Generation Error:", error);
        return NextResponse.json({ error: "Failed to generate template data" }, { status: 500 });
    }
}
