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
        const { name, startTime, endTime, order } = body;

        const period = await prisma.period.update({
            where: { id: params.id },
            data: {
                name,
                startTime,
                endTime,
                order: parseInt(order)
            }
        });
        return NextResponse.json(period);
    } catch (error: any) {
        console.error("Error updating period:", error);
        return NextResponse.json({ error: error.message || "Failed to update period" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        await prisma.period.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting period:", error);
        return NextResponse.json({ error: error.message || "Failed to delete period" }, { status: 500 });
    }
}
