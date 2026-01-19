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
        const allSubjects = await prisma.subject.findMany({
            where: { departmentId, year, semester },
            select: { code: true, name: true, isElective: true },
            orderBy: { code: 'asc' }
        });

        const coreSubjects = allSubjects.filter(s => !s.isElective);
        const hasElectives = allSubjects.some(s => s.isElective);

        // 2. Fetch Students
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
                subjects: true, // Fetch allocated subjects (for identifying their elective)
                results: {
                    where: { year, semester } // Results for the specific EXAM year/sem
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        // 3. Construct Data Rows
        const rows = students.map(student => {
            const result = student.results[0];
            const grades = (result?.grades as any[]) || [];

            const row: any = {
                "Roll Number": student.rollNumber,
                "Name": student.name,
                "SGPA": result?.sgpa || "",
                "CGPA": result?.cgpa || ""
            };

            // Process Core Subjects
            coreSubjects.forEach(sub => {
                const gradeEntry = grades.find(g => g.subjectCode === sub.code);
                // Header Format: "Code - Name"
                row[`${sub.code} - ${sub.name}`] = gradeEntry ? gradeEntry.grade : "";
            });

            // Process Generic Elective Column
            if (hasElectives) {
                // Find which elective subject this student is taking
                const studentElective = student.subjects.find(s =>
                    allSubjects.some(asm => asm.isElective && asm.code === s.code)
                );

                if (studentElective) {
                    const gradeEntry = grades.find(g => g.subjectCode === studentElective.code);
                    row["ELECTIVE"] = gradeEntry ? gradeEntry.grade : "";
                } else {
                    row["ELECTIVE"] = "";
                }
            }

            return row;
        });

        // Construct Headers
        const subjectHeaders = coreSubjects.map(s => `${s.code} - ${s.name}`);
        if (hasElectives) subjectHeaders.push("ELECTIVE");

        return NextResponse.json({
            subjects: subjectHeaders,
            rows
        });

    } catch (error) {
        console.error("Template Generation Error:", error);
        return NextResponse.json({ error: "Failed to generate template data" }, { status: 500 });
    }
}
