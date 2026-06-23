import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DIRECTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "PENDING_DIRECTOR",
      },
      include: {
        faculty: {
          select: {
            id: true,
            empCode: true,
            empName: true,
            designation: true,
            email: true,
            mobile: true,
            department: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        substitute: {
          select: {
            id: true,
            empCode: true,
            empName: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ pendingLeaves });
  } catch (error: any) {
    console.error("GET /api/director/leaves/pending error:", error);
    return NextResponse.json({ error: error.message || "Failed to load pending leaves" }, { status: 500 });
  }
}
