import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");

    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (year) where.year = year;
    if (semester) where.semester = semester;

    try {
        const subjects = await prisma.subject.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { department: true, regulation: true, electiveSlotRelation: true }
        });
        return NextResponse.json(subjects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, shortName, code, year, semester, type, departmentId, regulation, electiveSlot } = body;

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

        const subject = await prisma.subject.create({
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
        return NextResponse.json(subject);
    } catch (error) {
        console.error("Error creating subject:", error);
        return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
    }
}
