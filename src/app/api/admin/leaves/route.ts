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
    const calendarYear = searchParams.get("year") || new Date().getFullYear().toString();
    const departmentId = searchParams.get("departmentId") || undefined;
    const facultyId = searchParams.get("facultyId") || undefined;
    const status = searchParams.get("status") || undefined;

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

    // Filter by calendar year of request
    const startOfYear = new Date(`${calendarYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${calendarYear}-12-31T23:59:59.999Z`);
    whereClause.startDate = {
      gte: startOfYear,
      lte: endOfYear,
    };

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

    // Fetch all quotas for the current year
    const quotas = await prisma.facultyLeaveQuota.findMany({
      where: { calendarYear },
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
        q = await getOrCreateFacultyLeaveQuota(fac.id, calendarYear);
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
