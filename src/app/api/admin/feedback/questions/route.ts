import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const questions = await prisma.feedbackQuestion.findMany({
            orderBy: { order: "asc" }
        });
        return NextResponse.json(questions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { text, order } = body;

        if (!text) {
            return NextResponse.json({ error: "Question text is required" }, { status: 400 });
        }

        const question = await prisma.feedbackQuestion.create({
            data: {
                text,
                order: order || 0
            }
        });

        return NextResponse.json(question);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
