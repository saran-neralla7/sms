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

    // Parse query parameters
    const url = new URL(req.url);
    const queryYear = url.searchParams.get("year");
    const querySem = url.searchParams.get("semester");

    const targetYear = queryYear || student.year;
    const targetSem = querySem || student.semester;

    // Helper to check semester sequence: (y1, s1) <= (y2, s2)
    const isBeforeOrEqual = (y1: string, s1: string, y2: string, s2: string) => {
      const numY1 = parseInt(y1);
      const numS1 = parseInt(s1);
      const numY2 = parseInt(y2);
      const numS2 = parseInt(s2);
      if (numY1 < numY2) return true;
      if (numY1 === numY2 && numS1 <= numS2) return true;
      return false;
    };

    // Validation
    if (!isBeforeOrEqual(targetYear, targetSem, student.year, student.semester)) {
      return NextResponse.json({ error: "Access denied: requested semester is in the future" }, { status: 403 });
    }

    if (student.isLateralEntry && targetYear === "1") {
      return NextResponse.json({ error: "Access denied: lateral entry student has no record in 1st year" }, { status: 403 });
    }

    // Build list of available semesters
    const allSemesters = [
      { year: "1", semester: "1", label: "1-1" },
      { year: "1", semester: "2", label: "1-2" },
      { year: "2", semester: "1", label: "2-1" },
      { year: "2", semester: "2", label: "2-2" },
      { year: "3", semester: "1", label: "3-1" },
      { year: "3", semester: "2", label: "3-2" },
      { year: "4", semester: "1", label: "4-1" },
      { year: "4", semester: "2", label: "4-2" },
    ];

    const availableSemesters = allSemesters.filter(sem => {
      if (student.isLateralEntry && sem.year === "1") {
        return false;
      }
      return isBeforeOrEqual(sem.year, sem.semester, student.year, student.semester);
    });

    // Get current active academic year
    const activeAY = await prisma.academicYear.findFirst({
      where: { isCurrent: true }
    });
    const currentAYId = activeAY?.id || "";

    // Resolve target academic year
    let targetAYId = currentAYId;
    if (targetYear !== student.year && student.batchId) {
      const batch = await prisma.batch.findUnique({
        where: { id: student.batchId }
      });
      if (batch) {
        const startYearNum = batch.startYear;
        const targetStartYear = startYearNum + (parseInt(targetYear) - 1);
        const targetAY = await prisma.academicYear.findFirst({
          where: {
            OR: [
              { name: { startsWith: targetStartYear.toString() } },
              {
                startDate: {
                  gte: new Date(`${targetStartYear}-01-01`),
                  lte: new Date(`${targetStartYear}-12-31`)
                }
              }
            ]
          }
        });
        if (targetAY) {
          targetAYId = targetAY.id;
        } else {
          targetAYId = ""; // empty so we ignore academic year filter and pull from anywhere
        }
      } else {
        targetAYId = "";
      }
    }

    // Get all subjects registered for this student in the target semester, matching regulation if present
    const subjects = await prisma.subject.findMany({
      where: {
        year: targetYear,
        semester: targetSem,
        departmentId: student.departmentId,
        regulationId: student.regulationId || undefined
      }
    });

    const studentMarks: any[] = [];

    for (const sub of subjects) {
      // Find papers for MID I and MID II
      const papers = await prisma.midExamPaper.findMany({
        where: {
          subjectId: sub.id,
          sectionId: student.sectionId,
          academicYearId: targetAYId || undefined,
          isFrozen: true
        },
        include: {
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
          },
          publishRecord: true
        }
      });

      for (const paper of papers) {
        if (paper.masterPaperId && paper.masterPaper) {
          (paper as any).questions = paper.masterPaper.questions;
        }
      }

      const publishedPapers = papers.filter(p => p.publishRecord?.isPublished === true);
      const publishedPaperIds = publishedPapers.map(p => p.id);

      const paperIds = papers.map(p => p.id);
      const allPaperIdsForCg = [
        ...paperIds,
        ...papers.map(p => p.masterPaperId).filter(Boolean) as string[]
      ];

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

      // Fetch student marks only for published papers
      const marksEntry = await prisma.midExamMarksEntry.findMany({
        where: {
          studentId: student.id,
          subQuestion: {
            question: {
              paperId: { in: publishedPaperIds }
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

      // Find assignment marks (must not be draft)
      const assignmentMark = await prisma.assignmentMark.findFirst({
        where: {
          studentId: student.id,
          subjectId: sub.id,
          academicYearId: targetAYId || undefined,
          isDraft: false
        }
      });

      const mid1Paper = papers.find(p => p.examType === "MID_I");
      const mid2Paper = papers.find(p => p.examType === "MID_II");

      const getPaperDisplayValue = (paper: any) => {
        if (!paper) return "-";
        if (!paper.publishRecord?.isPublished) return "Not Published";

        const paperMarks = marksEntry.filter(m => m.subQuestion.question.paperId === paper.id);
        const isAbsent = paperMarks[0]?.isAbsent ?? false;

        const marksMap: Record<string, number | null> = {};
        for (const pm of paperMarks) {
          marksMap[pm.subQuestionId] = pm.marksObtained;
        }

        const paperChoiceGroups = choiceGroups.filter(cg => cg.paperId === (paper.masterPaperId || paper.id));
        const { total } = calculateStudentTotal(paper.questions, paperChoiceGroups, marksMap, isAbsent);

        return isAbsent ? "AB" : `${total} / ${paper.totalMarks}`;
      };

      const mid1Display = getPaperDisplayValue(mid1Paper);
      const mid2Display = getPaperDisplayValue(mid2Paper);

      // Only show calculated internal marks if all scheduled papers are published
      const allScheduledPublished = papers.every(p => p.publishRecord?.isPublished === true);
      const assignmentFinal = assignmentMark?.marksObtained || 0;
      let internalMarks: number | string = "-";

      if (allScheduledPublished && papers.length > 0) {
        const getPaperCalculatedTotal = (paper: any) => {
          if (!paper) return { total: 0, isAbsent: true };
          const paperMarks = marksEntry.filter(m => m.subQuestion.question.paperId === paper.id);
          const isAbsent = paperMarks[0]?.isAbsent ?? false;

          const marksMap: Record<string, number | null> = {};
          for (const pm of paperMarks) {
            marksMap[pm.subQuestionId] = pm.marksObtained;
          }

          const paperChoiceGroups = choiceGroups.filter(cg => cg.paperId === (paper.masterPaperId || paper.id));
          const { total } = calculateStudentTotal(paper.questions, paperChoiceGroups, marksMap, isAbsent);
          return { total, isAbsent };
        };

        const mid1Result = getPaperCalculatedTotal(mid1Paper);
        const mid2Result = getPaperCalculatedTotal(mid2Paper);

        const mid1Final = mid1Result.isAbsent ? 0 : (mid1Result.total * 20) / (mid1Paper?.totalMarks || 30);
        const mid2Final = mid2Result.isAbsent ? 0 : (mid2Result.total * 20) / (mid2Paper?.totalMarks || 30);

        internalMarks = Math.round(
          ((mid1Final + mid2Final) / 2) + assignmentFinal
        );
      }

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
        mid1: mid1Display,
        mid2: mid2Display,
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
        semester: student.semester,
        isLateralEntry: student.isLateralEntry
      },
      availableSemesters,
      selectedSemester: {
        year: targetYear,
        semester: targetSem
      },
      marks: studentMarks
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Something went wrong" }, { status: 500 });
  }
}
