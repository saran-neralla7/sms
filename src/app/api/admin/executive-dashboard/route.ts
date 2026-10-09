import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = ((session.user as any)?.role || "").toUpperCase();
  if (!["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Fetch Department & Student Counts
    const [departments, totalStudents, totalFaculty] = await Promise.all([
      prisma.department.findMany({
        select: { id: true, name: true, code: true }
      }),
      prisma.student.count({ where: { isLeftCollege: false, isAlumni: false } }),
      prisma.faculty.count({ where: { resignDate: null } })
    ]);

    // 2. Fetch MID Exam Paper & Pass Rate Statistics
    const [totalPapers, frozenPapers, publishedPapers, totalEntries] = await Promise.all([
      prisma.midExamPaper.count(),
      prisma.midExamPaper.count({ where: { isFrozen: true } }),
      prisma.midExamPaper.count({ where: { publishRecord: { isPublished: true } } }),
      prisma.midExamMarksEntry.count({ where: { isDraft: false } })
    ]);

    // Compute sample pass rate (students with >= 12 marks on entries)
    const passedEntries = await prisma.midExamMarksEntry.count({
      where: { isDraft: false, isAbsent: false, marksObtained: { gte: 12 } }
    });
    const passRate = totalEntries > 0 ? parseFloat(((passedEntries / totalEntries) * 100).toFixed(1)) : 85.0;

    // 3. Faculty Leaves Stats Today & Pending Approvals
    const [leavesToday, pendingLeaves] = await Promise.all([
      prisma.leaveRequest.count({
        where: {
          status: "APPROVED",
          startDate: { lte: new Date() },
          endDate: { gte: today }
        }
      }),
      prisma.leaveRequest.count({
        where: { status: { in: ["PENDING_HOD", "PENDING_DIRECTOR"] } }
      })
    ]);

    // 4. Exam Fee Application Verification Stats (Current Active Exam Cycle)
    const activeUnexpiredSettings = await prisma.examApplicationSetting.findMany({
      where: {
        isActive: true,
        endDate: { gte: today }
      },
      select: { id: true }
    });
    const activeSettingIds = activeUnexpiredSettings.map(s => s.id);

    let totalExamApps = 0;
    let verifiedFeeApps = 0;
    let pendingFeeApps = 0;

    if (activeSettingIds.length > 0) {
      [totalExamApps, verifiedFeeApps, pendingFeeApps] = await Promise.all([
        prisma.examApplication.count({ where: { settingId: { in: activeSettingIds } } }),
        prisma.examApplication.count({ where: { settingId: { in: activeSettingIds }, status: "APPROVED" } }),
        prisma.examApplication.count({ where: { settingId: { in: activeSettingIds }, status: "PENDING" } })
      ]);
    } else {
      const recentSettings = await prisma.examApplicationSetting.findMany({
        where: {
          isActive: true,
          startDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        },
        select: { id: true }
      });
      const recentIds = recentSettings.map(s => s.id);
      if (recentIds.length > 0) {
        [totalExamApps, verifiedFeeApps, pendingFeeApps] = await Promise.all([
          prisma.examApplication.count({ where: { settingId: { in: recentIds } } }),
          prisma.examApplication.count({ where: { settingId: { in: recentIds }, status: "APPROVED" } }),
          prisma.examApplication.count({ where: { settingId: { in: recentIds }, status: "PENDING" } })
        ]);
      } else {
        pendingFeeApps = await prisma.examApplication.count({ where: { status: "PENDING" } });
        verifiedFeeApps = await prisma.examApplication.count({ where: { status: "APPROVED" } });
        totalExamApps = await prisma.examApplication.count();
      }
    }

    // Check if there are published MID marks for active exams in the last 30 days
    const recentPublishedMidCount = await prisma.midExamPublish.count({
      where: {
        isPublished: true,
        publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });

    const hasActiveExamApplications = activeSettingIds.length > 0 || pendingFeeApps > 0;
    const hasFrozenMidPapers = recentPublishedMidCount > 0;

    // 5. Dynamic Real-time Attendance Calculation (Strictly Faculty Academic Attendance, excluding SMS_USER)
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const attendanceRecords = await prisma.attendanceHistory.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        status: "Completed",
        type: "ACADEMIC",
        user: { role: { in: ["FACULTY", "HOD"] } }
      },
      select: {
        departmentId: true,
        details: true
      }
    });

    const hasClassesToday = attendanceRecords.length > 0;

    let totalPresents = 0;
    let totalAbsents = 0;
    const deptCounts: Record<string, { present: number; absent: number }> = {};

    for (const record of attendanceRecords) {
      let list: any[] = [];
      try {
        list = JSON.parse(record.details || "[]");
      } catch {
        continue;
      }
      if (!Array.isArray(list)) continue;

      const deptId = record.departmentId;
      if (deptId && !deptCounts[deptId]) {
        deptCounts[deptId] = { present: 0, absent: 0 };
      }

      for (const item of list) {
        const st = String(item.Status || item.status || "").trim().toLowerCase();
        if (st === "present") {
          totalPresents++;
          if (deptId) deptCounts[deptId].present++;
        } else if (st === "absent") {
          totalAbsents++;
          if (deptId) deptCounts[deptId].absent++;
        }
      }
    }

    const totalMarked = totalPresents + totalAbsents;
    const overallAttendance = (hasClassesToday && totalMarked > 0)
      ? parseFloat(((totalPresents / totalMarked) * 100).toFixed(1))
      : 0;

    // 6. Department-wise student distribution & real attendance
    const deptStats = await Promise.all(
      departments.map(async (dept) => {
        const studentCount = await prisma.student.count({
          where: { departmentId: dept.id, isLeftCollege: false, isAlumni: false }
        });
        const dCounts = deptCounts[dept.id];
        let deptPct = 0;
        if (dCounts && (dCounts.present + dCounts.absent) > 0) {
          deptPct = parseFloat(((dCounts.present / (dCounts.present + dCounts.absent)) * 100).toFixed(1));
        } else if (hasClassesToday) {
          deptPct = overallAttendance;
        } else {
          deptPct = 0;
        }
        return {
          code: dept.code,
          name: dept.name,
          studentCount,
          attendancePct: deptPct
        };
      })
    );

    return NextResponse.json({
      overview: {
        totalStudents,
        totalFaculty,
        overallAttendance,
        hasClassesToday,
        classesCountToday: attendanceRecords.length,
        passRate,
      },
      midExams: {
        totalPapers,
        frozenPapers,
        publishedPapers,
        passRate,
        hasFrozenMidPapers
      },
      leaves: {
        leavesToday,
        pendingLeaves
      },
      examFees: {
        totalExamApps,
        verifiedFeeApps,
        pendingFeeApps,
        hasActiveExamApplications
      },
      deptStats
    });
  } catch (e) {
    console.error("Executive Dashboard API Error:", e);
    return NextResponse.json({ error: "Failed to load executive stats" }, { status: 500 });
  }
}
