import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal, calculateInternalMarks, scaleMidMarks } from "@/lib/mid-exam-calc";

/**
 * GET — generate Internal Marks Memo data for PDF rendering on client
 * Returns structured data; PDF is generated client-side with jsPDF
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const academicYearId = searchParams.get("academicYearId");
  const departmentId = searchParams.get("departmentId");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const sectionId = searchParams.get("sectionId");

  if (!academicYearId || !departmentId || !year || !semester || !sectionId) {
    return NextResponse.json({ error: "All filters required" }, { status: 400 });
  }

  try {
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

    const studentIds = students.map(s => s.id);
    const subjectIds = subjects.map(s => s.id);

    // Fetch papers for these subjects, section, and academic year
    const papers = await prisma.midExamPaper.findMany({
      where: {
        subjectId: { in: subjectIds },
        sectionId,
        academicYearId,
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

    // Fetch choice groups for these papers
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

    // Fetch marks entries that are finalized (isDraft: false)
    const marksEntries = await prisma.midExamMarksEntry.findMany({
      where: {
        paperId: { in: paperIds },
        studentId: { in: studentIds },
        isDraft: false,
      }
    });

    // Get internal marks (from existing InternalMark table — published values)
    const internalMarks = await prisma.internalMark.findMany({
      where: {
        academicYearId,
        studentId: { in: studentIds },
        subjectId: { in: subjectIds }
      }
    });

    // Get assignment marks (only finalized ones)
    const assignmentMarks = await prisma.assignmentMark.findMany({
      where: {
        academicYearId, departmentId, year, semester, sectionId,
        studentId: { in: studentIds },
        isDraft: false,
      }
    });

    // Build data grid
    const rows = students.map(student => {
      const subjectData: Record<string, any> = {};

      for (const subject of subjects) {
        const isLab = subject.type?.toUpperCase() === "LAB";

        let mid1Marks: number | null = null;
        let mid1Max = 30;
        let mid2Marks: number | null = null;
        let mid2Max = 30;

        if (isLab) {
          // For labs, fetch from InternalMark where examType is "LAB"
          const labMark = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === "LAB");
          mid1Marks = labMark?.marksObtained ?? null;
          mid1Max = labMark?.maxMarks ?? 50;
        } else {
          // For theory: MID_I and MID_II papers
          const mid1Paper = papers.find(p => p.subjectId === subject.id && p.examType === "MID_I");
          const mid2Paper = papers.find(p => p.subjectId === subject.id && p.examType === "MID_II");

          const getPaperTotal = (paper: any, examType: "MID_I" | "MID_II") => {
            if (!paper) {
              // Fallback to internalMark if paper doesn't exist
              const fallback = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === examType);
              return fallback ? { total: fallback.marksObtained, max: fallback.maxMarks } : null;
            }

            const paperEntries = marksEntries.filter(e => e.paperId === paper.id && e.studentId === student.id);
            const hasSubmitted = marksEntries.some(e => e.paperId === paper.id);

            if (!hasSubmitted) {
              // Fallback to internalMark if it exists
              const fallback = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === examType);
              return fallback ? { total: fallback.marksObtained, max: fallback.maxMarks } : null;
            }

            const isAbsent = paperEntries.some(e => e.isAbsent);
            const marksMap: Record<string, number | null> = {};
            for (const e of paperEntries) {
              marksMap[e.subQuestionId] = e.marksObtained;
            }

            const paperChoiceGroups = choiceGroups.filter(cg => cg.paperId === paper.id);
            const { total } = calculateStudentTotal(paper.questions, paperChoiceGroups, marksMap, isAbsent);

            return {
              total: isAbsent ? 0 : total,
              max: paper.totalMarks
            };
          };

          const mid1Result = getPaperTotal(mid1Paper, "MID_I");
          if (mid1Result) {
            mid1Marks = mid1Result.total;
            mid1Max = mid1Result.max;
          }

          const mid2Result = getPaperTotal(mid2Paper, "MID_II");
          if (mid2Result) {
            mid2Marks = mid2Result.total;
            mid2Max = mid2Result.max;
          }
        }

        const assign = assignmentMarks.find(m => m.studentId === student.id && m.subjectId === subject.id);
        const assignMarks = assign?.marksObtained ?? null;

        const mid1Scaled = mid1Marks !== null ? scaleMidMarks(mid1Marks, mid1Max, 20) : null;
        const mid2Scaled = mid2Marks !== null ? scaleMidMarks(mid2Marks, mid2Max, 20) : null;

        // Calculate internal using default theory scheme
        const internalTotal = calculateInternalMarks({
          mid1Total: mid1Marks,
          mid2Total: mid2Marks,
          mid1MaxMarks: mid1Max,
          mid2MaxMarks: mid2Max,
          mid1ScaledTo: 20,
          mid2ScaledTo: 20,
          assignmentMarks: assignMarks,
          assignmentMax: 10,
          internalMax: isLab ? 50 : 30,
          subjectType: isLab ? "LAB" : "THEORY",
        });

        subjectData[subject.id] = {
          mid1: mid1Marks,
          mid2: mid2Marks,
          mid1Scaled,
          mid2Scaled,
          assignment: assignMarks,
          internal: internalTotal,
        };
      }

      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        subjects: subjectData,
      };
    });

    return NextResponse.json({
      meta: {
        academicYear: academicYear?.name,
        department: department?.name,
        departmentCode: department?.code,
        section: section?.name,
        year,
        semester,
        generatedAt: new Date().toISOString(),
      },
      subjects: subjects.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        shortName: s.shortName,
        type: s.type,
      })),
      rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to generate memo data" }, { status: 500 });
  }
}
