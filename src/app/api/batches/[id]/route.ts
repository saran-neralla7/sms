
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
        const { name, startYear, endYear } = body;

        const updatedBatch = await prisma.batch.update({
            where: { id: params.id },
            data: {
                name,
                startYear: parseInt(startYear),
                endYear: parseInt(endYear)
            }
        });

        return NextResponse.json(updatedBatch);
    } catch (error) {
        console.error("Error updating batch:", error);
        return NextResponse.json({ error: "Failed to update batch" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        await prisma.batch.delete({
            where: { id: params.id }
        });
        return NextResponse.json({ message: "Batch deleted" });
    } catch (error) {
        console.error("Error deleting batch:", error);
        return NextResponse.json({ error: "Failed to delete batch. It may have linked students." }, { status: 500 });
    }
}
