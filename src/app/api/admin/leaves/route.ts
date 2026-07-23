import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateFacultyLeaveQuota } from "@/lib/leaves";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const calendarYear = searchParams.get("year");
    const departmentId = searchParams.get("departmentId") || undefined;
    const facultyId = searchParams.get("facultyId") || undefined;
    const status = searchParams.get("status") || undefined;
    const leaveType = searchParams.get("leaveType") || undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const upcoming = searchParams.get("upcoming") === "true";

    // Build filter for leave requests
    const whereClause: any = {};
    if (facultyId) {
      whereClause.facultyId = facultyId;
    } else if (departmentId) {
      whereClause.faculty = { departmentId };
    }
    if (status) {
      whereClause.status = status;
    }
    if (leaveType) {
      whereClause.leaveType = leaveType;
    }

    if (upcoming) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      whereClause.endDate = { gte: today };
      if (!status) {
        whereClause.status = { in: ["APPROVED", "PENDING_HOD", "PENDING_DIRECTOR"] };
      }
    } else if (startDateParam || endDateParam) {
      if (startDateParam && endDateParam) {
        const start = new Date(`${startDateParam}T00:00:00.000Z`);
        const end = new Date(`${endDateParam}T23:59:59.999Z`);
        whereClause.startDate = { lte: end };
        whereClause.endDate = { gte: start };
      } else if (startDateParam) {
        const start = new Date(`${startDateParam}T00:00:00.000Z`);
        whereClause.endDate = { gte: start };
      } else if (endDateParam) {
        const end = new Date(`${endDateParam}T23:59:59.999Z`);
        whereClause.startDate = { lte: end };
      }
    } else if (calendarYear && calendarYear !== "ALL") {
      const startOfYear = new Date(`${calendarYear}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${calendarYear}-12-31T23:59:59.999Z`);
      whereClause.startDate = { gte: startOfYear, lte: endOfYear };
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        faculty: {
          select: {
            id: true,
            empCode: true,
            empName: true,
            designation: true,
            department: {
              select: {
                id: true,
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
      orderBy: { startDate: "desc" },
    });

    // Fetch all active faculty members and their quotas for the current year
    const facultyList = await prisma.faculty.findMany({
      where: {
        resignDate: null,
        departmentId: departmentId || undefined,
      },
      select: {
        id: true,
        empCode: true,
        empName: true,
        designation: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { empName: "asc" },
    });

    // Fetch all quotas for the target year
    const targetYear = calendarYear && calendarYear !== "ALL" ? calendarYear : new Date().getFullYear().toString();
    const quotas = await prisma.facultyLeaveQuota.findMany({
      where: { calendarYear: targetYear },
    });

    // Ensure every faculty has a quota in the list
    const quotasMap: Record<string, any> = {};
    quotas.forEach((q) => {
      quotasMap[q.facultyId] = q;
    });

    const enrichedFaculty = [];
    for (const fac of facultyList) {
      let q = quotasMap[fac.id];
      if (!q) {
        q = await getOrCreateFacultyLeaveQuota(fac.id, targetYear);
      }
      enrichedFaculty.push({
        ...fac,
        quota: q,
      });
    }

    // Fetch all departments for filter dropdown
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    });

    return NextResponse.json({
      leaveRequests,
      faculty: enrichedFaculty,
      departments,
    });
  } catch (error: any) {
    console.error("GET /api/admin/leaves error:", error);
    return NextResponse.json({ error: error.message || "Failed to load admin leaves" }, { status: 500 });
  }
}
