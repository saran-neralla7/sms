import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HOD")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        await prisma.attendanceHistory.delete({
            where: { id: params.id },
        });
        return NextResponse.json({ message: "Record deleted successfully" });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HOD")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { details, status } = body;

        const updated = await prisma.attendanceHistory.update({
            where: { id: params.id },
            data: {
                details: JSON.stringify(details), // Ensure it's stringified
                status: status, // Update status label if needed, or keep original
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating history:", error);
        return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
    }
}
