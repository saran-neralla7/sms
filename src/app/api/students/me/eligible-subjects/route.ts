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
                // No result uploaded yet, so we return all subjects from this semester 
                // so the student can select their backlogs manually
                const allSubjects = await prisma.subject.findMany({
                    where: {
                        departmentId: student.departmentId,
                        year: year,
                        semester: semester
                    },
                    orderBy: { name: "asc" }
                });
                return NextResponse.json(allSubjects);
            }

            // grades is an ARRAY of { grade: string, subjectCode: string }
            // subjectCode format: "2209106 - Engineering Graphics" — we need only the code prefix before " - "
            const gradesArr: { grade: string; subjectCode: string }[] = Array.isArray(result.grades)
                ? result.grades as any[]
                : Object.entries(result.grades as Record<string, string>).map(([subjectCode, grade]) => ({ subjectCode, grade }));

            const failingGrades = ["F", "AB", "ABSENT", "FAIL"];
            const failedSubjectCodes: string[] = [];

            for (const entry of gradesArr) {
                const gradeStr = String(entry.grade).toUpperCase().trim();
                if (failingGrades.includes(gradeStr)) {
                    // Extract only the code part: "2209106 - Engineering Graphics" → "2209106"
                    const codeOnly = entry.subjectCode.includes(" - ")
                        ? entry.subjectCode.split(" - ")[0].trim()
                        : entry.subjectCode.trim();
                    failedSubjectCodes.push(codeOnly);
                }
            }

            console.log(`SUPPLY: student=${student.id} y=${year} s=${semester} failedCodes=${JSON.stringify(failedSubjectCodes)}`);

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
