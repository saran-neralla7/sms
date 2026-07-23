import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/director/leaves/all
// Returns all leave requests across all departments for the Director role
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DIRECTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || undefined;
    const leaveType = searchParams.get("leaveType") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const year = searchParams.get("year");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const upcoming = searchParams.get("upcoming") === "true";

    const where: any = {};

    if (status) where.status = status;
    if (leaveType) where.leaveType = leaveType;
    if (departmentId) where.faculty = { departmentId };

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
            department: {
              select: { id: true, name: true, code: true }
            }
          }
        },
        substitute: {
          select: { id: true, empCode: true, empName: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ leaves, departments });
  } catch (error: any) {
    console.error("GET /api/director/leaves/all error:", error);
    return NextResponse.json({ error: error.message || "Failed to load leaves" }, { status: 500 });
  }
}
