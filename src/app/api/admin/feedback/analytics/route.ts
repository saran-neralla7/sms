import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const isBSH = isBSHHod(session?.user);

        if (!session?.user || (session.user.role !== "ADMIN" && !isBSH)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const formId = url.searchParams.get("formId");

        if (!formId) {
            return NextResponse.json({ error: "formId is required" }, { status: 400 });
        }

        // Fetch all responses for this form
        const whereClause: any = { formId };
        if (isBSH) {
            whereClause.subject = {
                year: "1"
            };
        }

        const responses = await prisma.feedbackResponse.findMany({
            where: whereClause,
            include: {
                faculty: { select: { empName: true, department: { select: { code: true } } } },
                subject: { select: { name: true, code: true } }
            }
        });

        // Calculate overall average
        const totalScore = responses.reduce((acc, r) => acc + r.overallRating, 0);
        const overallAverage = responses.length > 0 ? (totalScore / responses.length).toFixed(2) : 0;

        // Calculate overall unique respondents (number of unique students who submitted)
        // Since FeedbackResponse doesn't have studentId, we must count distinct submissions
        const submissions = await prisma.feedbackSubmission.count({
            where: { formId }
        });

        // Group by Faculty
        const facultyStats: any = {};
        responses.forEach(res => {
            const facKey = res.facultyId || "GENERAL";
            
            if (!facultyStats[facKey]) {
                facultyStats[facKey] = {
                    facultyName: res.faculty?.empName || "General Form",
                    department: res.faculty?.department?.code || "N/A",
                    totalResponses: 0,
                    totalScore: 0,
                    subjects: {} // To store subject breakdown
                };
            }
            
            const subjKey = res.subjectId || "GENERAL";
            if (!facultyStats[facKey].subjects[subjKey]) {
                facultyStats[facKey].subjects[subjKey] = {
                    subjectName: res.subject ? `${res.subject.name} (${res.subject.code})` : "General Feedback",
                    totalResponses: 0,
                    totalScore: 0
                };
            }

            // Add to Faculty overall
            facultyStats[facKey].totalResponses += 1;
            facultyStats[facKey].totalScore += res.overallRating;

            // Add to Subject breakdown
            facultyStats[facKey].subjects[subjKey].totalResponses += 1;
            facultyStats[facKey].subjects[subjKey].totalScore += res.overallRating;
        });

        // Calculate averages and format output
        const breakdown = Object.values(facultyStats).map((fac: any) => {
            const subjectsList = Object.values(fac.subjects).map((sub: any) => ({
                subjectName: sub.subjectName,
                respondents: sub.totalResponses,
                average: sub.totalResponses > 0 ? (sub.totalScore / sub.totalResponses).toFixed(2) : "0.00"
            }));

            return {
                facultyName: fac.facultyName,
                department: fac.department,
                subjects: subjectsList,
                respondents: fac.totalResponses,
                average: fac.totalResponses > 0 ? (fac.totalScore / fac.totalResponses).toFixed(2) : "0.00"
            };
        }).sort((a: any, b: any) => parseFloat(b.average) - parseFloat(a.average));

        return NextResponse.json({
            totalRespondents: submissions,
            overallAverage,
            breakdown
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
