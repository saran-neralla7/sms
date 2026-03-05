
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Bulk Assign Students to a Batch
export async function POST(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const body = await req.json();
        const { studentIds, labBatchId } = body;
        // labBatchId can be null to unassign

        if (!Array.isArray(studentIds)) {
            return NextResponse.json({ error: "Invalid student IDs" }, { status: 400 });
        }

        const result = await prisma.student.updateMany({
            where: {
                id: { in: studentIds },
                sectionId: params.id // Security check: ensure students belong to this section
            },
            data: {
                labBatchId: labBatchId || null
            }
        });

        return NextResponse.json({ count: result.count, message: "Students updated successfully." });
    } catch (error) {
        console.error("Error assigning lab batch:", error);
        return NextResponse.json({ error: "Failed to update students" }, { status: 500 });
    }
}
