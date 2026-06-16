import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET single paper with full question/subquestion structure
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const paper = await prisma.midExamPaper.findUnique({
      where: { id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            department: { select: { id: true, name: true, code: true } }
          }
        },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        scheme: true,
        publishRecord: true,
        questions: {
          orderBy: { questionNo: "asc" },
          include: {
            choiceGroup: true,
            subQuestions: { orderBy: { order: "asc" } }
          }
        }
      }
    });
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    return NextResponse.json(paper);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch paper" }, { status: 500 });
  }
}

// PATCH — update paper metadata OR full question structure (upsert)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const paper = await prisma.midExamPaper.findUnique({ where: { id } });
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  const role = (session.user as any).role;
  const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);

  // Only admin can edit frozen papers
  if (paper.isFrozen && !isAdmin) {
    return NextResponse.json({ error: "Paper is frozen. Only admin can edit." }, { status: 403 });
  }

  try {
    const body = await req.json();

    // If questions are included, do full structure upsert
    if (body.questions) {
      // Delete all existing questions (cascade deletes subquestions)
      await prisma.midExamQuestion.deleteMany({ where: { paperId: id } });
      await prisma.midExamChoiceGroup.deleteMany({ where: { paperId: id } });

      // Re-create from scratch
      const choiceGroupMap: Record<number, string> = {};

      for (const q of body.questions) {
        // Handle choice group
        let choiceGroupId: string | null = null;
        if (!q.isCompulsory && q.choiceGroupNo) {
          if (!choiceGroupMap[q.choiceGroupNo]) {
            const cg = await prisma.midExamChoiceGroup.create({
              data: { paperId: id, groupNo: q.choiceGroupNo }
            });
            choiceGroupMap[q.choiceGroupNo] = cg.id;
          }
          choiceGroupId = choiceGroupMap[q.choiceGroupNo];
        }

        const question = await prisma.midExamQuestion.create({
          data: {
            paperId: id,
            questionNo: q.questionNo,
            isCompulsory: q.isCompulsory,
            choiceGroupId,
          }
        });

        // Create subquestions
        if (q.subQuestions?.length > 0) {
          await prisma.midExamSubQuestion.createMany({
            data: q.subQuestions.map((sq: any, idx: number) => ({
              questionId: question.id,
              subLabel: sq.subLabel,
              questionText: sq.questionText || "",
              imageUrl: sq.imageUrl || null,
              maxMarks: sq.maxMarks,
              coMapping: sq.coMapping || "CO1",
              btLevel: sq.btLevel || "L1",
              order: idx,
            }))
          });
        }
      }

      // Update paper total marks
      const updatedPaper = await prisma.midExamPaper.update({
        where: { id },
        data: {
          totalMarks: body.totalMarks ?? paper.totalMarks,
          schemeId: body.schemeId ?? paper.schemeId,
          examDate: body.examDate !== undefined ? body.examDate : paper.examDate,
        },
        include: {
          questions: {
            orderBy: { questionNo: "asc" },
            include: { subQuestions: { orderBy: { order: "asc" } }, choiceGroup: true }
          },
          scheme: true,
          publishRecord: true,
        }
      });
      return NextResponse.json(updatedPaper);
    }

    // Simple metadata update
    const updated = await prisma.midExamPaper.update({
      where: { id },
      data: {
        totalMarks: body.totalMarks ?? paper.totalMarks,
        schemeId: body.schemeId ?? paper.schemeId,
        examDate: body.examDate !== undefined ? body.examDate : paper.examDate,
      }
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update paper" }, { status: 500 });
  }
}

// DELETE paper (admin only, or unfrozen)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const role = (session.user as any).role;

  const paper = await prisma.midExamPaper.findUnique({ where: { id } });
  if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (paper.isFrozen && !["ADMIN", "DIRECTOR"].includes(role)) {
    return NextResponse.json({ error: "Cannot delete frozen paper" }, { status: 403 });
  }

  await prisma.midExamPaper.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
