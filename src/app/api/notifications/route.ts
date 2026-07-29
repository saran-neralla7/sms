import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 30
        });

        const unreadCount = await prisma.notification.count({
            where: {
                userId: session.user.id,
                isRead: false
            }
        });

        return NextResponse.json({
            notifications,
            unreadCount
        });
    } catch (error: any) {
        console.error("Fetch Notifications Error:", error);
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { notificationId, markAll } = await request.json();

        if (markAll) {
            await prisma.notification.updateMany({
                where: {
                    userId: session.user.id,
                    isRead: false
                },
                data: { isRead: true }
            });
        } else if (notificationId) {
            await prisma.notification.update({
                where: {
                    id: notificationId,
                    userId: session.user.id
                },
                data: { isRead: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Update Notifications Error:", error);
        return NextResponse.json({ error: "Failed to update notification status" }, { status: 500 });
    }
}
