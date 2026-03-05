
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function PUT(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const body = await req.json();
        const { name, startDate, endDate, isCurrent } = body;

        // If isCurrent is being set to true, unset others
        if (isCurrent) {
            await prisma.academicYear.updateMany({
                where: {
                    isCurrent: true,
                    id: { not: params.id }
                },
                data: { isCurrent: false }
            });
        }

        const updatedYear = await prisma.academicYear.update({
            where: { id: params.id },
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isCurrent: isCurrent
            }
        });

        return NextResponse.json(updatedYear);
    } catch (error) {
        console.error("Error updating academic year:", error);
        return NextResponse.json({ error: "Failed to update academic year" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await prisma.academicYear.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ message: "Academic year deleted" });
    } catch (error) {
        console.error("Error deleting academic year:", error);
        return NextResponse.json({ error: "Failed to delete academic year. It may be in use." }, { status: 500 });
    }
}
