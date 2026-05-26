import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  if (departmentId) where.departmentId = departmentId;
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
        subject: { select: { id: true, name: true, code: true, type: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        scheme: true,
        publishRecord: true,
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
    return NextResponse.json(papers);
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
    const { academicYearId, departmentId, year, semester, sectionId, subjectId, examType, schemeId, totalMarks } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId || !examType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if paper already exists for this combination
    const existing = await prisma.midExamPaper.findUnique({
      where: { academicYearId_departmentId_year_semester_sectionId_subjectId_examType: {
        academicYearId, departmentId, year, semester, sectionId, subjectId, examType
      }}
    });
    if (existing) {
      return NextResponse.json({ error: "A paper already exists for this combination", paperId: existing.id }, { status: 409 });
    }

    const paper = await prisma.midExamPaper.create({
      data: {
        academicYearId, departmentId, year, semester, sectionId, subjectId, examType,
        schemeId: schemeId ?? null,
        totalMarks: totalMarks ?? 30,
        createdById: session.user.id,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } },
        questions: { include: { subQuestions: true } }
      }
    });

    return NextResponse.json(paper);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create paper" }, { status: 500 });
  }
}
