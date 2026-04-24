import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const templates = await prisma.feedbackTemplate.findMany({
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(templates);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, description, type, questions } = body;

        if (!name || !questions || questions.length === 0) {
            return NextResponse.json({ error: "Name and at least one question are required" }, { status: 400 });
        }

        const template = await prisma.feedbackTemplate.create({
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
