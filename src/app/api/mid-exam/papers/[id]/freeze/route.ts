import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const paper = await prisma.midExamPaper.findUnique({
    where: { id },
    include: {
      questions: { include: { subQuestions: true } },
      masterPaper: {
        include: { questions: { include: { subQuestions: true } } }
      }
    }
  });
  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

  const role = (session.user as any).role;
  const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);
  const body = await req.json();
  const action = body.action; // "freeze" | "unfreeze"

  if (action === "unfreeze" && !isAdmin) {
    return NextResponse.json({ error: "Only admin can unfreeze papers" }, { status: 403 });
  }

  if (action === "freeze") {
    // For linked child papers, validate using the master paper's questions
    // (child papers have no questions of their own — they display the master's)
    const isLinked = !!paper.masterPaperId;
    const questionsToCheck = isLinked && paper.masterPaper
      ? paper.masterPaper.questions
      : paper.questions;

    if (questionsToCheck.length === 0) {
      return NextResponse.json({
        error: isLinked
          ? "Cannot freeze: the master paper has no questions. Add questions to the master paper first."
          : "Cannot freeze empty paper. Add questions first."
      }, { status: 400 });
    }
    const hasSubQ = questionsToCheck.some(q => q.subQuestions.length > 0);
    if (!hasSubQ) {
      return NextResponse.json({ error: "Questions must have at least one subquestion each." }, { status: 400 });
    }
  }

  const updated = await prisma.midExamPaper.update({
    where: { id },
    data: {
      isFrozen: action === "freeze",
      frozenAt: action === "freeze" ? new Date() : null,
      frozenById: action === "freeze" ? session.user.id : null,
    }
  });

  return NextResponse.json({ success: true, isFrozen: updated.isFrozen });
}
