import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "STUDENT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const username = session.user.username; // For students, username is rollNumber

        const student = await prisma.student.findUnique({
            where: { rollNumber: username },
            include: {
                department: true,
                section: true,
                batch: true,
                originalBatch: true,
                labBatch: true,
                regulation: true,
                subjects: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        isElective: true,
                        type: true
                    }
                },
                internalMarks: {
                    include: {
                        subject: true,
                        academicYear: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        if (!student) {
            return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
        }

        return NextResponse.json(student);

    } catch (error) {
        console.error("Fetch Student Profile Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
