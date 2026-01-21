
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { name } = await request.json();
        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const regulation = await prisma.regulation.update({
            where: { id: params.id },
            data: { name }
        });

        return NextResponse.json(regulation);
    } catch (error) {
        console.error("Error updating regulation:", error);
        return NextResponse.json({ error: "Failed to update regulation" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Check for dependencies
        const studentCount = await prisma.student.count({
            where: { regulationId: params.id }
        });
        const subjectCount = await prisma.subject.count({
            where: { regulationId: params.id }
        });

        if (studentCount > 0 || subjectCount > 0) {
            return NextResponse.json({
                error: `Cannot delete: Used by ${studentCount} students and ${subjectCount} subjects.`
            }, { status: 400 });
        }

        await prisma.regulation.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ message: "Regulation deleted" });
    } catch (error) {
        console.error("Error deleting regulation:", error);
        return NextResponse.json({ error: "Failed to delete regulation" }, { status: 500 });
    }
}
