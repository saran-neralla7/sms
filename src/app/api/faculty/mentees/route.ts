import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/faculty/mentees
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isHOD = user.role === "HOD";
    let facultyId = user.facultyId;

    if (!facultyId && !isHOD) {
      const fac = await prisma.faculty.findFirst({
        where: { user: { id: user.id } }
      });
      facultyId = fac?.id;
    }

    if (!facultyId && !isHOD && user.role !== "ADMIN" && user.role !== "DIRECTOR") {
      return NextResponse.json({ error: "No faculty profile linked" }, { status: 400 });
    }

    if (isHOD && !user.departmentId) {
      return NextResponse.json({ error: "No department assigned to HOD" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const queryFacultyId = searchParams.get("facultyId");

    // Build student query — active regular non-alumni students only
    const whereClause: any = {
      isLeftCollege: false,
      isAlumni: false
    };

    // If user is ADMIN or DIRECTOR and did not specify facultyId, default to department if specified, or return early with faculties and stats
    if (!facultyId && !isHOD && (user.role === "ADMIN" || user.role === "DIRECTOR")) {
      const selectedDept = searchParams.get("departmentId");
      if (selectedDept && selectedDept !== "ALL") {
        whereClause.departmentId = selectedDept;
      }
      if (queryFacultyId && queryFacultyId !== "ALL") {
        if (queryFacultyId === "UNASSIGNED") {
          whereClause.mentorId = null;
        } else {
          whereClause.mentorId = queryFacultyId;
        }
      }
    } else if (isHOD) {
      whereClause.departmentId = user.departmentId;
      if (queryFacultyId && queryFacultyId !== "ALL") {
        if (queryFacultyId === "UNASSIGNED") {
          whereClause.mentorId = null;
        } else {
          whereClause.mentorId = queryFacultyId;
        }
      }
    } else {
      whereClause.mentorId = queryFacultyId || facultyId;
    }

    // Fetch departments for Admin/Director filter dropdown
    const departments = (user.role === "ADMIN" || user.role === "DIRECTOR")
      ? await prisma.department.findMany({
          select: { id: true, name: true, code: true },
          orderBy: { code: "asc" }
        })
      : [];

    // Fetch department faculties for filter dropdown if HOD or ADMIN
    const departmentFaculties = isHOD
      ? await prisma.faculty.findMany({
          where: { departmentId: user.departmentId },
          select: { id: true, empName: true, empCode: true, designation: true },
          orderBy: { empName: "asc" }
        })
      : (user.role === "ADMIN" || user.role === "DIRECTOR")
      ? await prisma.faculty.findMany({
          where: searchParams.get("departmentId") && searchParams.get("departmentId") !== "ALL" ? { departmentId: searchParams.get("departmentId")! } : {},
          select: { id: true, empName: true, empCode: true, designation: true, department: { select: { code: true } } },
          orderBy: { empName: "asc" }
        })
      : [];

    // Fetch all mentees assigned or department students (NO artificial cap)
    const mentees = await prisma.student.findMany({
      where: whereClause,
      include: {
        department: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        mentor: { select: { id: true, empName: true, empCode: true, designation: true } },
        mentoringLogs: {
          orderBy: { date: "desc" },
          take: 1,
          include: {
            faculty: { select: { empName: true, designation: true } }
          }
        }
      },
      orderBy: { rollNumber: "asc" }
    });

    if (mentees.length === 0) {
      return NextResponse.json({
        success: true,
        role: user.role,
        isHOD,
        isAdmin: user.role === "ADMIN" || user.role === "DIRECTOR",
        departments,
        departmentFaculties,
        stats: { total: 0, safe: 0, condonation: 0, detention: 0, noClasses: 0 },
        students: []
      });
    }

    // High performance batch attendance calculation
    const menteeYears = Array.from(new Set(mentees.map(m => m.year)));
    const menteeSemesters = Array.from(new Set(mentees.map(m => m.semester)));
    const menteeDeptIds = Array.from(new Set(mentees.map(m => m.departmentId)));

    // Fetch subjects for these years and semesters
    const subjects = await prisma.subject.findMany({
      where: {
        year: { in: menteeYears },
        semester: { in: menteeSemesters },
        departmentId: { in: menteeDeptIds }
      },
      select: { id: true, year: true, semester: true, departmentId: true }
    });
    const subjectIdSet = new Set(subjects.map(s => s.id));

    // Fetch batch attendance records once
    const attendanceRecords = await prisma.attendanceHistory.findMany({
      where: {
        year: { in: menteeYears },
        semester: { in: menteeSemesters },
        departmentId: { in: menteeDeptIds },
        type: "ACADEMIC",
        user: { role: { not: "USER" } }
      },
      select: {
        subjectId: true,
        details: true
      }
    });

    // Single-pass ultra-fast attendance indexing O(attendanceRecords)
    const rollSet = new Set(mentees.map(m => m.rollNumber.toUpperCase()));
    const idSet = new Set(mentees.map(m => m.id));
    const attendanceMap = new Map<string, { totalClasses: number; attendedClasses: number }>();

    for (const rec of attendanceRecords) {
      if (rec.subjectId && !subjectIdSet.has(rec.subjectId)) {
        continue;
      }

      let details: any[] = [];
      try {
        details = typeof rec.details === "string" ? JSON.parse(rec.details) : rec.details;
      } catch {
        continue;
      }

      if (Array.isArray(details)) {
        for (const d of details) {
          const r = (d["Roll Number"] || d["rollNumber"] || d["studentRollNumber"] || "").toString().trim().toUpperCase();
          const sid = d.studentId;
          const matchKey = r && rollSet.has(r) ? r : (sid && idSet.has(sid) ? sid : null);
          if (!matchKey) continue;

          let entry = attendanceMap.get(matchKey);
          if (!entry) {
            entry = { totalClasses: 0, attendedClasses: 0 };
            attendanceMap.set(matchKey, entry);
          }

          entry.totalClasses++;
          const status = String(d["Status"] || d["status"] || "").toLowerCase();
          const isPresent = status === "present" || status === "p" || d.isPresent === true;
          if (isPresent) {
            entry.attendedClasses++;
          }
        }
      }
    }

    // Fetch active backlogs in one grouped query
    const studentIds = mentees.map(m => m.id);
    const failResults = await prisma.semesterResult.groupBy({
      by: ["studentId"],
      where: {
        studentId: { in: studentIds },
        sgpa: { in: ["F", "FAIL", "0", "0.0", "0.00"] }
      },
      _count: { id: true }
    });
    const backlogMap = new Map<string, number>();
    for (const r of failResults) {
      backlogMap.set(r.studentId, r._count.id);
    }

    // Instant memory mapping for each mentee
    const enrichedStudents = mentees.map((st) => {
      const att = attendanceMap.get(st.rollNumber.toUpperCase()) || attendanceMap.get(st.id) || { totalClasses: 0, attendedClasses: 0 };
      const totalClasses = att.totalClasses;
      const attendedClasses = att.attendedClasses;

      let percentage: number | null = null;
      let healthTier: "SAFE" | "CONDONATION" | "DETENTION" | "NO_CLASSES" = "NO_CLASSES";

      if (totalClasses > 0) {
        percentage = Math.round((attendedClasses / totalClasses) * 1000) / 10;
        if (percentage < 65) {
          healthTier = "DETENTION";
        } else if (percentage < 75) {
          healthTier = "CONDONATION";
        } else {
          healthTier = "SAFE";
        }
      }

      const backlogsCount = backlogMap.get(st.id) || 0;

      return {
        id: st.id,
        rollNumber: st.rollNumber,
        name: st.name,
        mobile: st.mobile,
        parentMobile: st.studentContactNumber || st.mobile,
        email: st.emailId || st.domainMailId,
        photoUrl: st.photoUrl,
        year: st.year,
        semester: st.semester,
        department: st.department.name,
        deptCode: st.department.code,
        section: st.section?.name || "A",
        totalClasses,
        attendedClasses,
        attendancePercentage: percentage !== null ? percentage : 0,
        hasAttendanceData: totalClasses > 0,
        healthTier,
        backlogsCount,
        mentorId: st.mentor?.id || null,
        mentorName: st.mentor?.empName || null,
        mentorCode: st.mentor?.empCode || null,
        mentorDesignation: st.mentor?.designation || null,
        lastCounselingDate: st.mentoringLogs[0]?.date || null,
        lastCounselingRemarks: st.mentoringLogs[0]?.remarks || null,
        lastCounselingRecordedBy: st.mentoringLogs[0]?.recordedBy || (st.mentoringLogs[0]?.faculty?.empName ? `Recorded through ${st.mentoringLogs[0]?.faculty?.empName} (Mentor)` : null)
      };
    });

    const safeCount = enrichedStudents.filter(s => s.healthTier === "SAFE").length;
    const condonationCount = enrichedStudents.filter(s => s.healthTier === "CONDONATION").length;
    const detentionCount = enrichedStudents.filter(s => s.healthTier === "DETENTION").length;
    const noClassesCount = enrichedStudents.filter(s => s.healthTier === "NO_CLASSES").length;

    return NextResponse.json({
      success: true,
      role: user.role,
      isHOD,
      isAdmin: user.role === "ADMIN" || user.role === "DIRECTOR",
      departments,
      departmentFaculties,
      stats: {
        total: enrichedStudents.length,
        safe: safeCount,
        condonation: condonationCount,
        detention: detentionCount,
        noClasses: noClassesCount
      },
      students: enrichedStudents
    });
  } catch (error: any) {
    console.error("Error fetching faculty mentees:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch mentees" }, { status: 500 });
  }
}
