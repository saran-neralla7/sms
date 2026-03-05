import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const requests = await prisma.passwordResetRequest.findMany({
            where: { status: "PENDING" },
            include: {
                user: {
                    select: {
                        username: true,
                        role: true,
                        // Include linked entity names if possible?
                        faculty: { select: { empName: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        const formatted = requests.map(r => ({
            id: r.id,
            username: r.user.username,
            role: r.user.role,
            name: r.user.faculty?.empName || r.user.username, // Fallback
            requestedAt: r.createdAt
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }
}
