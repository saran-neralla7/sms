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

        // Try to find the CourseFile matching the student's specific section first
        let courseFile = await prisma.courseFile.findUnique({
            where: {
                academicYearId_departmentId_year_semester_sectionId_subjectId: {
                    academicYearId: targetYear.id,
                    departmentId: student.departmentId,
                    year: year,
                    semester: semester,
                    sectionId: student.sectionId,
                    subjectId: subjectId
                }
            }
        });

        // If not found (e.g. for electives where mapping is global or course file is under a canonical section),
        // fetch any CourseFile for this subject in the target academic year
        if (!courseFile) {
            courseFile = await prisma.courseFile.findFirst({
                where: {
                    academicYearId: targetYear.id,
                    subjectId: subjectId
                }
            });
        }

        return NextResponse.json({
            lecturePlan: courseFile?.lecturePlan || []
        });

    } catch (error) {
        console.error("Fetch student subject lecture plan error:", error);
        return NextResponse.json({ error: "Failed to fetch lecture plan" }, { status: 500 });
    }
}
