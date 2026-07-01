import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");
        const skip = (page - 1) * limit;

        const actionFilter = searchParams.get("action");
        const entityFilter = searchParams.get("entity");
        const searchQuery = searchParams.get("q");

        const where: any = {};

        if (actionFilter) {
            where.action = actionFilter;
        }

        if (entityFilter) {
            where.entity = entityFilter;
        }

        if (searchQuery) {
            // Find users matching search query first
            const matchingUsers = await prisma.user.findMany({
                where: {
                    username: { contains: searchQuery, mode: "insensitive" }
                },
                select: { id: true }
            });
            const matchingUserIds = matchingUsers.map(u => u.id);

            where.OR = [
                { entity: { contains: searchQuery, mode: "insensitive" } },
                { entityId: { contains: searchQuery, mode: "insensitive" } },
                { details: { contains: searchQuery, mode: "insensitive" } },
                { performedBy: { in: [searchQuery, ...matchingUserIds] } }
            ];
        }

        const [logs, total] = await prisma.$transaction([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: skip
            }),
            prisma.auditLog.count({ where })
        ]);

        const [globalTotal, failedLoginsCount, successLoginsCount, dataMutationsCount] = await prisma.$transaction([
            prisma.auditLog.count(),
            prisma.auditLog.count({ where: { action: "LOGIN_FAILURE" } }),
            prisma.auditLog.count({ where: { action: "LOGIN_SUCCESS" } }),
            prisma.auditLog.count({ where: { action: { in: ["CREATE", "UPDATE", "DELETE"] } } }),
        ]);

        // Enrich with User info manually
        const userIds = Array.from(new Set(logs.map(l => l.performedBy)));
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, role: true }
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        const enrichedLogs = logs.map(log => ({
            ...log,
            performerName: userMap.get(log.performedBy)?.username || log.performedBy || "SYSTEM",
            performerRole: userMap.get(log.performedBy)?.role || "SYSTEM"
        }));

        return NextResponse.json({
            data: enrichedLogs,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            stats: {
                total: globalTotal,
                failedLogins: failedLoginsCount,
                successLogins: successLoginsCount,
                dataMutations: dataMutationsCount
            }
        });

    } catch (error) {
        console.error("Audit Log Fetch Error:", error);
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }
}
