import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== "STUDENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const student = await prisma.student.findUnique({
            where: { rollNumber: session.user.username as string },
            include: { section: true, batch: true }
        });

        if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

        const now = new Date();

        // Find active academic year
        const activeAcademicYear = await prisma.academicYear.findFirst({
            where: { isCurrent: true }
        });

        if (!activeAcademicYear) {
            return NextResponse.json({ forms: [] });
        }

        // Find active forms for this academic year, targeted at this student's section, year, and semester
        const activeForms = await prisma.feedbackForm.findMany({
            where: {
                academicYearId: activeAcademicYear.id,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
                targetSections: {
                    some: {
                        id: student.sectionId
                    }
                },
                // Filter by student's department if set on the form
                OR: [
                    { targetDepartmentId: null },
                    { targetDepartmentId: student.departmentId }
                ],
                // AND filter by student's batch if set on the form
                AND: [
                    {
                        OR: [
                            { targetBatchId: null },
                            { targetBatchId: student.batchId }
                        ]
                    }
                ]
            },
            include: {
                template: {
                    include: {
                        questions: { orderBy: { order: "asc" }, where: { isActive: true } }
                    }
                }
            }
        });

        // Further filter: if targetYear or targetSemester is set on form, student must match
        const filteredForms = activeForms.filter((f: any) =>
            (f.targetYear === null || f.targetYear === parseInt(String(student.year))) &&
            (f.targetSemester === null || f.targetSemester === parseInt(String(student.semester)))
        );

        if (filteredForms.length === 0) {
            return NextResponse.json({ forms: [] });
        }

        // Check if student has already submitted
        const formsWithStatus = await Promise.all(filteredForms.map(async (form: any) => {
            const submission = await prisma.feedbackSubmission.findUnique({
                where: { unique_student_submission: { formId: form.id, studentId: student.id } }
            });

            if (submission) {
                return { ...form, submitted: true };
            }

            let mappings: any[] = [];
            
            if (form.template?.type === "FACULTY_MAPPED") {
                // Fetch mapped faculty for the student's EXACT section, year, semester, academic year
                mappings = await prisma.facultySubjectMapping.findMany({
                    where: {
                        sectionId: student.sectionId,
                        academicYearId: activeAcademicYear.id,
                        subject: {
                            departmentId: student.departmentId,
                            year: String(student.year),
                            semester: String(student.semester)
                        }
                    },
                    include: {
                        faculty: { select: { id: true, empName: true, photoUrl: true, department: { select: { code: true } } } },
                        subject: { select: { id: true, name: true, code: true } }
                    }
                });
            }

            return { ...form, submitted: false, mappings, questions: form.template?.questions || [] };
        }));

        return NextResponse.json({ 
            forms: formsWithStatus,
            studentInfo: { 
                year: student.year, 
                semester: student.semester,
                batch: student.batchString || student.batch?.name || "N/A"
            },
            academicYear: activeAcademicYear.name
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
