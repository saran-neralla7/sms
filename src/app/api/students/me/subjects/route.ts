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

    if (!year || !semester) {
        return NextResponse.json({ error: "Missing year or semester" }, { status: 400 });
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

        // Fetch all subjects for this department, year, semester
        // (Either department core subjects OR registered electives)
        const subjects = await prisma.subject.findMany({
            where: {
                year: year,
                semester: semester,
                OR: [
                    { departmentId: student.departmentId },
                    { students: { some: { id: student.id } } }
                ]
            },
            include: {
                electiveSlotRelation: true,
                department: true
            },
            orderBy: { name: "asc" }
        });

        // For each subject, look up the faculty subject mapping for the student's section
        const subjectsWithFaculty = await Promise.all(
            subjects.map(async (subject) => {
                let mapping = await prisma.facultySubjectMapping.findFirst({
                    where: {
                        subjectId: subject.id,
                        sectionId: student.sectionId,
                        academicYearId: targetYear.id
                    },
                    include: {
                        faculty: true
                    }
                });

                if (!mapping && subject.isElective) {
                    mapping = await prisma.facultySubjectMapping.findFirst({
                        where: {
                            subjectId: subject.id,
                            academicYearId: targetYear.id
                        },
                        include: {
                            faculty: true
                        }
                    });
                }

                return {
                    ...subject,
                    faculty: mapping?.faculty ? {
                        id: mapping.faculty.id,
                        empName: mapping.faculty.empName,
                        empCode: mapping.faculty.empCode,
                        email: mapping.faculty.email
                    } : null
                };
            })
        );

        return NextResponse.json(subjectsWithFaculty);

    } catch (error) {
        console.error("Fetch student subjects error:", error);
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}
