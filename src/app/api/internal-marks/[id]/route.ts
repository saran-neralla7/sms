import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        const { marksObtained } = body;

        if (marksObtained === undefined || marksObtained < 0) {
            return NextResponse.json({ error: "Invalid marks provided" }, { status: 400 });
        }

        const mark = await prisma.internalMark.findUnique({ where: { id: params.id } });
        if (!mark) {
            return NextResponse.json({ error: "Mark record not found" }, { status: 404 });
        }

        const updatedMark = await prisma.internalMark.update({
            where: { id: params.id },
            data: {
                marksObtained: parseFloat(marksObtained),
                recordedById: session.user.id
            }
        });

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    action: "UPDATE_INTERNAL_MARK",
                    entity: "InternalMark",
                    entityId: mark.id,
                    details: JSON.stringify({ oldMarks: mark.marksObtained, newMarks: updatedMark.marksObtained }),
                    performedBy: session.user.id
                }
            });
        } catch (e) { console.error("Audit log failed", e); }

        return NextResponse.json(updatedMark);
    } catch (error) {
        console.error("Update Internal Mark Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

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
        const mark = await prisma.internalMark.findUnique({ where: { id: params.id } });
        if (!mark) {
            return NextResponse.json({ error: "Mark record not found" }, { status: 404 });
        }

        await prisma.internalMark.delete({
            where: { id: params.id }
        });

        // Audit Log
        try {
            await prisma.auditLog.create({
                data: {
                    action: "DELETE_INTERNAL_MARK",
                    entity: "InternalMark",
                    entityId: mark.id,
                    details: JSON.stringify({ marks: mark.marksObtained, subjectId: mark.subjectId }),
                    performedBy: session.user.id
                }
            });
        } catch (e) { console.error("Audit log failed", e); }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete Internal Mark Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
