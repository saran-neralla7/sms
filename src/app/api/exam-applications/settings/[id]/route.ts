import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: Update a setting
export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const params = await props.params;
        const body = await request.json();
        const data: any = {};
        if (body.startDate) data.startDate = new Date(body.startDate);
        if (body.endDate) data.endDate = new Date(body.endDate);
        if (body.lateFeeEndDate !== undefined) data.lateFeeEndDate = body.lateFeeEndDate ? new Date(body.lateFeeEndDate) : null;
        if (body.isActive !== undefined) data.isActive = body.isActive;

        const updated = await prisma.examApplicationSetting.update({
            where: { id: params.id },
            data
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Update setting error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

// DELETE: Remove a setting
export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const params = await props.params;
        await prisma.examApplicationSetting.delete({ where: { id: params.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete setting error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
