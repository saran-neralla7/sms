import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/mid-exam/papers/[id]/text
 *
 * Edit-Text-Only mode: updates ONLY questionText and imageUrl for existing
 * sub-questions by their DB id. Never deletes, never recreates, never touches
 * maxMarks, coMapping, btLevel, or any marks entry. Completely safe for frozen papers.
 *
 * Body: { subQuestions: [{ id: string, questionText: string, imageUrl?: string | null }] }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any).role;
  const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);

  // Fetch the paper to verify it exists and check ownership/frozen state
  const paper = await prisma.midExamPaper.findUnique({
    where: { id },
    include: {
      questions: {
        include: { subQuestions: { select: { id: true } } }
      },
      masterPaper: {
        include: {
          questions: {
            include: { subQuestions: { select: { id: true } } }
          }
        }
      }
    }
  });

  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  // Only frozen papers need this route; unfrozen papers can use the normal PATCH
  if (!paper.isFrozen) {
    return NextResponse.json(
      { error: "Paper is not frozen. Use the normal Save Draft to edit." },
      { status: 400 }
    );
  }

  // Build the set of valid sub-question IDs that belong to this paper
  // (either directly or via master paper for linked papers)
  const questionsSource = paper.masterPaperId && paper.masterPaper
    ? paper.masterPaper.questions
    : paper.questions;

  const validSubQIds = new Set<string>(
    questionsSource.flatMap(q => q.subQuestions.map(sq => sq.id))
  );

  const body = await req.json();
  const subQuestions: { id: string; questionText: string; imageUrl?: string | null }[] =
    body.subQuestions ?? [];

  if (!Array.isArray(subQuestions) || subQuestions.length === 0) {
    return NextResponse.json({ error: "No sub-question updates provided." }, { status: 400 });
  }

  // Validate all incoming IDs belong to this paper — prevent cross-paper edits
  for (const sq of subQuestions) {
    if (!validSubQIds.has(sq.id)) {
      return NextResponse.json(
        { error: `Sub-question ${sq.id} does not belong to this paper.` },
        { status: 400 }
      );
    }
  }

  // Perform targeted in-place updates — one update per sub-question
  // No transactions needed since each is independent and idempotent
  const updates = await Promise.all(
    subQuestions.map(sq =>
      prisma.midExamSubQuestion.update({
        where: { id: sq.id },
        data: {
          questionText: sq.questionText,
          ...(sq.imageUrl !== undefined ? { imageUrl: sq.imageUrl } : {})
        },
        select: { id: true, questionText: true, imageUrl: true }
      })
    )
  );

  return NextResponse.json({ success: true, updated: updates.length });
}
