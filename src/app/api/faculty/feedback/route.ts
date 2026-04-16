import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as any;
        
        if (!user?.facultyId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const facultyId = user.facultyId;

        // Fetch all responses for this faculty
        const responses = await prisma.feedbackResponse.findMany({
            where: { facultyId },
            include: {
                form: { select: { title: true, academicYear: { select: { name: true } } } },
                subject: { select: { name: true, code: true } }
            },
            orderBy: { createdAt: "desc" }
        });

        // Fetch all questions to map question IDs to text
        const questions = await prisma.feedbackQuestion.findMany();
        const questionMap = questions.reduce((acc: any, q) => {
            acc[q.id] = q.text;
            return acc;
        }, {});

        // Aggregate by Subject
        const subjectStats: any = {};
        let totalRating = 0;

        responses.forEach(res => {
            totalRating += res.overallRating;
            
            if (!subjectStats[res.subjectId]) {
                subjectStats[res.subjectId] = {
                    subject: res.subject,
                    totalResponses: 0,
                    totalScore: 0,
                    comments: []
                };
            }
            
            subjectStats[res.subjectId].totalResponses += 1;
            subjectStats[res.subjectId].totalScore += res.overallRating;
            
            if (res.comments && res.comments.trim() !== "") {
                subjectStats[res.subjectId].comments.push(res.comments);
            }
        });

        const subjectAnalytics = Object.values(subjectStats).map((stat: any) => ({
            ...stat,
            average: stat.totalResponses > 0 ? (stat.totalScore / stat.totalResponses).toFixed(2) : 0
        }));

        const aggregate = {
            totalResponses: responses.length,
            overallAverage: responses.length > 0 ? (totalRating / responses.length).toFixed(2) : 0,
            subjectAnalytics
        };

        return NextResponse.json(aggregate);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
