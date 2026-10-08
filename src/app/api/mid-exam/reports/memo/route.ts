import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal, calculateInternalMarks, scaleMidMarks } from "@/lib/mid-exam-calc";
import { getStudentsForClass } from "@/lib/student-utils";
import { getElectiveBatches } from "@/lib/elective-batches";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const subjectId = searchParams.get("subjectId");

  if (!academicYearId || !year || !semester) {
    return NextResponse.json({ error: "Required filters missing" }, { status: 400 });
  }

  try {
    const isAllSections = sectionId === "ALL";

    let singleSubject: any = null;

    if (subjectId) {
      singleSubject = await prisma.subject.findUnique({
        where: { id: subjectId },
        include: {
          electiveSlotRelation: true,
          department: { select: { id: true, name: true, code: true } }
        }
      });
    }

    let students: any[] = [];
    let academicYear: any = null;
    let department: any = null;
    let section: any = null;
    let subjects: any[] = [];
    const isSingleSubject = !!subjectId;

    if (isSingleSubject) {
      // Single Subject Report
      const [studentsData, ayData, deptData, secData] = await Promise.all([
        getStudentsForClass({
          academicYearId: academicYearId as string,
          departmentId: departmentId || undefined,
          year: year || "",
          semester: semester || "",
          sectionId: isAllSections ? undefined : (sectionId || undefined),
          subjectId: subjectId as string,
          include: {
            department: { select: { id: true, code: true, name: true } },
            section: { select: { id: true, name: true } }
          }
        }),
        prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } }),
        departmentId ? prisma.department.findUnique({ where: { id: departmentId as string }, select: { name: true, code: true } }) : null,
        isAllSections ? { name: "All Sections" } : (sectionId ? prisma.section.findUnique({ where: { id: sectionId as string }, select: { name: true } }) : { name: "All Sections" })
      ]);
      students = studentsData;
      academicYear = ayData;
      department = deptData || (singleSubject?.department ? { id: singleSubject.departmentId, name: singleSubject.department.name, code: singleSubject.department.code } : null);
      section = secData;
      subjects = singleSubject ? [singleSubject] : [];
    } else {
      // Class-Wise Report
      if (!departmentId || !sectionId) {
        return NextResponse.json({ error: "departmentId and sectionId are required for class reports" }, { status: 400 });
      }

      const [studentsData, ayData, deptData, secData, deptSubjects, enrolledElectives] = await Promise.all([
        getStudentsForClass({
          academicYearId: academicYearId as string,
          departmentId: departmentId || undefined,
          year: year || "",
          semester: semester || "",
          sectionId: isAllSections ? undefined : (sectionId || undefined),
          include: {
            department: { select: { id: true, code: true, name: true } },
            section: { select: { id: true, name: true } }
          }
        }),
        prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } }),
        prisma.department.findUnique({ where: { id: departmentId as string }, select: { name: true, code: true } }),
        isAllSections ? { name: "All Sections" } : prisma.section.findUnique({ where: { id: sectionId as string }, select: { name: true } }),
        prisma.subject.findMany({
          where: { departmentId, year, semester },
          select: { id: true, name: true, code: true, shortName: true, type: true, isElective: true, electiveSlotId: true, electiveSlotRelation: true },
          orderBy: { code: "asc" }
        }),
        prisma.subject.findMany({
          where: {
            year,
            semester,
            isElective: true,
            students: {
              some: {
                departmentId,
                year,
                semester
              }
            }
          },
          select: { id: true, name: true, code: true, shortName: true, type: true, isElective: true, electiveSlotId: true, electiveSlotRelation: true },
          orderBy: { code: "asc" }
        })
      ]);

      students = studentsData;
      academicYear = ayData;
      department = deptData;
      section = secData;

      // Filter deptSubjects: omit OE subjects that have 0 students enrolled from this class
      const classStudentIds = students.map(s => s.id);
      const activeDeptSubjects: any[] = [];
      for (const sub of deptSubjects) {
        const isOE = (sub.isElective && (sub.electiveSlotRelation?.name?.toUpperCase()?.startsWith("OE") || sub.electiveSlotRelation?.name?.toUpperCase()?.startsWith("OPEN"))) ||
          sub.name?.toUpperCase()?.startsWith("OPEN ELECTIVE") ||
          sub.code?.toUpperCase()?.startsWith("OPEN ELECTIVE");
        if (isOE) {
          const enrolledCount = await prisma.student.count({
            where: { id: { in: classStudentIds }, subjects: { some: { id: sub.id } } }
          });
          if (enrolledCount > 0) {
            activeDeptSubjects.push(sub);
          }
        } else {
          activeDeptSubjects.push(sub);
        }
      }

      const subMap = new Map<string, any>();
      activeDeptSubjects.forEach(s => subMap.set(s.id, s));
      enrolledElectives.forEach(s => subMap.set(s.id, s));
      subjects = Array.from(subMap.values());
    }

    // Sort subjects: THEORY first, LAB last, then by code
    subjects.sort((a, b) => {
      const typeA = (a.type || "THEORY").toUpperCase();
      const typeB = (b.type || "THEORY").toUpperCase();
      if (typeA === "THEORY" && typeB === "LAB") return -1;
      if (typeA === "LAB" && typeB === "THEORY") return 1;
      return a.code.localeCompare(b.code);
    });

    const studentIds = students.map(s => s.id);
    const subjectIds = subjects.map(s => s.id);

    // Identify which subjects are electives/OEs
    const oeSubjectIds = new Set(
      subjects.filter(sub => {
        return (sub.isElective && (sub.electiveSlotRelation?.name?.toUpperCase()?.startsWith("OE") || sub.electiveSlotRelation?.name?.toUpperCase()?.startsWith("OPEN"))) ||
          sub.name?.toUpperCase()?.startsWith("OPEN ELECTIVE") ||
          sub.code?.toUpperCase()?.startsWith("OPEN ELECTIVE");
      }).map(s => s.id)
    );

    // Fetch enrolled subjects for each student to determine isNotEnrolled
    const studentSubjectsData = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        subjects: { select: { id: true } }
      }
    });
    const studentEnrolledSubjectMap = new Map<string, Set<string>>();
    studentSubjectsData.forEach(st => {
      studentEnrolledSubjectMap.set(st.id, new Set(st.subjects.map(s => s.id)));
    });

    // Fetch papers: for regular subjects check sectionId, for OE subjects include papers across sections/batches
    const regularSubjectIds = subjectIds.filter(id => !oeSubjectIds.has(id));
    const oeSubjectIdsList = subjectIds.filter(id => oeSubjectIds.has(id));

    const paperQueries: any[] = [];
    if (regularSubjectIds.length > 0) {
      paperQueries.push({
        subjectId: { in: regularSubjectIds },
        sectionId: isAllSections ? undefined : (sectionId || undefined),
        academicYearId: academicYearId || undefined,
      });
    }
    if (oeSubjectIdsList.length > 0) {
      paperQueries.push({
        subjectId: { in: oeSubjectIdsList },
        academicYearId: academicYearId || undefined,
      });
    }

    const papers = await prisma.midExamPaper.findMany({
      where: paperQueries.length > 1 ? { OR: paperQueries } : (paperQueries[0] || { id: "__none__" }),
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
        }
      }
    });

    // Handle common papers questions mapping
    for (const paper of papers as any[]) {
      if (paper.masterPaperId && paper.masterPaper) {
        (paper as any).questions = paper.masterPaper.questions;
      }
    }

    const paperIds = papers.map(p => p.id);
    const allPaperIdsForCg = [
      ...paperIds,
      ...papers.map(p => p.masterPaperId).filter(Boolean) as string[]
    ];

    // Fetch choice groups for these papers (and their master papers)
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
        academicYearId: academicYearId || undefined,
        studentId: { in: studentIds },
        subjectId: { in: subjectIds },
        isDraft: false,
      }
    });

    // Pre-calculate batch assignment for OE papers
    const allBatches = getElectiveBatches();
    const paperBatchMap: Record<string, string | null> = {};
    for (const p of papers) {
      if (oeSubjectIds.has(p.subjectId) && p.createdById) {
        const u = await prisma.user.findUnique({
          where: { id: p.createdById },
          include: { faculty: true }
        });
        if (u?.faculty?.id) {
          const m = await prisma.facultySubjectMapping.findFirst({
            where: {
              facultyId: u.faculty.id,
              subjectId: p.subjectId,
              batch: { not: null }
            }
          });
          paperBatchMap[p.id] = m?.batch || null;
        }
      }
    }

    // Build data grid
    const rows = students.map(student => {
      const subjectData: Record<string, any> = {};
      const enrolledSet = studentEnrolledSubjectMap.get(student.id);

      for (const subject of subjects) {
        const isOE = oeSubjectIds.has(subject.id);
        const isStudentEnrolled = !isOE || (enrolledSet ? enrolledSet.has(subject.id) : true);

        if (!isStudentEnrolled) {
          subjectData[subject.id] = {
            mid1: null,
            isMid1Absent: false,
            mid2: null,
            isMid2Absent: false,
            mid1Scaled: null,
            mid2Scaled: null,
            assignment: null,
            internal: 0,
            isNotEnrolled: true
          };
          continue;
        }

        const isLab = subject.type?.toUpperCase() === "LAB";

        let mid1Marks: number | null = null;
        let mid1Max = 30;
        let mid2Marks: number | null = null;
        let mid2Max = 30;

        let isMid1Absent = false;
        let isMid2Absent = false;

        if (isLab) {
          // For labs, fetch from InternalMark where examType is "LAB"
          const labMark = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === "LAB");
          mid1Marks = labMark?.marksObtained ?? null;
          mid1Max = labMark?.maxMarks ?? 50;
          isMid1Absent = labMark?.isAbsent ?? false;
        } else {
          // For theory: MID_I and MID_II papers (ensure we match the student's section or elective batch!)
          const studentBatch = allBatches[`${student.id}_${subject.id}`];

          const mid1Paper = isOE 
            ? (papers.find(p => p.subjectId === subject.id && p.examType === "MID_I" && studentBatch && paperBatchMap[p.id] === studentBatch)
               || papers.find(p => p.subjectId === subject.id && p.examType === "MID_I"))
            : papers.find(p => p.subjectId === subject.id && p.examType === "MID_I" && p.sectionId === student.sectionId);
          const mid2Paper = isOE 
            ? (papers.find(p => p.subjectId === subject.id && p.examType === "MID_II" && studentBatch && paperBatchMap[p.id] === studentBatch)
               || papers.find(p => p.subjectId === subject.id && p.examType === "MID_II"))
            : papers.find(p => p.subjectId === subject.id && p.examType === "MID_II" && p.sectionId === student.sectionId);

          const getPaperTotal = (paper: any, examType: "MID_I" | "MID_II") => {
            if (!paper) {
              // Fallback to internalMark if paper doesn't exist
              const fallback = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === examType);
              return fallback ? { total: fallback.marksObtained, isAbsent: fallback.isAbsent, max: fallback.maxMarks } : null;
            }

            const paperEntries = marksEntries.filter(e => e.paperId === paper.id && e.studentId === student.id);
            const hasSubmitted = marksEntries.some(e => e.paperId === paper.id);

            if (!hasSubmitted) {
              // Fallback to internalMark if it exists
              const fallback = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === examType);
              return fallback ? { total: fallback.marksObtained, isAbsent: fallback.isAbsent, max: fallback.maxMarks } : null;
            }

            const isAbsent = paperEntries.some(e => e.isAbsent);
            const marksMap: Record<string, number | null> = {};
            for (const e of paperEntries) {
              marksMap[e.subQuestionId] = e.marksObtained;
            }

            const paperChoiceGroups = choiceGroups.filter(cg => cg.paperId === (paper.masterPaperId || paper.id));
            const { total } = calculateStudentTotal(paper.questions, paperChoiceGroups, marksMap, isAbsent);

            return {
              total: isAbsent ? 0 : total,
              isAbsent: isAbsent,
              max: paper.totalMarks
            };
          };

          const mid1Result = getPaperTotal(mid1Paper, "MID_I");
          if (mid1Result) {
            mid1Marks = mid1Result.total;
            mid1Max = mid1Result.max;
            isMid1Absent = mid1Result.isAbsent;
          }

          const mid2Result = getPaperTotal(mid2Paper, "MID_II");
          if (mid2Result) {
            mid2Marks = mid2Result.total;
            mid2Max = mid2Result.max;
            isMid2Absent = mid2Result.isAbsent;
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
          isMid1Absent,
          mid2: mid2Marks,
          isMid2Absent,
          mid1Scaled,
          mid2Scaled,
          assignment: assignMarks,
          internal: internalTotal,
          isNotEnrolled: false
        };
      }

      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        department: student.department,
        section: student.section,
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
