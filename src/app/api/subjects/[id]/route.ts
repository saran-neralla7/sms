import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, code, year, semester, type, departmentId, regulation, electiveSlot } = body;

        const isElective = type.includes("ELECTIVE") || !!electiveSlot;

        const subject = await prisma.subject.update({
            where: { id: params.id },
            data: {
                name,
                code,
                year,
                semester,
                type,
                isElective,
                regulation: regulation || "R22",
                electiveSlot: electiveSlot || null,
                departmentId
            }
        });
        return NextResponse.json(subject);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update subject" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        await prisma.subject.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
    }
}
