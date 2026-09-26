import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalAccess } from "@/lib/permissions";

// GET /api/helpdesk/stats
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    if (isGlobal) {
      const [total, open, inProgress, resolvedToday] = await Promise.all([
        prisma.helpdeskTicket.count(),
        prisma.helpdeskTicket.count({ where: { status: "OPEN" } }),
        prisma.helpdeskTicket.count({ where: { status: "IN_PROGRESS" } }),
        prisma.helpdeskTicket.count({
          where: {
            status: "RESOLVED",
            resolvedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        })
      ]);

      return NextResponse.json({
        success: true,
        stats: {
          total,
          open,
          inProgress,
          resolvedToday,
          actionRequired: open + inProgress
        }
      });
    } else {
      // Faculty stats
      const [myTotal, myOpen, myResolved] = await Promise.all([
        prisma.helpdeskTicket.count({ where: { userId: user.id } }),
        prisma.helpdeskTicket.count({ where: { userId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
        prisma.helpdeskTicket.count({ where: { userId: user.id, status: "RESOLVED" } })
      ]);

      return NextResponse.json({
        success: true,
        stats: {
          myTotal,
          myOpen,
          myResolved
        }
      });
    }
  } catch (error: any) {
    console.error("Error fetching helpdesk stats:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch stats" }, { status: 500 });
  }
}
