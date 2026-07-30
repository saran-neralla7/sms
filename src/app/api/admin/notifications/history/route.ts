import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                action: "BROADCAST_NOTIFICATION"
            },
            orderBy: { createdAt: "desc" },
            take: 20
        });

        const history = logs.map(l => {
            let detailsObj: any = {};
            try {
                detailsObj = JSON.parse(l.details || "{}");
            } catch (e) {}

            return {
                id: l.id,
                performerName: detailsObj.performerName || "Admin",
                createdAt: l.createdAt,
                title: detailsObj.title || "Broadcast Notification",
                message: detailsObj.message || "",
                targetRole: detailsObj.targetRole || "ALL",
                departmentId: detailsObj.departmentId || "ALL",
                year: detailsObj.year || "ALL",
                deliveredCount: detailsObj.deliveredCount || 0
            };
        });

        return NextResponse.json({ history });
    } catch (error: any) {
        console.error("Broadcast history error:", error);
        return NextResponse.json({ error: "Failed to fetch broadcast history" }, { status: 500 });
    }
}
