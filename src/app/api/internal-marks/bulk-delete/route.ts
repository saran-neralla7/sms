import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { academicYearId, departmentId, year, semester, sectionId, subjectYear, subjectSemester } = body;

        if (!academicYearId || !departmentId || !year || !semester || !sectionId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Verify the user permissions for HOD
        if (role === "HOD") {
            const userDept = (session.user as any).departmentId;
            if (userDept !== departmentId) {
                return NextResponse.json({ error: "You can only delete marks for your department" }, { status: 403 });
            }
        }

        // 1. Fetch Students matching the classroom constraints
        const students = await prisma.student.findMany({
            where: { departmentId, year, semester, sectionId },
            select: { id: true }
        });
        const studentIds = students.map(s => s.id);

        if (studentIds.length === 0) {
            return NextResponse.json({ error: "No students found matching the filters" }, { status: 404 });
        }

        // 2. Fetch Subjects matching the period constraints
        const subjects = await prisma.subject.findMany({
            where: { departmentId, year: subjectYear || year, semester: subjectSemester || semester },
            select: { id: true }
        });
        const subjectIds = subjects.map(s => s.id);

        if (subjectIds.length === 0) {
            return NextResponse.json({ error: "No subjects found matching the filters" }, { status: 404 });
        }

        // 3. Perform Bulk Deletion
        const res = await prisma.internalMark.deleteMany({
            where: {
                studentId: { in: studentIds },
                subjectId: { in: subjectIds },
                academicYearId: academicYearId
            }
        });

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    action: "BULK_DELETE_INTERNAL_MARKS",
                    entity: "InternalMark",
                    details: JSON.stringify({ 
                        recordsDeleted: res.count, 
                        departmentId, year, semester, sectionId 
                    }),
                    performedBy: session.user.id
                }
            });
        } catch (e) {
            console.error("Failed to log internal marks bulk delete audit", e);
        }

        return NextResponse.json({
            success: true,
            recordsDeleted: res.count
        });

    } catch (error: any) {
        console.error("Bulk Delete Error:", error);
        return NextResponse.json({ error: error.message || "Failed to process bulk deletion" }, { status: 500 });
    }
}
