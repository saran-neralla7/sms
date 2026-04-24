import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== "STUDENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { formId, responses } = body;
        // responses is array of: { facultyId, subjectId, ratings: { questionId: score }, comments: string }

        if (!formId || !responses || !Array.isArray(responses)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Lookup student by rollNumber (username), not by User.id
        const student = await prisma.student.findUnique({
            where: { rollNumber: session.user.username as string }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Check if already submitted
        const existingSubmission = await prisma.feedbackSubmission.findUnique({
            where: { unique_student_submission: { formId, studentId: student.id } }
        });

        if (existingSubmission) {
            return NextResponse.json({ error: "Already submitted" }, { status: 400 });
        }

        // Transaction to ensure atomicity and ANONYMITY
        await prisma.$transaction(async (tx) => {
            // 1. Record the FACT that they submitted (detached from answers)
            await tx.feedbackSubmission.create({
                data: {
                    formId,
                    studentId: student.id
                }
            });

            // 2. Map and insert anonymous responses
            const responseData = responses.map((res: any) => {
                // Calculate average rating dynamically (only for SCALE_1_5 answers)
                // Filter out non-numeric values
                const ratingValues = Object.values(res.ratings).filter(v => typeof v === 'number') as number[];
                const overallRating = ratingValues.length > 0 
                    ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length 
                    : 0;

                return {
                    formId,
                    facultyId: res.facultyId || null,
                    subjectId: res.subjectId || null,
                    ratings: res.ratings || {},
                    comments: res.comments || null,
                    overallRating
                };
            });

            await tx.feedbackResponse.createMany({
                data: responseData
            });
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
