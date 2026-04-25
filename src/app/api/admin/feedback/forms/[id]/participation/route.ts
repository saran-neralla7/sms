import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id: formId } = await context.params;

        // Get the form with its targeted sections
        const form = await prisma.feedbackForm.findUnique({
            where: { id: formId },
            include: {
                targetSections: { select: { id: true, name: true } },
                submissions: { select: { studentId: true } }
            }
        });

        if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

        const formData = form as any;

        const submittedStudentIds = new Set(form.submissions.map((s: any) => s.studentId));
        const targetSectionIds = form.targetSections.map((s: any) => s.id);

        // Build student filter - only show students in targeted sections AND matching year/semester/department
        const studentFilter: any = {
            sectionId: { in: targetSectionIds }
        };
        if (formData.targetYear) studentFilter.year = String(formData.targetYear);
        if (formData.targetSemester) studentFilter.semester = String(formData.targetSemester);
        if (formData.targetDepartmentId) studentFilter.departmentId = formData.targetDepartmentId;
        if (formData.targetBatchId) studentFilter.batchId = formData.targetBatchId;

        // Get only students in the targeted sections with matching year/semester
        const students = await prisma.student.findMany({
            where: studentFilter,
            include: {
                section: { select: { name: true } }
            },
            orderBy: [{ sectionId: "asc" }, { rollNumber: "asc" }]
        });

        const submitted = students.filter((s: any) => submittedStudentIds.has(s.id));
        const pending = students.filter((s: any) => !submittedStudentIds.has(s.id));

        return NextResponse.json({
            formTitle: form.title,
            totalStudents: students.length,
            submittedCount: submitted.length,
            pendingCount: pending.length,
            submitted: submitted.map((s: any) => ({
                id: s.id,
                rollNumber: s.rollNumber,
                name: s.studentName,
                section: s.section?.name,
                year: s.year,
                semester: s.semester
            })),
            pending: pending.map((s: any) => ({
                id: s.id,
                rollNumber: s.rollNumber,
                name: s.studentName,
                section: s.section?.name,
                year: s.year,
                semester: s.semester
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
