import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const academicYearId = searchParams.get("academicYearId");
  const departmentId = searchParams.get("departmentId");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const sectionId = searchParams.get("sectionId");
  const examType = searchParams.get("examType"); // MID_I or MID_II

  if (!academicYearId || !departmentId || !year || !semester || !sectionId || !examType) {
    return NextResponse.json({ error: "All filters required" }, { status: 400 });
  }

  try {
    // 1. Fetch academic class details
    const [students, academicYear, department, section, subjects] = await Promise.all([
      prisma.student.findMany({
        where: { departmentId, year, semester, sectionId, isAlumni: false },
        select: { id: true, rollNumber: true, name: true },
        orderBy: { rollNumber: "asc" }
      }),
      prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } }),
      prisma.department.findUnique({ where: { id: departmentId }, select: { name: true, code: true } }),
      prisma.section.findUnique({ where: { id: sectionId }, select: { name: true } }),
      prisma.subject.findMany({
        where: { departmentId, year, semester },
        select: { id: true, name: true, code: true, shortName: true, type: true },
        orderBy: { code: "asc" }
      })
    ]);

    const isFacultyOnly = session.user.role === "FACULTY";
    let allowedSubjectIds = subjects.map(s => s.id);

    if (isFacultyOnly) {
      let facultyId = (session.user as any).facultyId;
      if (!facultyId) {
        const faculty = await prisma.faculty.findFirst({
          where: { user: { username: session.user.username } }
        });
        if (faculty) {
          facultyId = faculty.id;
        }
      }
      if (facultyId) {
        const facultyMappings = await prisma.facultySubjectMapping.findMany({
          where: {
            facultyId,
            academicYearId,
            sectionId
          },
          select: {
            subjectId: true
          }
        });
        allowedSubjectIds = facultyMappings.map(m => m.subjectId);
      } else {
        allowedSubjectIds = [];
      }
    }

    const filteredSubjects = subjects.filter(sub => allowedSubjectIds.includes(sub.id));
    const studentIds = students.map(s => s.id);
    const subjectIds = filteredSubjects.map(s => s.id);

    // 2. Fetch papers for these subjects, section, academic year and examType
    const papers = await prisma.midExamPaper.findMany({
      where: {
        subjectId: { in: subjectIds },
        sectionId,
        academicYearId,
        examType,
      },
      include: {
        subject: true,
        questions: {
          include: {
            subQuestions: true
          }
        },
        masterPaper: {
          include: {
            questions: {
              include: {
                subQuestions: true
              }
            }
          }
        }
      }
    });

    // Handle common papers questions mapping
    for (const paper of papers) {
      if (paper.masterPaperId && paper.masterPaper) {
        (paper as any).questions = paper.masterPaper.questions;
      }
    }

    const paperIds = papers.map(p => p.id);
    const allPaperIdsForCg = [
      ...paperIds,
      ...papers.map(p => p.masterPaperId).filter(Boolean) as string[]
    ];

    // 3. Fetch choice groups for these papers (and their master papers)
    const choiceGroups = await prisma.midExamChoiceGroup.findMany({
      where: { paperId: { in: allPaperIdsForCg } },
      include: {
        questions: {
          include: {
            subQuestions: true
          }
        }
      }
    });

    // 4. Fetch all marks entries for these papers
    const marksEntries = await prisma.midExamMarksEntry.findMany({
      where: {
        paperId: { in: paperIds },
        studentId: { in: studentIds },
      }
    });

    // 5. Fetch attendance records for this section in the semester
    const attendanceRecords = await prisma.attendanceHistory.findMany({
      where: {
        sectionId,
        year,
        semester,
        user: { role: { not: "USER" } },
        type: "ACADEMIC"
      }
    });

    // 6. Compute overall attendance for each student
    const studentAttendance: Record<string, { total: number; attended: number; percent: number }> = {};
    students.forEach(s => {
      studentAttendance[s.rollNumber] = { total: 0, attended: 0, percent: 100 };
    });

    attendanceRecords.forEach(record => {
      try {
        const details = JSON.parse(record.details);
        details.forEach((s: any) => {
          const roll = s["Roll Number"] || s["rollNumber"];
          const status = s["Status"] || s["status"];
          if (roll && studentAttendance[roll]) {
            studentAttendance[roll].total += 1;
            if (status === "Present" || status === "present") {
              studentAttendance[roll].attended += 1;
            }
          }
        });
      } catch (e) {
        // Fallback or ignore
      }
    });

    // Calculate percentages
    students.forEach(s => {
      const att = studentAttendance[s.rollNumber];
      if (att && att.total > 0) {
        att.percent = parseFloat(((att.attended / att.total) * 100).toFixed(2));
      } else {
        att.percent = 100.00; // default to 100 if no classes held
      }
    });

    // 7. Calculate student marks per paper
    // Map paperId -> studentId -> { totalMarks, isAbsent }
    const paperStudentTotals: Record<string, Record<string, { total: number; isAbsent: boolean }>> = {};

    papers.forEach(paper => {
      paperStudentTotals[paper.id] = {};
      const paperChoiceGroups = choiceGroups.filter(cg => cg.paperId === (paper.masterPaperId || paper.id));

      students.forEach(student => {
        const studentEntries = marksEntries.filter(e => e.paperId === paper.id && e.studentId === student.id);
        
        // If there are no entries for this student, check if other students have entries.
        // If nobody has entries for this paper, it means the exam hasn't been conducted/entered.
        const hasAnyEntriesForPaper = marksEntries.some(e => e.paperId === paper.id);
        if (!hasAnyEntriesForPaper) {
          return;
        }

        const isAbsent = studentEntries.length > 0 ? studentEntries.some(e => e.isAbsent) : true;
        
        const marksMap: Record<string, number | null> = {};
        studentEntries.forEach(e => {
          marksMap[e.subQuestionId] = e.marksObtained;
        });

        const { total } = calculateStudentTotal(paper.questions, paperChoiceGroups, marksMap, isAbsent);

        paperStudentTotals[paper.id][student.id] = {
          total: isAbsent ? 0 : total,
          isAbsent
        };
      });
    });

    // 8. Compute subject-wise statistics
    const subjectAnalysis = papers.map((paper, idx) => {
      const totalsMap = paperStudentTotals[paper.id];
      const totalsList = Object.values(totalsMap || {});

      const strength = students.length;
      const absentees = totalsList.filter(t => t.isAbsent).length;
      const presentTotals = totalsList.filter(t => !t.isAbsent).map(t => t.total);
      
      const average = presentTotals.length > 0 
        ? parseFloat((presentTotals.reduce((a, b) => a + b, 0) / presentTotals.length).toFixed(2))
        : 0;

      const gap = parseFloat((paper.totalMarks - average).toFixed(2));
      const difficultyIndex = paper.totalMarks > 0
        ? parseFloat(((average / paper.totalMarks) * 100).toFixed(1))
        : 0;

      const insight = difficultyIndex >= 60 ? "Good" : difficultyIndex >= 40 ? "Moderate" : "Poor";
      const remarks = difficultyIndex >= 60 ? "Easy" : difficultyIndex >= 40 ? "Moderate" : "Difficult";

      return {
        sNo: idx + 1,
        subjectId: paper.subjectId,
        subjectName: paper.subject.name,
        subjectCode: paper.subject.code,
        classStrength: strength,
        absentees,
        average,
        gap,
        difficultyIndex,
        insight,
        remarks
      };
    });

    // 9. Compute student-wise performance category and cross-tabulate with attendance
    let topPerformers = 0;
    let middlePerformers = 0;
    let lowPerformers = 0;

    // Cross tab counters
    const matrix = {
      highAttHighPerf: 0,
      highAttMediumPerf: 0,
      highAttLowPerf: 0,
      mediumAttHighPerf: 0,
      mediumAttMediumPerf: 0,
      mediumAttLowPerf: 0,
      lowAttHighPerf: 0,
      lowAttMediumPerf: 0,
      lowAttLowPerf: 0,
    };

    // We only categorize students who have wrote at least one paper
    const activePapers = papers.filter(p => Object.keys(paperStudentTotals[p.id] || {}).length > 0);

    students.forEach(student => {
      let totalObtained = 0;
      let totalMax = 0;
      let wroteAny = false;

      activePapers.forEach(paper => {
        const studentRes = paperStudentTotals[paper.id]?.[student.id];
        if (studentRes && !studentRes.isAbsent) {
          totalObtained += studentRes.total;
          totalMax += paper.totalMarks;
          wroteAny = true;
        } else if (studentRes && studentRes.isAbsent) {
          totalMax += paper.totalMarks;
          wroteAny = true;
        }
      });

      const avgPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      const scaledAverage = (avgPercentage / 100) * 30; // scaled out of 30

      // Performance classification
      let perfCategory: "High" | "Medium" | "Low" = "Low";
      if (scaledAverage >= 18) {
        topPerformers++;
        perfCategory = "High";
      } else if (scaledAverage >= 12) {
        middlePerformers++;
        perfCategory = "Medium";
      } else {
        lowPerformers++;
        perfCategory = "Low";
      }

      // Attendance classification
      const attPct = studentAttendance[student.rollNumber]?.percent ?? 100;
      let attCategory: "High" | "Medium" | "Low" = "Low";
      if (attPct >= 75) {
        attCategory = "High";
      } else if (attPct >= 65) {
        attCategory = "Medium";
      } else {
        attCategory = "Low";
      }

      // Matrix update
      if (attCategory === "High" && perfCategory === "High") matrix.highAttHighPerf++;
      else if (attCategory === "High" && perfCategory === "Medium") matrix.highAttMediumPerf++;
      else if (attCategory === "High" && perfCategory === "Low") matrix.highAttLowPerf++;
      else if (attCategory === "Medium" && perfCategory === "High") matrix.mediumAttHighPerf++;
      else if (attCategory === "Medium" && perfCategory === "Medium") matrix.mediumAttMediumPerf++;
      else if (attCategory === "Medium" && perfCategory === "Low") matrix.mediumAttLowPerf++;
      else if (attCategory === "Low" && perfCategory === "High") matrix.lowAttHighPerf++;
      else if (attCategory === "Low" && perfCategory === "Medium") matrix.lowAttMediumPerf++;
      else if (attCategory === "Low" && perfCategory === "Low") matrix.lowAttLowPerf++;
    });

    return NextResponse.json({
      metadata: {
        academicYear: academicYear?.name,
        department: department?.name,
        departmentCode: department?.code,
        section: section?.name,
        year,
        semester,
        examType,
      },
      subjectAnalysis,
      performance: {
        top: topPerformers,
        middle: middlePerformers,
        low: lowPerformers,
        total: students.length,
      },
      matrix
    });

  } catch (e) {
    console.error("Mid Exam Analysis Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
