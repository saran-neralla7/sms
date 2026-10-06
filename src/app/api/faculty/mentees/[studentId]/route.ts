import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalAccess } from "@/lib/permissions";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";

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
    const isHOD = user.role === "HOD";

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        mentor: {
          select: { id: true, empName: true, empCode: true, designation: true }
        },
        subjects: {
          select: { id: true, code: true, name: true, departmentId: true }
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

    // RBAC: If faculty, check that student is their mentee; if HOD, check department
    if (!isGlobal) {
      if (isHOD) {
        if (student.departmentId !== user.departmentId) {
          return NextResponse.json({ error: "Access denied. Student is not in your department." }, { status: 403 });
        }
      } else {
        let facultyId = user.facultyId;
        if (!facultyId) {
          const fac = await prisma.faculty.findFirst({ where: { user: { id: user.id } } });
          facultyId = fac?.id;
        }
        if (student.mentorId !== facultyId) {
          return NextResponse.json({ error: "Access denied. Student is not your assigned mentee." }, { status: 403 });
        }
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

    const subjectIdSet = new Set(subjects.map(s => s.id));

    // Compute subject-wise attendance (ACADEMIC only, batch-aware)
    const attendanceRecords = await prisma.attendanceHistory.findMany({
      where: {
        year: student.year,
        semester: student.semester,
        type: "ACADEMIC",
        user: { role: { not: "USER" } },
        OR: [
          { departmentId: student.departmentId, sectionId: student.sectionId },
          { details: { contains: student.rollNumber } }
        ]
      },
      select: {
        subjectId: true,
        status: true,
        details: true
      }
    });

    const subjectAttendance: Record<string, { total: number; attended: number }> = {};
    subjects.forEach((s) => {
      subjectAttendance[s.id] = { total: 0, attended: 0 };
    });

    for (const rec of attendanceRecords) {
      if (!rec.subjectId || !subjectIdSet.has(rec.subjectId)) continue;

      if (!subjectAttendance[rec.subjectId]) {
        subjectAttendance[rec.subjectId] = { total: 0, attended: 0 };
      }

      let recordAppliesToStudent = false;
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
          recordAppliesToStudent = true;
          const st = String(sObj["Status"] || sObj["status"] || "").toLowerCase();
          isPresent = st === "present" || st === "p" || sObj.isPresent === true;
        } else if (rec.status === "Marked Absent") {
          recordAppliesToStudent = true;
          isPresent = true;
        }
      } else if (rec.status === "Marked Absent") {
        recordAppliesToStudent = true;
        isPresent = true;
      }

      if (recordAppliesToStudent) {
        subjectAttendance[rec.subjectId].total++;
        if (isPresent) {
          subjectAttendance[rec.subjectId].attended++;
        }
      }
    }

    let overallTotal = 0;
    let overallAttended = 0;

    const subjectBreakdown = subjects.map((sub) => {
      const stats = subjectAttendance[sub.id] || { total: 0, attended: 0 };
      overallTotal += stats.total;
      overallAttended += stats.attended;
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

    const overallPercentage = overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 1000) / 10 : 100;
    let healthTier: "SAFE" | "CONDONATION" | "DETENTION" = "SAFE";
    if (overallPercentage < 65) {
      healthTier = "DETENTION";
    } else if (overallPercentage < 75) {
      healthTier = "CONDONATION";
    }

    // Fetch and aggregate Mid Exam Marks (clean subject-level aggregation)
    const rawEntries = await prisma.midExamMarksEntry.findMany({
      where: { studentId: student.id },
      include: {
        paper: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                departmentId: true,
                isElective: true,
                electiveSlotRelation: true
              }
            },
            questions: { include: { subQuestions: true } },
            masterPaper: { include: { questions: { include: { subQuestions: true } } } },
            publishRecord: true
          }
        }
      }
    });

    const paperMap = new Map<string, { paper: any; marksMap: Record<string, number | null>; isAbsent: boolean }>();
    for (const e of rawEntries) {
      if (!e.paper || !e.paper.subject) continue;
      const sub = e.paper.subject;

      // Safeguard: Ensure paper belongs to student's legitimate curriculum
      const isDeptMatch = sub.departmentId === student.departmentId;
      const isDirectlyEnrolled = student.subjects?.some((s: any) => s.id === sub.id);
      const isOE = sub.isElective && (
        sub.electiveSlotRelation?.name?.toUpperCase()?.includes("OE") ||
        sub.electiveSlotRelation?.name?.toUpperCase()?.includes("OPEN")
      );
      if (!isDeptMatch && !isDirectlyEnrolled && !isOE) {
        continue;
      }

      if (!paperMap.has(e.paperId)) {
        paperMap.set(e.paperId, {
          paper: e.paper,
          marksMap: {},
          isAbsent: e.isAbsent
        });
      }
      paperMap.get(e.paperId)!.marksMap[e.subQuestionId] = e.marksObtained;
      if (e.isAbsent) paperMap.get(e.paperId)!.isAbsent = true;
    }

    const aggregatedMidMarks = [];
    for (const [pId, pData] of paperMap.entries()) {
      const p = pData.paper;
      const questions = p.masterPaper?.questions || p.questions || [];
      const choiceGroups = await prisma.midExamChoiceGroup.findMany({
        where: { paperId: p.masterPaperId || p.id },
        include: { questions: { include: { subQuestions: true } } }
      });
      const { total } = calculateStudentTotal(questions, choiceGroups, pData.marksMap, pData.isAbsent);

      aggregatedMidMarks.push({
        id: p.id,
        paperId: p.id,
        subjectName: p.subject.name,
        subjectCode: p.subject.code,
        examType: p.examType,
        year: p.year,
        semester: p.semester,
        totalMarks: p.totalMarks,
        marksObtained: pData.isAbsent ? null : total,
        isAbsent: pData.isAbsent,
        isPublished: p.publishRecord?.isPublished ?? false
      });
    }

    // Sort by year desc, semester desc, subjectCode asc, examType asc
    aggregatedMidMarks.sort((a, b) => {
      if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year);
      if (a.semester !== b.semester) return parseInt(b.semester) - parseInt(a.semester);
      if (a.subjectName !== b.subjectName) return a.subjectName.localeCompare(b.subjectName);
      return a.examType.localeCompare(b.examType);
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
      midMarks: aggregatedMidMarks,
      overallStats: {
        totalClasses: overallTotal,
        attendedClasses: overallAttended,
        percentage: overallPercentage,
        healthTier
      },
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
    const isHOD = user.role === "HOD";

    let facultyId = user.facultyId;
    if (!facultyId && !isHOD) {
      const fac = await prisma.faculty.findFirst({ where: { user: { id: user.id } } });
      facultyId = fac?.id;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // RBAC: Verify mentorship or HOD access
    let recordedByText = "";
    let logFacultyId: string | null = null;

    if (isHOD) {
      if (student.departmentId !== user.departmentId) {
        return NextResponse.json({ error: "Access denied. Student is not in your department." }, { status: 403 });
      }
      recordedByText = "recorded through HOD";
      logFacultyId = user.facultyId || student.mentorId || null;
    } else {
      if (!isGlobal) {
        if (student.mentorId !== facultyId) {
          return NextResponse.json({ error: "Access denied. Student is not your assigned mentee." }, { status: 403 });
        }
      }
      const mentorFaculty = facultyId
        ? await prisma.faculty.findUnique({
            where: { id: facultyId },
            select: { empName: true }
          })
        : null;
      const mentorName = mentorFaculty?.empName || user.name || "Mentor";
      recordedByText = `Recorded through ${mentorName} (Mentor)`;
      logFacultyId = facultyId || student.mentorId || null;
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
        facultyId: logFacultyId,
        category: cleanCategory,
        remarks: remarks.trim(),
        actionTaken: actionTaken ? actionTaken.trim() : null,
        parentInformed: Boolean(parentInformed),
        date: logDate,
        recordedBy: recordedByText
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
