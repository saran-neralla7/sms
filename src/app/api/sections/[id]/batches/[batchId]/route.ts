
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE: Delete a Lab Batch
export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string, batchId: string }> }
) {
    const params = await props.params;
    try {
        const { id: sectionId, batchId } = params;

        // Verify batch belongs to section
        const batch = await prisma.labBatch.findUnique({
            where: { id: batchId }
        });

        if (!batch || batch.sectionId !== sectionId) {
            return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }

        // Unassign students first (Prisma doesn't auto SetNull unless configured in schema)
        // Or we could have configured @relation(onDelete: SetNull)
        // Doing it manually to be safe without schema migration again for now
        await prisma.student.updateMany({
            where: { labBatchId: batchId },
            data: { labBatchId: null }
        });

        await prisma.labBatch.delete({
            where: { id: batchId }
        });

        return NextResponse.json({ message: "Batch deleted successfully" });
    } catch (error) {
        console.error("Error deleting lab batch:", error);
        return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
    }
}
