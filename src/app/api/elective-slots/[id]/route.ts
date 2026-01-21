import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;

    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Check dependencies
        const subjectCount = await prisma.subject.count({
            where: { electiveSlotId: params.id }
        });

        if (subjectCount > 0) {
            return NextResponse.json({
                error: `Cannot delete: Used by ${subjectCount} subjects.`
            }, { status: 400 });
        }

        await prisma.electiveSlot.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ message: "Slot deleted" });
    } catch (error) {
        console.error("Error deleting slot:", error);
        return NextResponse.json({ error: "Failed to delete slot" }, { status: 500 });
    }
}
