
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        // Only Admin should see all logs? 
        // User said "add a log in the admin panel". So yes, Admin only.
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");
        const skip = (page - 1) * limit;

        // Fetch logs with user details if possible (manually or relation?)
        // Schema has `performedBy` as String (User ID). User model has ID.
        // We can join if we add relation, but currently schema doesn't seem to have relation on AuditLog.
        // I defined: performedBy String // User ID. No @relation?
        // Let's check schema.
        // "performedBy String // User ID"
        // If no relation, I can't include user name easily. 
        // I will fetch logs and then fetch users or just display ID?
        // Better: Update schema to have relation?
        // User said "simplified". I'll try to fetch users manualy if needed, or just show ID for now.
        // Actually, for "Simplified", I'll just show what I have.
        // Or I can do a second query to get distinct user names.

        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: skip
        });

        const total = await prisma.auditLog.count();

        // Enrich with User info manually
        const userIds = Array.from(new Set(logs.map(l => l.performedBy)));
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, role: true }
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        const enrichedLogs = logs.map(log => ({
            ...log,
            performerName: userMap.get(log.performedBy)?.username || log.performedBy || "Unknown",
            performerRole: userMap.get(log.performedBy)?.role || "N/A"
        }));

        return NextResponse.json({
            data: enrichedLogs,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error("Audit Log Fetch Error:", error);
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }
}
