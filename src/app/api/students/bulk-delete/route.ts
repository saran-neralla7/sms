import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId: userDeptId } = session.user as any;
    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { studentIds } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "Invalid student IDs" }, { status: 400 });
        }

        // Security check for HOD: Ensure all students belong to their department
        if (role === "HOD") {
            const students = await prisma.student.findMany({
                where: {
                    id: { in: studentIds },
                },
                select: { departmentId: true }
            });

            const unauthorized = students.some(s => s.departmentId !== userDeptId);
            if (unauthorized) {
                return NextResponse.json({ error: "You can only delete students from your department" }, { status: 403 });
            }
        }

        // Perform Bulk Delete
        const result = await prisma.student.deleteMany({
            where: {
                id: { in: studentIds }
            }
        });

        return NextResponse.json({ message: "Students deleted successfully", count: result.count });
    } catch (error) {
        console.error("Bulk delete error:", error);
        return NextResponse.json({ error: "Failed to delete students" }, { status: 500 });
    }
}
