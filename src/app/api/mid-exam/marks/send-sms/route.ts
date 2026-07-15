import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMarksSMS } from "@/lib/sms";
import { isBSHHod } from "@/lib/permissions";
import { getStudentsForClass } from "@/lib/student-utils";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role)) {
    return NextResponse.json({ error: "Forbidden. Only admins/HODs can send parent SMS." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { academicYearId, departmentId, year, semester, sectionId, examType, studentIds, allowUnpublished } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !examType) {
      return NextResponse.json({ error: "All filter fields are required." }, { status: 400 });
    }

    const isBSH = isBSHHod(session.user);
    if (isBSH && year !== "1") {
      return NextResponse.json({ error: "BSH HOD can only send SMS for Year 1 students." }, { status: 403 });
    }

    // 1. Fetch all theory subjects matching the academic class criteria
    const theorySubjects = await prisma.subject.findMany({
      where: {
        departmentId,
        year,
        semester,
        type: { not: "LAB" }
      },
      select: {
        id: true,
        name: true,
        code: true,
        shortName: true
      }
    });

    if (theorySubjects.length === 0) {
      return NextResponse.json({ error: "No theory subjects found for this class." }, { status: 400 });
    }

    // 2. Fetch created papers for these subjects, section, and academic year
    const papers = await prisma.midExamPaper.findMany({
      where: {
        subjectId: { in: theorySubjects.map(s => s.id) },
        sectionId,
        academicYearId,
        examType
      },
      include: {
        publishRecord: true
      }
    });

    // 3. Verify that every theory subject has a paper and it is published
    const unpublishedSubjects = [];
    for (const sub of theorySubjects) {
      const paper = papers.find(p => p.subjectId === sub.id);
      if (!paper || !paper.publishRecord?.isPublished) {
        unpublishedSubjects.push(sub);
      }
    }

    if (unpublishedSubjects.length > 0 && !allowUnpublished) {
      const names = unpublishedSubjects.map(s => `${s.code} - ${s.name}`).join(", ");
      return NextResponse.json({
        error: `Cannot send SMS. The following theory subjects have not been published yet: ${names}`,
        unpublishedSubjects: unpublishedSubjects.map(s => ({ id: s.id, code: s.code, name: s.name }))
      }, { status: 400 });
    }

    // 4. Fetch students in the section
    const allStudents = await getStudentsForClass({
      academicYearId,
      departmentId,
      year,
      semester,
      sectionId
    });

    if (allStudents.length === 0) {
      return NextResponse.json({ error: "No active students found in this section." }, { status: 400 });
    }

    const students = studentIds && Array.isArray(studentIds) && studentIds.length > 0
      ? allStudents.filter(s => studentIds.includes(s.id))
      : allStudents;

    if (students.length === 0) {
      return NextResponse.json({ error: "No selected students found in this section." }, { status: 400 });
    }

    // 5. Fetch internal marks for theory subjects
    const marks = await prisma.internalMark.findMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        subjectId: { in: theorySubjects.map(s => s.id) },
        academicYearId,
        examType
      },
      include: {
        subject: true
      }
    });

    // 6. Fetch marks entries to check for absenteeism
    const paperIds = papers.map(p => p.id);
    const marksEntries = await prisma.midExamMarksEntry.findMany({
      where: {
        paperId: { in: paperIds },
        studentId: { in: students.map(s => s.id) }
      },
      select: {
        paperId: true,
        studentId: true,
        isAbsent: true
      }
    });

    // 7. Fire-and-forget SMS dispatch in background to avoid client timeout
    (async () => {
      try {
        for (const student of students) {
          const subjectsList: { name: string; marks: string | number }[] = [];

          for (const sub of theorySubjects) {
            const paperForSub = papers.find(p => p.subjectId === sub.id);
            const studentEntries = marksEntries.filter(
              e => e.studentId === student.id && e.paperId === paperForSub?.id
            );
            const isAbsent = studentEntries.some(e => e.isAbsent);

            if (isAbsent) {
              subjectsList.push({
                name: sub.shortName || sub.name,
                marks: "A"
              });
            } else {
              const markRecord = marks.find(
                m => m.studentId === student.id && m.subjectId === sub.id
              );
              subjectsList.push({
                name: sub.shortName || sub.name,
                marks: markRecord ? markRecord.marksObtained : "-"
              });
            }
          }

          const mobile = student.mobile || student.studentContactNumber;
          if (mobile) {
            const cleanMobile = mobile.replace(/\D/g, "");
            if (cleanMobile.length >= 10) {
              const result = await sendMarksSMS(
                cleanMobile,
                student.name,
                student.rollNumber,
                year,
                semester,
                subjectsList,
                examType
              );

              await prisma.sMSLog.create({
                data: {
                  studentId: student.id,
                  sentById: session.user.id,
                  targetDate: new Date(),
                  mobileNumber: cleanMobile,
                  messageType: "MARKS_ALERT",
                  status: result.success ? "SUCCESS" : "FAILED",
                  gatewayResponse: result.response,
                }
              });
            }
          }
        }
      } catch (smsErr) {
        console.error("Background bulk marks SMS dispatch error:", smsErr);
      }
    })();

    return NextResponse.json({
      success: true,
      message: `SMS dispatch started in background for ${students.length} students.`
    });

  } catch (error) {
    console.error("Failed to process send-sms API:", error);
    return NextResponse.json({ error: "Failed to send SMS." }, { status: 500 });
  }
}
