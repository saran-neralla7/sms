import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalAccess } from "@/lib/permissions";

// GET /api/faculty/mentees/[studentId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentId } = await params;
    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        mentor: {
          select: { id: true, empName: true, empCode: true, designation: true }
        },
        mentoringLogs: {
          orderBy: { date: "desc" },
          include: {
            faculty: {
              select: { empName: true, designation: true }
            }
          }
        },
        results: {
          orderBy: [{ year: "asc" }, { semester: "asc" }]
        }
      }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // RBAC: If faculty, check that student is their mentee
    if (!isGlobal) {
      let facultyId = user.facultyId;
      if (!facultyId) {
        const fac = await prisma.faculty.findFirst({ where: { user: { id: user.id } } });
        facultyId = fac?.id;
      }
      if (student.mentorId !== facultyId) {
        return NextResponse.json({ error: "Access denied. Student is not your assigned mentee." }, { status: 403 });
      }
    }

    // Fetch subjects for student's year/sem
    const subjects = await prisma.subject.findMany({
      where: {
        year: student.year,
        semester: student.semester,
        OR: [
          { departmentId: student.departmentId },
          { students: { some: { id: student.id } } }
        ]
      },
      select: { id: true, name: true, code: true, type: true }
    });

    // Compute subject-wise attendance
    const attendanceRecords = await prisma.attendanceHistory.findMany({
      where: {
        year: student.year,
        semester: student.semester,
        OR: [
          { departmentId: student.departmentId, sectionId: student.sectionId },
          { details: { contains: student.rollNumber } }
        ]
      }
    });

    const subjectAttendance: Record<string, { total: number; attended: number }> = {};
    subjects.forEach((s) => {
      subjectAttendance[s.id] = { total: 0, attended: 0 };
    });

    for (const rec of attendanceRecords) {
      if (!rec.subjectId) continue;

      if (!subjectAttendance[rec.subjectId]) {
        subjectAttendance[rec.subjectId] = { total: 0, attended: 0 };
      }
      subjectAttendance[rec.subjectId].total++;

      let isPresent = false;
      let details: any[] = [];
      try {
        details = typeof rec.details === "string" ? JSON.parse(rec.details) : rec.details;
      } catch {
        details = [];
      }

      if (Array.isArray(details)) {
        const sObj = details.find((d: any) => {
          const r = d["Roll Number"] || d["rollNumber"] || d["studentRollNumber"];
          return (r && String(r).toUpperCase() === student.rollNumber.toUpperCase()) || d.studentId === student.id;
        });
        if (sObj) {
          const st = sObj["Status"] || sObj["status"];
          isPresent = st === "Present" || st === "present" || st === "P" || sObj.isPresent === true;
        }
      }

      if (isPresent) {
        subjectAttendance[rec.subjectId].attended++;
      }
    }

    const subjectBreakdown = subjects.map((sub) => {
      const stats = subjectAttendance[sub.id] || { total: 0, attended: 0 };
      const pct = stats.total > 0 ? Math.round((stats.attended / stats.total) * 1000) / 10 : 100;
      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        type: sub.type,
        totalClasses: stats.total,
        attendedClasses: stats.attended,
        percentage: pct
      };
    });

    // Fetch Mid Exam Marks
    const midMarks = await prisma.midExamMarksEntry.findMany({
      where: { studentId: student.id },
      include: {
        paper: {
          select: {
            examType: true,
            totalMarks: true,
            subject: { select: { name: true, code: true } }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        mobile: student.mobile,
        parentMobile: student.studentContactNumber || student.mobile,
        fatherName: student.fatherName,
        motherName: student.motherName,
        email: student.emailId || student.domainMailId,
        address: student.address,
        photoUrl: student.photoUrl,
        year: student.year,
        semester: student.semester,
        department: student.department.name,
        deptCode: student.department.code,
        section: student.section.name,
        mentor: student.mentor
      },
      subjectBreakdown,
      midMarks,
      results: student.results,
      mentoringLogs: student.mentoringLogs
    });
  } catch (error: any) {
    console.error("Error fetching mentee 360 profile:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch mentee profile" }, { status: 500 });
  }
}

// POST /api/faculty/mentees/[studentId] (Add counseling log)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentId } = await params;
    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    let facultyId = user.facultyId;
    if (!facultyId) {
      const fac = await prisma.faculty.findFirst({ where: { user: { id: user.id } } });
      facultyId = fac?.id;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // RBAC: Verify mentorship
    if (!isGlobal && student.mentorId !== facultyId) {
      return NextResponse.json({ error: "Access denied. Student is not your assigned mentee." }, { status: 403 });
    }

    const body = await req.json();
    const { category, remarks, actionTaken, parentInformed, date } = body;

    if (!remarks || !remarks.trim()) {
      return NextResponse.json({ error: "Counseling remarks are required" }, { status: 400 });
    }

    const cleanCategory = category || "ATTENDANCE";
    const logDate = date ? new Date(date) : new Date();

    const log = await prisma.mentoringLog.create({
      data: {
        studentId,
        facultyId: facultyId || student.mentorId || user.id,
        category: cleanCategory,
        remarks: remarks.trim(),
        actionTaken: actionTaken ? actionTaken.trim() : null,
        parentInformed: Boolean(parentInformed),
        date: logDate
      },
      include: {
        faculty: { select: { empName: true, designation: true } }
      }
    });

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error("Error creating mentoring log:", error);
    return NextResponse.json({ error: error.message || "Failed to add counseling entry" }, { status: 500 });
  }
}
