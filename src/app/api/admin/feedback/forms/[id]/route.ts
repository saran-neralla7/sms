import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { id } = await context.params;
        const body = await request.json();
        const { title, startDate, endDate } = body;

        const updated = await prisma.feedbackForm.update({
            where: { id },
            data: {
                ...(title && { title }),
                ...(startDate && { startDate: new Date(startDate) }),
                ...(endDate && { endDate: new Date(endDate) }),
            }
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Failed to update feedback form:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        await prisma.feedbackForm.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete feedback form:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
