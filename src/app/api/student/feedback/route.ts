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
            where: { id: session.user.id },
            include: { section: true }
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

        // Find active forms for this academic year
        const activeForms = await prisma.feedbackForm.findMany({
            where: {
                academicYearId: activeAcademicYear.id,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now }
            }
        });

        if (activeForms.length === 0) {
            return NextResponse.json({ forms: [] });
        }

        // Check if student has already submitted
        const formsWithStatus = await Promise.all(activeForms.map(async (form) => {
            const submission = await prisma.feedbackSubmission.findUnique({
                where: { unique_student_submission: { formId: form.id, studentId: student.id } }
            });

            if (submission) {
                return { ...form, submitted: true };
            }

            // Fetch mapped faculty for the student's section
            const mappings = await prisma.facultySubjectMapping.findMany({
                where: {
                    sectionId: student.sectionId,
                    academicYearId: activeAcademicYear.id
                },
                include: {
                    faculty: { select: { id: true, empName: true, department: { select: { code: true } } } },
                    subject: { select: { id: true, name: true, code: true } }
                }
            });

            const questions = await prisma.feedbackQuestion.findMany({
                where: { isActive: true },
                orderBy: { order: "asc" }
            });

            return { ...form, submitted: false, mappings, questions };
        }));

        return NextResponse.json({ forms: formsWithStatus });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
