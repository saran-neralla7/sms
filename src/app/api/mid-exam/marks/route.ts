import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";

// GET marks grid for a paper
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const paperId = req.nextUrl.searchParams.get("paperId");
  if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 });

  try {
    const paper = await prisma.midExamPaper.findUnique({
      where: { id: paperId },
      include: {
        subject: true,
        section: true,
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
        },
        publishRecord: true,
      }
    });
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

    if (paper.masterPaperId && paper.masterPaper) {
      (paper as any).questions = paper.masterPaper.questions;
    }

    // Get students for this academic class
    const students = await prisma.student.findMany({
      where: {
        year: paper.year,
        semester: paper.semester,
        sectionId: paper.sectionId,
        departmentId: paper.subject.departmentId,
        isAlumni: false,
        isLeftCollege: false,
        isDetained: false,
      },
      select: { id: true, rollNumber: true, name: true },
      orderBy: { rollNumber: "asc" }
    });

    // Get existing marks entries for this paper
    const entries = await prisma.midExamMarksEntry.findMany({
      where: { paperId },
      select: {
        studentId: true,
        subQuestionId: true,
        marksObtained: true,
        isAbsent: true,
        isDraft: true,
      }
    });

    // Build marks map per student
    const studentMarksMap: Record<string, {
      marks: Record<string, number | null>;
      isAbsent: boolean;
      isDraft: boolean;
    }> = {};

    for (const entry of entries) {
      if (!studentMarksMap[entry.studentId]) {
        studentMarksMap[entry.studentId] = { marks: {}, isAbsent: false, isDraft: true };
      }
      studentMarksMap[entry.studentId].marks[entry.subQuestionId] = entry.marksObtained;
      if (entry.isAbsent) studentMarksMap[entry.studentId].isAbsent = true;
      if (!entry.isDraft) studentMarksMap[entry.studentId].isDraft = false;
    }

    // Flatten subquestions for column headers
    const subQuestions = paper.questions.flatMap(q =>
      q.subQuestions.map(sq => ({
        id: sq.id,
        questionNo: q.questionNo,
        subLabel: sq.subLabel,
        maxMarks: sq.maxMarks,
        coMapping: sq.coMapping,
        isCompulsory: q.isCompulsory,
        choiceGroupId: q.choiceGroupId,
        choiceGroupNo: q.choiceGroup?.groupNo ?? null,
        label: `Q${q.questionNo}${sq.subLabel}`,
      }))
    );

    // Build grid rows
    const rows = students.map(student => {
      const studentData = studentMarksMap[student.id] || { marks: {}, isAbsent: false, isDraft: true };
      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        isAbsent: studentData.isAbsent,
        isDraft: studentData.isDraft,
        marks: studentData.marks,
      };
    });

    return NextResponse.json({
      paper: {
        id: paper.id,
        examType: paper.examType,
        totalMarks: paper.totalMarks,
        isFrozen: paper.isFrozen,
        isLocked: paper.publishRecord?.isLocked ?? false,
        isPublished: paper.publishRecord?.isPublished ?? false,
        subjectName: paper.subject.name,
        subjectCode: paper.subject.code,
        year: paper.year,
        semester: paper.semester,
        sectionName: paper.section.name,
      },
      subQuestions,
      rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load marks grid" }, { status: 500 });
  }
}

// POST — save/update marks (draft or final)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { paperId, entries, isDraft = true } = body;

    if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 });

    const paper = await prisma.midExamPaper.findUnique({
      where: { id: paperId },
      include: { publishRecord: true }
    });
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

    const role = (session.user as any).role;
    const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);

    if (paper.publishRecord?.isLocked && !isAdmin) {
      return NextResponse.json({ error: "Marks are locked" }, { status: 403 });
    }

    // Validate marks don't exceed max
    const targetPaperId = paper.masterPaperId || paperId;
    const subQMap = await prisma.midExamSubQuestion.findMany({
      where: { question: { paperId: targetPaperId } },
      select: { id: true, maxMarks: true }
    });
    const maxMap: Record<string, number> = {};
    for (const sq of subQMap) maxMap[sq.id] = sq.maxMarks;

    const errors: string[] = [];
    for (const entry of entries) {
      if (!entry.isAbsent && entry.marksObtained !== null && entry.marksObtained !== undefined) {
        const max = maxMap[entry.subQuestionId];
        if (max !== undefined && entry.marksObtained > max) {
          errors.push(`Marks ${entry.marksObtained} exceeds max ${max} for subQ ${entry.subQuestionId}`);
        }
        if (entry.marksObtained < 0) {
          errors.push(`Marks cannot be negative`);
        }
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    // Upsert all entries
    for (const entry of entries) {
      await prisma.midExamMarksEntry.upsert({
        where: {
          paperId_studentId_subQuestionId: {
            paperId,
            studentId: entry.studentId,
            subQuestionId: entry.subQuestionId,
          }
        },
        create: {
          paperId,
          studentId: entry.studentId,
          subQuestionId: entry.subQuestionId,
          marksObtained: entry.isAbsent ? null : (entry.marksObtained ?? null),
          isAbsent: entry.isAbsent ?? false,
          isDraft,
          enteredById: session.user.id,
        },
        update: {
          marksObtained: entry.isAbsent ? null : (entry.marksObtained ?? null),
          isAbsent: entry.isAbsent ?? false,
          isDraft,
          enteredById: session.user.id,
          updatedAt: new Date(),
        }
      });
    }

    return NextResponse.json({ success: true, saved: entries.length, isDraft });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save marks" }, { status: 500 });
  }
}
