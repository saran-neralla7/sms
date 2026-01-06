import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { subjectId, studentIds, allFetchedStudentIds } = body;

        // Disconnect ALL fetched students from this subject first (to handle removals)
        // Only disconnect those that are in the "allFetchedStudentIds" list, 
        // effectively replacing the enrollment state for the currently visible set of students.
        // This prevents overwriting enrollment for students in OTHER sections not currently loaded.

        await prisma.subject.update({
            where: { id: subjectId },
            data: {
                students: {
                    disconnect: allFetchedStudentIds.map((id: string) => ({ id })),
                }
            }
        });

        // Now connect the selected ones
        if (studentIds.length > 0) {
            await prisma.subject.update({
                where: { id: subjectId },
                data: {
                    students: {
                        connect: studentIds.map((id: string) => ({ id })),
                    }
                }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Enrollment error:", error);
        return NextResponse.json({ error: "Failed to update enrollment" }, { status: 500 });
    }
}
