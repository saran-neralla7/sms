import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user.role || "").toUpperCase();
    if (role === "USER") {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { sectionId, startDate, endDate } = body;

        if (!sectionId || !startDate || !endDate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // Adjust end date to include the full day (end of day)
        end.setHours(23, 59, 59, 999);

        // RBAC Check
        if (role === "HOD") {
            const userDept = (session.user as any).departmentId;
            const section = await prisma.section.findUnique({
                where: { id: sectionId },
                include: { departments: true }
            });

            if (!section || !section.departments.some(d => d.id === userDept)) {
                return NextResponse.json({ error: "Access Denied" }, { status: 403 });
            }
        }

        const deleteResult = await prisma.attendanceHistory.deleteMany({
            where: {
                sectionId: sectionId,
                date: {
                    gte: start,
                    lte: end
                }
            }
        });

        return NextResponse.json({
            success: true,
            deletedCount: deleteResult.count,
            message: `Successfully deleted ${deleteResult.count} attendance records.`
        });

    } catch (error: any) {
        console.error("Delete Error:", error);
        return NextResponse.json({ error: error.message || "Delete failed" }, { status: 500 });
    }
}
