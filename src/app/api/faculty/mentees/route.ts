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

    // Build student query
    const whereClause: any = {
      isLeftCollege: false
    };

    if (isHOD) {
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

    // Fetch department faculties for filter dropdown if HOD
    const departmentFaculties = isHOD
      ? await prisma.faculty.findMany({
          where: { departmentId: user.departmentId },
          select: { id: true, empName: true, empCode: true, designation: true },
          orderBy: { empName: "asc" }
        })
      : [];

    // Fetch mentees assigned or department students
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
        isHOD,
        departmentFaculties,
        stats: { total: 0, safe: 0, condonation: 0, detention: 0 },
        students: []
      });
    }

    // Compute attendance statistics for each mentee
    const enrichedStudents = await Promise.all(
      mentees.map(async (st) => {
        // Fetch student's valid curriculum subjects
        const subjects = await prisma.subject.findMany({
          where: {
            year: st.year,
            semester: st.semester,
            OR: [
              { departmentId: st.departmentId },
              { students: { some: { id: st.id } } }
            ]
          },
          select: { id: true }
        });
        const subjectIdSet = new Set(subjects.map(s => s.id));

        // Attendance calculation — matching academic stats engine
        const attendanceRecords = await prisma.attendanceHistory.findMany({
          where: {
            year: st.year,
            semester: st.semester,
            type: "ACADEMIC",
            user: { role: { not: "USER" } },
            OR: [
              { departmentId: st.departmentId, sectionId: st.sectionId },
              { details: { contains: st.rollNumber } }
            ]
          },
          select: {
            subjectId: true,
            status: true,
            details: true
          }
        });

        let totalClasses = 0;
        let attendedClasses = 0;

        for (const rec of attendanceRecords) {
          if (rec.subjectId && !subjectIdSet.has(rec.subjectId)) {
            continue;
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
              return (r && String(r).toUpperCase() === st.rollNumber.toUpperCase()) || d.studentId === st.id;
            });
            if (sObj) {
              recordAppliesToStudent = true;
              const status = String(sObj["Status"] || sObj["status"] || "").toLowerCase();
              isPresent = status === "present" || status === "p" || sObj.isPresent === true;
            } else if (rec.status === "Marked Absent") {
              recordAppliesToStudent = true;
              isPresent = true;
            }
          } else if (rec.status === "Marked Absent") {
            recordAppliesToStudent = true;
            isPresent = true;
          }

          if (recordAppliesToStudent) {
            totalClasses++;
            if (isPresent) attendedClasses++;
          }
        }

        const percentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 1000) / 10 : 100;

        // Health tier
        let healthTier: "SAFE" | "CONDONATION" | "DETENTION" = "SAFE";
        if (percentage < 65) {
          healthTier = "DETENTION";
        } else if (percentage < 75) {
          healthTier = "CONDONATION";
        }

        // Active backlogs count
        const backlogsCount = await prisma.semesterResult.count({
          where: {
            studentId: st.id,
            sgpa: { in: ["F", "FAIL", "0", "0.0", "0.00"] }
          }
        });

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
          section: st.section.name,
          totalClasses,
          attendedClasses,
          attendancePercentage: percentage,
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
      })
    );

    const safeCount = enrichedStudents.filter(s => s.healthTier === "SAFE").length;
    const condonationCount = enrichedStudents.filter(s => s.healthTier === "CONDONATION").length;
    const detentionCount = enrichedStudents.filter(s => s.healthTier === "DETENTION").length;

    return NextResponse.json({
      success: true,
      isHOD,
      departmentFaculties,
      stats: {
        total: enrichedStudents.length,
        safe: safeCount,
        condonation: condonationCount,
        detention: detentionCount
      },
      students: enrichedStudents
    });
  } catch (error: any) {
    console.error("Error fetching faculty mentees:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch mentees" }, { status: 500 });
  }
}
