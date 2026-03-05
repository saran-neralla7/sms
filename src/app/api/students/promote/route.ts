import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { studentIds, targetYear, targetSemester, targetBatchId, isAlumni } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "No students selected" }, { status: 400 });
        }

        if (isAlumni) {
            // Move to Alumni
            await prisma.$transaction(async (tx) => {
                // 1. Fetch student details
                const students = await tx.student.findMany({
                    where: { id: { in: studentIds } },
                });

                // 2. Create Alumni records
                // Use skipDuplicates to avoid crashing if run multiple times
                const alumniData = students.map((s) => ({
                    rollNumber: s.rollNumber,
                    name: s.name,
                    mobile: s.mobile,
                    passingYear: new Date().getFullYear().toString(),
                }));

                await tx.alumni.createMany({
                    data: alumniData,
                });

                // 3. Delete from Student table
                await tx.student.deleteMany({
                    where: { id: { in: studentIds } },
                });
            });
        } else {
            // Standard Promotion / Transfer
            const updateData: any = {
                year: String(targetYear),
                semester: String(targetSemester),
            };

            // Only update batch if explicitly provided (allows transferring batches)
            if (targetBatchId) {
                updateData.batchId = targetBatchId;
            }

            await prisma.student.updateMany({
                where: { id: { in: studentIds } },
                data: updateData,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Promotion Error:", error);
        return NextResponse.json({ error: error.message || "Promotion failed" }, { status: 500 });
    }
}
