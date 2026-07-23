import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateFacultyLeaveQuota } from "@/lib/leaves";
import { logActivity } from "@/lib/logging";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { faculty: true },
    });

    if (!user?.faculty) {
      return NextResponse.json({ error: "Faculty record not found" }, { status: 404 });
    }

    const faculty = user.faculty;
    const { searchParams } = req.nextUrl;
    const currentYear = searchParams.get("year") || new Date().getFullYear().toString();

    // Fetch quota
    const quota = await getOrCreateFacultyLeaveQuota(faculty.id, currentYear);

    // Fetch leave requests history
    const history = await prisma.leaveRequest.findMany({
      where: { facultyId: faculty.id },
      include: {
        substitute: {
          select: {
            empCode: true,
            empName: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // Fetch active faculty list (excluding self) to choose as substitute
    const activeFaculty = await prisma.faculty.findMany({
      where: {
        id: { not: faculty.id },
        resignDate: null,
      },
      select: {
        id: true,
        empCode: true,
        empName: true,
        designation: true,
      },
      orderBy: { empName: "asc" },
    });

    return NextResponse.json({
      faculty: {
        id: faculty.id,
        empCode: faculty.empCode,
        empName: faculty.empName,
        designation: faculty.designation,
        email: faculty.email,
        mobile: faculty.mobile,
      },
      quota,
      history,
      activeFaculty,
    });
  } catch (error: any) {
    console.error("GET /api/faculty/leaves error:", error);
    return NextResponse.json({ error: error.message || "Failed to load leave records" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { faculty: true },
    });

    if (!user?.faculty) {
      return NextResponse.json({ error: "Faculty record not found" }, { status: 404 });
    }

    const faculty = user.faculty;
    const body = await req.json();
    const { leaveType, startDateStr, endDateStr, numberOfDays, reason, substituteId } = body;

    if (!leaveType || !startDateStr || !endDateStr || !numberOfDays || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const calendarYear = startDate.getFullYear().toString();

    // If CL, check quota balance
    if (leaveType === "CL") {
      const quota = await getOrCreateFacultyLeaveQuota(faculty.id, calendarYear);
      const remaining = quota.clQuota - quota.clConsumed;
      if (numberOfDays > remaining) {
        return NextResponse.json({
          error: `Insufficient Casual Leave balance. Remaining: ${remaining} days, Requested: ${numberOfDays} days.`,
        }, { status: 400 });
      }
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        facultyId: faculty.id,
        leaveType,
        startDate,
        endDate,
        numberOfDays: parseFloat(numberOfDays),
        reason,
        substituteId: substituteId || null,
        status: "PENDING_HOD",
      },
    });

    await logActivity(
      session.user.id,
      "CREATE",
      "LeaveRequest",
      `${faculty.empName} | ${leaveType} | ${startDateStr} to ${endDateStr} (${numberOfDays} day(s))`,
      { leaveRequestId: leaveRequest.id, leaveType, startDate: startDateStr, endDate: endDateStr, numberOfDays, reason }
    );

    return NextResponse.json({ success: true, leaveRequest });
  } catch (error: any) {
    console.error("POST /api/faculty/leaves error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit leave request" }, { status: 500 });
  }
}
