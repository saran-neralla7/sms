
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const body = await req.json();
        const { targetSemester, incrementYear, detainedStudentIds, targetBatchIdForDetained } = body;

        // Fetch students in this batch
        const students = await prisma.student.findMany({
            where: { batchId: params.id },
            select: { id: true, year: true }
        });

        if (students.length === 0) {
            return NextResponse.json({ count: 0, message: "No students in this batch." });
        }

        const detainedSet = new Set(detainedStudentIds || []);

        // Prepare updates
        const updates = students.map(student => {
            // Case 1: Detained Student
            if (detainedSet.has(student.id)) {
                return prisma.student.update({
                    where: { id: student.id },
                    data: {
                        isDetained: true,
                        // Move to new batch (e.g. junior batch) if provided
                        batchId: targetBatchIdForDetained || undefined,
                        // Preserve current batch as original IF not set
                        originalBatchId: { set: params.id }, // We might want check if it already has one, but usually "current" becomes "original"
                        // Do NOT increment year/semester
                    }
                });
            }

            // Case 2: Promoted Student
            let newYear = student.year;
            if (incrementYear) {
                const currentInt = parseInt(student.year);
                if (!isNaN(currentInt)) {
                    newYear = (currentInt + 1).toString();
                }
            }

            return prisma.student.update({
                where: { id: student.id },
                data: {
                    year: newYear,
                    semester: targetSemester
                }
            });
        });

        // Execute transaction
        await prisma.$transaction(updates);

        return NextResponse.json({ count: students.length, message: "Promotion process completed." });
    } catch (error) {
        console.error("Error promoting batch:", error);
        return NextResponse.json({ error: "Failed to process promotion" }, { status: 500 });
    }
}
