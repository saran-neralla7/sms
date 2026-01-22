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

        // Resolve Regulation
        let regulationId = null;
        const regName = regulation || "R22";

        const regulationRecord = await prisma.regulation.findUnique({ where: { name: regName } });
        if (regulationRecord) {
            regulationId = regulationRecord.id;
        } else {
            const newReg = await prisma.regulation.create({ data: { name: regName } });
            regulationId = newReg.id;
        }

        // Resolve Elective Slot
        let electiveSlotId = null;
        if (electiveSlot) {
            const slotRecord = await prisma.electiveSlot.findUnique({ where: { name: electiveSlot } });
            if (slotRecord) {
                electiveSlotId = slotRecord.id;
            } else {
                const newSlot = await prisma.electiveSlot.create({ data: { name: electiveSlot } });
                electiveSlotId = newSlot.id;
            }
        }

        const subject = await prisma.subject.update({
            where: { id: params.id },
            data: {
                name,
                code,
                year,
                semester,
                type,
                isElective,
                regulationId,
                electiveSlotId,
                departmentId
            }
        });
        return NextResponse.json(subject);
    } catch (error: any) {
        console.error("Update Subject Error:", error);
        return NextResponse.json({ error: error.message || "Failed to update subject" }, { status: 500 });
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
