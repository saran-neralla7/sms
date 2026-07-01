import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logging";

// GET all papers for a given academic class (with full question structure)
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
  const examType = searchParams.get("examType");

  const where: any = {};
  if (academicYearId) where.academicYearId = academicYearId;
  if (departmentId) {
    where.subject = { departmentId };
  }
  if (year) where.year = year;
  if (semester) where.semester = semester;
  if (sectionId) where.sectionId = sectionId;
  if (subjectId) where.subjectId = subjectId;
  if (examType) where.examType = examType;

  // Faculty can only see their assigned subjects
  const role = (session.user as any).role;
  if (role === "FACULTY") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { faculty: true }
    });
    if (user?.faculty) {
      const mappings = await prisma.facultySubjectMapping.findMany({
        where: { facultyId: user.faculty.id, ...(academicYearId && { academicYearId }) },
        select: { subjectId: true, sectionId: true }
      });
      const subjectIds = mappings.map(m => m.subjectId);
      const sectionIds = mappings.map(m => m.sectionId);
      if (subjectIds.length > 0) {
        where.subjectId = subjectId ? subjectId : { in: subjectIds };
        if (!sectionId) where.sectionId = { in: sectionIds };
      }
    }
  }
  try {
    const papers = await prisma.midExamPaper.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            department: { select: { code: true } }
          }
        },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        scheme: true,
        publishRecord: true,
        masterPaper: {
          include: {
            questions: {
              orderBy: { questionNo: "asc" },
              include: {
                subQuestions: { orderBy: { order: "asc" } },
                choiceGroup: true,
              }
            }
          }
        },
        questions: {
          orderBy: { questionNo: "asc" },
          include: {
            subQuestions: { orderBy: { order: "asc" } },
            choiceGroup: true,
          }
        }
      },
      orderBy: [{ examType: "asc" }, { createdAt: "desc" }]
    });

    // Resolve faculty names from mappings
    const papersWithFaculty = await Promise.all(papers.map(async (paper) => {
      const mapping = await prisma.facultySubjectMapping.findFirst({
        where: {
          academicYearId: paper.academicYearId,
          subjectId: paper.subjectId,
          sectionId: paper.sectionId,
        },
        include: { faculty: { select: { empName: true } } }
      });
      const paperObj = {
        ...paper,
        facultyName: mapping?.faculty?.empName || "Not Assigned",
      };
      if (paper.masterPaperId && paper.masterPaper) {
        paperObj.questions = paper.masterPaper.questions;
      }
      return paperObj;
    }));

    return NextResponse.json(papersWithFaculty);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch papers" }, { status: 500 });
  }
}

// POST — create a new question paper
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      academicYearId, departmentId, year, semester, sectionId, subjectId, examType, schemeId, totalMarks,
      sourcePaperId, examDate, isCommon = false, commonText = null, masterPaperId = null
    } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId || !examType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    const resolvedDeptId = subject.departmentId;

    // Check if paper already exists for this combination
    const existing = await prisma.midExamPaper.findUnique({
      where: { academicYearId_departmentId_year_semester_sectionId_subjectId_examType: {
        academicYearId, departmentId: resolvedDeptId, year, semester, sectionId, subjectId, examType
      }}
    });
    if (existing) {
      return NextResponse.json({ error: "A paper already exists for this combination", paperId: existing.id }, { status: 409 });
    }

    const paper = await prisma.midExamPaper.create({
      data: {
        academicYearId, departmentId: resolvedDeptId, year, semester, sectionId, subjectId, examType,
        schemeId: schemeId ?? null,
        totalMarks: totalMarks ?? 30,
        examDate: examDate ?? null,
        createdById: session.user.id,
        isCommon,
        commonText,
        masterPaperId,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        questions: { include: { subQuestions: true } }
      }
    });

    // If sourcePaperId is provided and masterPaperId is not provided, deep-clone questions & subquestions & choicegroups
    if (sourcePaperId && !masterPaperId) {
      const sourceChoiceGroups = await prisma.midExamChoiceGroup.findMany({
        where: { paperId: sourcePaperId }
      });
      const choiceGroupIdMap: Record<string, string> = {};
      for (const cg of sourceChoiceGroups) {
        const newCg = await prisma.midExamChoiceGroup.create({
          data: {
            paperId: paper.id,
            groupNo: cg.groupNo
          }
        });
        choiceGroupIdMap[cg.id] = newCg.id;
      }

      const sourceQuestions = await prisma.midExamQuestion.findMany({
        where: { paperId: sourcePaperId },
        include: { subQuestions: true }
      });

      for (const q of sourceQuestions) {
        const newCgId = q.choiceGroupId ? choiceGroupIdMap[q.choiceGroupId] : null;
        const newQ = await prisma.midExamQuestion.create({
          data: {
            paperId: paper.id,
            questionNo: q.questionNo,
            isCompulsory: q.isCompulsory,
            choiceGroupId: newCgId
          }
        });

        for (const sq of q.subQuestions) {
          await prisma.midExamSubQuestion.create({
            data: {
              questionId: newQ.id,
              subLabel: sq.subLabel,
              questionText: sq.questionText,
              maxMarks: sq.maxMarks,
              coMapping: sq.coMapping,
              btLevel: sq.btLevel || "L1",
              order: sq.order
            }
          });
        }
      }
    }

    // Audit Log for Mid Exam Paper Creation
    await logActivity(
      session.user.id,
      "CREATE",
      "MidExamPaper",
      paper.id,
      {
        academicYearId: paper.academicYearId,
        subjectCode: paper.subject.code,
        subjectName: paper.subject.name,
        sectionName: paper.section.name,
        examType: paper.examType,
        totalMarks: paper.totalMarks
      }
    );

    return NextResponse.json(paper);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create paper" }, { status: 500 });
  }
}
