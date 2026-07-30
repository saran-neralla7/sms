import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const title = body.title || "iPhone Test Push Notification 🚀";
        const message = body.message || `Test notification sent at ${new Date().toLocaleTimeString()} to verify iPhone/mobile alert functionality.`;

        // Create notification for current admin user
        const notification = await prisma.notification.create({
            data: {
                userId: session.user.id,
                title,
                message,
                type: "SYSTEM_TEST",
                link: "/admin"
            }
        });

        return NextResponse.json({
            success: true,
            message: "Test notification sent successfully to your account!",
            notification
        });
    } catch (error: any) {
        console.error("Error sending test push notification:", error);
        return NextResponse.json({ error: error.message || "Failed to send test notification" }, { status: 500 });
    }
}
