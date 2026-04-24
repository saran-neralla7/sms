import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PUT(req: Request, { params }: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, description, type, questions } = body;
        const { id } = await params;

        if (!name || !questions || questions.length === 0) {
            return NextResponse.json({ error: "Name and at least one question are required" }, { status: 400 });
        }

        // Delete existing questions
        await prisma.feedbackQuestion.deleteMany({
            where: { templateId: id }
        });

        // Update template and recreate questions
        const template = await prisma.feedbackTemplate.update({
            where: { id },
            data: {
                name,
                description,
                type: type || "FACULTY_MAPPED",
                questions: {
                    create: questions.map((q: any, idx: number) => ({
                        text: q.text,
                        type: q.type || "SCALE_1_5",
                        order: q.order ?? idx
                    }))
                }
            },
            include: { questions: true }
        });

        return NextResponse.json(template);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: any) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        await prisma.feedbackTemplate.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
