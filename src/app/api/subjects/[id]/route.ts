import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";
import { logActivity } from "@/lib/logging";

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const isBSH = isBSHHod(session?.user as any);
    if (!session || (session.user.role !== "ADMIN" && !isBSH)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, shortName, code, year, semester, type, departmentId, regulation, electiveSlot } = body;

        // Check scoping for BSH HOD
        if (isBSH) {
            const existingSubject = await prisma.subject.findUnique({
                where: { id: params.id },
                select: { year: true }
            });
            if (!existingSubject || existingSubject.year !== "1") {
                return NextResponse.json({ error: "BSH HOD can only update Year 1 subjects" }, { status: 403 });
            }
            if (year && year !== "1") {
                return NextResponse.json({ error: "BSH HOD can only set year to Year 1" }, { status: 403 });
            }
        }

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
                shortName: shortName || null,
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
        await logActivity(
            session.user.id,
            "UPDATE",
            "Subject",
            `${name} (${code}) | Year ${year} Sem ${semester}`,
            { subjectId: params.id, name, code, year, semester, type }
        );
        return NextResponse.json(subject);
    } catch (error: any) {
        console.error("Update Subject Error:", error);
        return NextResponse.json({ error: error.message || "Failed to update subject" }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const isBSH = isBSHHod(session?.user as any);
    if (!session || (session.user.role !== "ADMIN" && !isBSH)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        if (isBSH) {
            const existingSubject = await prisma.subject.findUnique({
                where: { id: params.id },
                select: { year: true }
            });
            if (!existingSubject || existingSubject.year !== "1") {
                return NextResponse.json({ error: "BSH HOD can only delete Year 1 subjects" }, { status: 403 });
            }
        }

        await prisma.subject.delete({
            where: { id: params.id }
        });
        await logActivity(
            session.user.id,
            "DELETE",
            "Subject",
            params.id,
            { subjectId: params.id }
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting subject:", error);
        return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
    }
}
