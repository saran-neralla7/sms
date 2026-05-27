import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const academicYearId = url.searchParams.get("academicYearId");
        const departmentId = url.searchParams.get("departmentId");
        const year = url.searchParams.get("year");
        const semester = url.searchParams.get("semester");
        const sectionId = url.searchParams.get("sectionId");
        const subjectYear = url.searchParams.get("subjectYear");
        const subjectSemester = url.searchParams.get("subjectSemester");

        if (!academicYearId || !departmentId || !year || !semester) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        // Fetch students
        const studentWhere: any = {
            departmentId,
            year: year,
            semester: semester,
            isAlumni: false
        };
        if (sectionId) {
            studentWhere.sectionId = sectionId;
        }

        const students = await prisma.student.findMany({
            where: studentWhere,
            select: {
                id: true,
                rollNumber: true,
                name: true,
                section: { select: { name: true } },
                batch: { select: { name: true } }
            },
            orderBy: { rollNumber: 'asc' }
        });

        const studentIds = students.map(s => s.id);

        // Fetch Internal Marks
        const marksWhere: any = {
            academicYearId,
            studentId: { in: studentIds }
        };

        const internalMarks = await prisma.internalMark.findMany({
            where: marksWhere,
            include: {
                subject: true
            }
        });

        // Filter subjects based on historical filters if applied
        const filteredMarks = internalMarks.filter(mark => {
            if (subjectYear && subjectSemester) {
                return mark.subject.year === subjectYear && mark.subject.semester === subjectSemester;
            }
            return true;
        });

        // Group by student
        const result = students.map(student => {
            const studentMarks = filteredMarks.filter(m => m.studentId === student.id);
            const subjectsObj: any = {};
            
            studentMarks.forEach(mark => {
                const isLab = mark.subject.type?.toUpperCase() === "LAB";
                if (!subjectsObj[mark.subject.code]) {
                    subjectsObj[mark.subject.code] = isLab
                        ? { LAB: "-", subjectName: mark.subject.name, isLab: true }
                        : { MID_I: "-", MID_II: "-", subjectName: mark.subject.name, isLab: false };
                }
                subjectsObj[mark.subject.code][mark.examType] = mark.marksObtained;
            });

            return {
                id: student.id,
                rollNumber: student.rollNumber,
                name: student.name,
                sectionName: student.section?.name || "Unknown",
                batchName: student.batch?.name || "Unknown",
                marks: subjectsObj
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching internal marks:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
