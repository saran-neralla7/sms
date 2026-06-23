import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "HOD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deptId = (session.user as any).departmentId;
    if (!deptId) {
      return NextResponse.json({ error: "Department not mapped for this HOD" }, { status: 400 });
    }

    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: "PENDING_HOD",
        faculty: {
          departmentId: deptId,
        },
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
    console.error("GET /api/hod/leaves/pending error:", error);
    return NextResponse.json({ error: error.message || "Failed to load pending leaves" }, { status: 500 });
  }
}
