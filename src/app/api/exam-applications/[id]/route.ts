import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH: Approve or reject an exam application (office/admin)
export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["OFFICE", "ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const params = await props.params;
        const { status, remarks } = await request.json();
        if (!["APPROVED", "REJECTED"].includes(status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        const updated = await prisma.examApplication.update({
            where: { id: params.id },
            data: {
                status,
                remarks: remarks || null,
                approvedBy: (session.user as any).username
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Update exam application error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
// DELETE: Delete an exam application (admin only)
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

        // First delete subjects related to this application
        await prisma.examApplicationSubject.deleteMany({
            where: { applicationId: params.id }
        });

        // Then delete the application itself
        await prisma.examApplication.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete exam application error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
