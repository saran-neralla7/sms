import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getTargetUserIds(params: {
    targetRole: string;
    departmentId?: string;
    year?: string;
}) {
    const { targetRole, departmentId, year } = params;

    const userWhere: any = {};

    // 1. Filter by Role
    if (targetRole && targetRole !== "ALL") {
        userWhere.role = targetRole;
    }

    // 2. Filter by Department
    if (departmentId && departmentId !== "ALL") {
        userWhere.OR = [
            { departmentId: departmentId },
            { faculty: { departmentId: departmentId } }
        ];
    }

    let users = await prisma.user.findMany({
        where: userWhere,
        select: {
            id: true,
            username: true,
            role: true,
            departmentId: true,
            faculty: { select: { departmentId: true } }
        }
    });

    // 3. Filter by Student Year (if year filter is active)
    if (year && year !== "ALL") {
        const studentWhere: any = { year: year };
        if (departmentId && departmentId !== "ALL") {
            studentWhere.departmentId = departmentId;
        }

        const matchingStudents = await prisma.student.findMany({
            where: studentWhere,
            select: { rollNumber: true }
        });

        const studentRollSet = new Set(matchingStudents.map(s => s.rollNumber.toUpperCase()));

        users = users.filter(u => {
            if (u.role === "STUDENT") {
                return studentRollSet.has(u.username.toUpperCase());
            }
            return targetRole === "ALL";
        });
    }

    return users.map(u => u.id);
}

// GET: Preview recipient count
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const targetRole = searchParams.get("targetRole") || "ALL";
        const departmentId = searchParams.get("departmentId") || "ALL";
        const year = searchParams.get("year") || "ALL";

        const userIds = await getTargetUserIds({ targetRole, departmentId, year });

        return NextResponse.json({ count: userIds.length });
    } catch (error: any) {
        console.error("Broadcast preview error:", error);
        return NextResponse.json({ error: error.message || "Failed to calculate recipient count" }, { status: 500 });
    }
}

// POST: Broadcast notification to target users
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, message, targetRole = "ALL", departmentId = "ALL", year = "ALL", link = "/dashboard" } = body;

        if (!title || !title.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }
        if (!message || !message.trim()) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const userIds = await getTargetUserIds({ targetRole, departmentId, year });

        if (userIds.length === 0) {
            return NextResponse.json({ error: "No users matched the selected filter criteria." }, { status: 400 });
        }

        const notificationsToCreate = userIds.map(userId => ({
            userId,
            title: title.trim(),
            message: message.trim(),
            type: "ADMIN_BROADCAST",
            link: link.trim() || "/dashboard"
        }));

        await prisma.notification.createMany({
            data: notificationsToCreate
        });

        // Audit Log entry
        await prisma.auditLog.create({
            data: {
                action: "BROADCAST_NOTIFICATION",
                entity: "Notification",
                entityId: `broadcast_${Date.now()}`,
                performedBy: session.user.id,
                details: JSON.stringify({
                    title,
                    message,
                    targetRole,
                    departmentId,
                    year,
                    deliveredCount: userIds.length,
                    performerName: session.user.name || session.user.username || "Admin"
                })
            }
        });

        return NextResponse.json({
            success: true,
            deliveredCount: userIds.length,
            message: `Notification broadcasted successfully to ${userIds.length} user(s)!`
        });

    } catch (error: any) {
        console.error("Broadcast notification error:", error);
        return NextResponse.json({ error: error.message || "Failed to broadcast notification" }, { status: 500 });
    }
}
