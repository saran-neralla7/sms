import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const formId = url.searchParams.get("formId");

        if (!formId) {
            return NextResponse.json({ error: "formId is required" }, { status: 400 });
        }

        // Fetch all responses for this form
        const responses = await prisma.feedbackResponse.findMany({
            where: { formId },
            include: {
                faculty: { select: { empName: true, department: { select: { code: true } } } },
                subject: { select: { name: true, code: true } }
            }
        });

        // Calculate overall average
        const totalScore = responses.reduce((acc, r) => acc + r.overallRating, 0);
        const overallAverage = responses.length > 0 ? (totalScore / responses.length).toFixed(2) : 0;

        // Group by Faculty Subject
        const facultyStats: any = {};
        responses.forEach(res => {
            const key = `${res.facultyId}_${res.subjectId}`;
            if (!facultyStats[key]) {
                facultyStats[key] = {
                    facultyName: res.faculty.empName,
                    department: res.faculty.department.code,
                    subjectName: `${res.subject.name} (${res.subject.code})`,
                    totalResponses: 0,
                    totalScore: 0
                };
            }
            facultyStats[key].totalResponses += 1;
            facultyStats[key].totalScore += res.overallRating;
        });

        const breakdown = Object.values(facultyStats).map((stat: any) => ({
            ...stat,
            average: stat.totalResponses > 0 ? (stat.totalScore / stat.totalResponses).toFixed(2) : 0
        })).sort((a: any, b: any) => b.average - a.average);

        return NextResponse.json({
            totalResponses: responses.length,
            overallAverage,
            breakdown
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
