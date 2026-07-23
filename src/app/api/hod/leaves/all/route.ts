import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/hod/leaves/all
// Returns all leave requests for the HOD's department (all statuses)
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

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || undefined;
    const leaveType = searchParams.get("leaveType") || undefined;
    const year = searchParams.get("year");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const upcoming = searchParams.get("upcoming") === "true";

    const where: any = {
      faculty: { departmentId: deptId }
    };

    if (status) where.status = status;
    if (leaveType) where.leaveType = leaveType;

    if (upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.endDate = { gte: today };
      if (!status) {
        where.status = { in: ["APPROVED", "PENDING_HOD", "PENDING_DIRECTOR"] };
      }
    } else if (startDateParam || endDateParam) {
      if (startDateParam && endDateParam) {
        const start = new Date(`${startDateParam}T00:00:00.000Z`);
        const end = new Date(`${endDateParam}T23:59:59.999Z`);
        where.startDate = { lte: end };
        where.endDate = { gte: start };
      } else if (startDateParam) {
        const start = new Date(`${startDateParam}T00:00:00.000Z`);
        where.endDate = { gte: start };
      } else if (endDateParam) {
        const end = new Date(`${endDateParam}T23:59:59.999Z`);
        where.startDate = { lte: end };
      }
    } else if (year && year !== "ALL") {
      const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
      where.startDate = { gte: startOfYear, lte: endOfYear };
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        faculty: {
          select: {
            id: true,
            empCode: true,
            empName: true,
            designation: true,
            email: true,
            mobile: true,
          }
        },
        substitute: {
          select: { id: true, empCode: true, empName: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const department = await prisma.department.findUnique({
      where: { id: deptId },
      select: { id: true, name: true, code: true }
    });

    return NextResponse.json({ leaves, department });
  } catch (error: any) {
    console.error("GET /api/hod/leaves/all error:", error);
    return NextResponse.json({ error: error.message || "Failed to load leaves" }, { status: 500 });
  }
}
