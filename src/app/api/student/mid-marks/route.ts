import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const email = session.user.email;
    const student = await prisma.student.findFirst({
      where: { emailId: email }
    });

    if (!student) {
      return NextResponse.json({ error: "Student record not found" }, { status: 404 });
    }

    // Get all subjects registered for this student
    const subjects = await prisma.subject.findMany({
      where: {
        year: student.year,
        semester: student.semester,
        departmentId: student.departmentId
      }
    });

    const activeAY = await prisma.academicYear.findFirst({
      where: { isCurrent: true }
    });
    const currentAYId = activeAY?.id || "";

    const studentMarks: any[] = [];

    for (const sub of subjects) {
      // Find papers for MID I and MID II
      const papers = await prisma.midExamPaper.findMany({
        where: {
          subjectId: sub.id,
          sectionId: student.sectionId,
          academicYearId: currentAYId || undefined,
          isFrozen: true
        },
        include: {
          questions: {
            include: {
              subQuestions: true
            }
          }
        }
      });

      const paperIds = papers.map(p => p.id);
      const choiceGroups = await prisma.midExamChoiceGroup.findMany({
        where: { paperId: { in: paperIds } },
        include: {
          questions: {
            include: {
              subQuestions: true
            }
          }
        }
      });

      // Fetch student marks for these papers
      const marksEntry = await prisma.midExamMarksEntry.findMany({
        where: {
          studentId: student.id,
          subQuestion: {
            question: {
              paperId: { in: papers.map(p => p.id) }
            }
          }
        },
        include: {
          subQuestion: {
            include: {
              question: true
            }
          }
        }
      });

      // Find assignment marks
      const assignmentMark = await prisma.assignmentMark.findFirst({
        where: {
          studentId: student.id,
          subjectId: sub.id,
          academicYearId: currentAYId || undefined,
          isDraft: false
        }
      });

      // Calculate totals for MID I & MID II
      const mid1Paper = papers.find(p => p.examType === "MID_I");
      const mid2Paper = papers.find(p => p.examType === "MID_II");

      const getPaperCalculatedTotal = (paper: any) => {
        if (!paper) return { total: 0, isAbsent: true, details: {} };
        const paperMarks = marksEntry.filter(m => m.subQuestion.question.paperId === paper.id);
        const isAbsent = paperMarks[0]?.isAbsent ?? false;

        const marksMap: Record<string, number | null> = {};
        for (const pm of paperMarks) {
          marksMap[pm.subQuestionId] = pm.marksObtained;
        }

        const paperChoiceGroups = choiceGroups.filter(cg => cg.paperId === paper.id);
        const { total } = calculateStudentTotal(paper.questions, paperChoiceGroups, marksMap, isAbsent);
        return { total, isAbsent, details: marksMap };
      };

      const mid1Result = getPaperCalculatedTotal(mid1Paper);
      const mid2Result = getPaperCalculatedTotal(mid2Paper);

      // Simple scaling (e.g. Average of MIDs + Assignment)
      const mid1Final = mid1Result.isAbsent ? 0 : (mid1Result.total * 20) / (mid1Paper?.totalMarks || 30);
      const mid2Final = mid2Result.isAbsent ? 0 : (mid2Result.total * 20) / (mid2Paper?.totalMarks || 30);
      const assignmentFinal = assignmentMark?.marksObtained || 0;

      // Final internal
      const internalMarks = Math.round(
        ((mid1Final + mid2Final) / 2) + assignmentFinal
      );

      // Compute CO-wise performance
      const coPerformance: Record<string, { obtained: number; max: number; percentage: number }> = {};
      for (const m of marksEntry) {
        if (m.marksObtained !== null) {
          const co = m.subQuestion.coMapping || "CO1";
          if (!coPerformance[co]) {
            coPerformance[co] = { obtained: 0, max: 0, percentage: 0 };
          }
          coPerformance[co].obtained += m.marksObtained;
          coPerformance[co].max += m.subQuestion.maxMarks;
        }
      }

      for (const key of Object.keys(coPerformance)) {
        const item = coPerformance[key];
        item.percentage = item.max > 0 ? Math.round((item.obtained / item.max) * 100) : 0;
      }

      studentMarks.push({
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        mid1: mid1Result.isAbsent ? "AB" : `${mid1Result.total} / ${mid1Paper?.totalMarks || 30}`,
        mid2: mid2Result.isAbsent ? "AB" : `${mid2Result.total} / ${mid2Paper?.totalMarks || 30}`,
        assignment: assignmentFinal,
        calculatedInternal: internalMarks,
        coPerformance
      });
    }

    return NextResponse.json({
      student: {
        name: student.name,
        rollNumber: student.rollNumber,
        year: student.year,
        semester: student.semester
      },
      marks: studentMarks
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Something went wrong" }, { status: 500 });
  }
}
