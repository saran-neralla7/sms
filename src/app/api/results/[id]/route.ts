import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE a specific result record
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        await prisma.semesterResult.delete({
            where: { id: id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete result:", error);
        return NextResponse.json({ error: "Failed to delete result" }, { status: 500 });
    }
}

// UPDATE a specific result record
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const data = await request.json();
        
        const updatedResult = await prisma.semesterResult.update({
            where: { id: id },
            data: {
                sgpa: data.sgpa,
                cgpa: data.cgpa,
                grades: data.grades,
            },
        });

        return NextResponse.json({ success: true, result: updatedResult });
    } catch (error) {
        console.error("Failed to update result:", error);
        return NextResponse.json({ error: "Failed to update result" }, { status: 500 });
    }
}
