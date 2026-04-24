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
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const type = searchParams.get("type"); // "REGULAR" or "SUPPLY"

    if (!year || !semester || !type) {
        return NextResponse.json({ error: "Missing year, semester, or type" }, { status: 400 });
    }

    try {
        const username = (session.user as any).username;
        const student = await prisma.student.findUnique({
            where: { rollNumber: username }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        if (type === "REGULAR") {
            // Fetch all subjects for this department, year, semester
            const subjects = await prisma.subject.findMany({
                where: {
                    departmentId: student.departmentId,
                    year: year,
                    semester: semester
                },
                orderBy: { name: "asc" }
            });
            return NextResponse.json(subjects);
        } else if (type === "SUPPLY") {
            // Fetch the result for this year and semester
            const result = await prisma.semesterResult.findUnique({
                where: {
                    studentId_year_semester: {
                        studentId: student.id,
                        year: year,
                        semester: semester
                    }
                }
            });

            if (!result || !result.grades) {
                // No result uploaded yet, so no supply subjects available to show
                return NextResponse.json([]);
            }

            // Grades is typically a JSON object like {"Code": "Grade", "Code2": "F"}
            // E.g. {"CSM1201": "O", "CSM1202": "F", "CSM1203": "AB"}
            const gradesObj = typeof result.grades === "string" ? JSON.parse(result.grades) : result.grades;
            const failingGrades = ["F", "AB", "ABSENT", "FAIL"];
            const failedSubjectCodes: string[] = [];

            for (const [code, grade] of Object.entries(gradesObj)) {
                const gradeStr = String(grade).toUpperCase().trim();
                if (failingGrades.includes(gradeStr)) {
                    failedSubjectCodes.push(code);
                }
            }

            if (failedSubjectCodes.length === 0) {
                return NextResponse.json([]); // No failed subjects
            }

            // Fetch the subject details for the failed codes
            const failedSubjects = await prisma.subject.findMany({
                where: {
                    code: { in: failedSubjectCodes },
                    departmentId: student.departmentId,
                    year: year,
                    semester: semester
                },
                orderBy: { name: "asc" }
            });

            return NextResponse.json(failedSubjects);
        } else {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }
    } catch (error) {
        console.error("Eligible subjects error:", error);
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}
