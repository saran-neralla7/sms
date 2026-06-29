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

        // 1. Fetch Form Data and Template Questions
        const form = await prisma.feedbackForm.findUnique({
            where: { id: formId },
            include: {
                academicYear: true,
                targetDepartment: true,
                targetBatch: true,
                targetSections: true,
                template: {
                    select: {
                        name: true,
                        questions: true
                    }
                }
            }
        });

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        // Parse Template Questions
        const questions = Array.isArray(form.template.questions) ? form.template.questions : JSON.parse(form.template.questions as string);
        
        // Separate rating questions and the remarks question
        // The user specified that the remarks question is a TEXT question.
        const ratingQuestions = questions.filter((q: any) => q.type === "SCALE_1_5");
        const remarksQuestion = questions.find((q: any) => q.type === "TEXT");

        // 1.5 Infer batch if missing
        let batchName = form.targetBatch?.name;
        if (!batchName) {
            const firstSubmission = await prisma.feedbackSubmission.findFirst({
                where: { formId },
                include: { student: { include: { batch: true } } }
            });
            if (firstSubmission?.student?.batch) {
                batchName = firstSubmission.student.batch.name;
            } else {
                batchName = "-";
            }
        }

        // 2. Fetch all Responses for this form
        const whereClause: any = { formId };
        if (isBSH) {
            whereClause.subject = {
                year: "1"
            };
        }

        const responses = await prisma.feedbackResponse.findMany({
            where: whereClause,
            include: {
                faculty: { select: { empName: true, photoUrl: true } },
                subject: { select: { name: true, code: true } }
            }
        });

        // 3. Group Responses by Faculty and Subject
        // Format: { "facultyId_subjectId": { facultyName, subjectName, respondents, rows: [] } }
        const groups: Record<string, any> = {};

        responses.forEach((res) => {
            const facKey = res.facultyId || "GENERAL";
            const subKey = res.subjectId || "GENERAL";
            const groupKey = `${facKey}_${subKey}`;

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    facultyName: res.faculty?.empName || "General Faculty",
                    facultyPhoto: res.faculty?.photoUrl || null,
                    subjectName: res.subject ? `${res.subject.name} (${res.subject.code})` : "General Subject",
                    respondents: 0,
                    overallTotalScore: 0,
                    excellents: 0,
                    veryGood: 0,
                    good: 0,
                    fair: 0,
                    poor: 0,
                    totalRatings: 0,
                    rows: []
                };
            }

            groups[groupKey].respondents += 1;
            groups[groupKey].overallTotalScore += res.overallRating;

            const ratingsMap = res.ratings as any;
            
            // Map individual rating answers in the order of the rating questions
            const rowAnswers = ratingQuestions.map((q: any) => {
                const val = ratingsMap[q.id];
                if (val !== undefined && typeof val === 'number') {
                    groups[groupKey].totalRatings += 1;
                    if (val === 5) groups[groupKey].excellents += 1;
                    else if (val === 4) groups[groupKey].veryGood += 1;
                    else if (val === 3) groups[groupKey].good += 1;
                    else if (val === 2) groups[groupKey].fair += 1;
                    else if (val === 1) groups[groupKey].poor += 1;
                }
                return val || "-";
            });

            // Extract remarks
            // The remarks might be in ratingsMap (if it's a TEXT question) OR in res.comments
            let remarks = "";
            if (remarksQuestion && ratingsMap[remarksQuestion.id]) {
                remarks = ratingsMap[remarksQuestion.id];
            } else if (res.comments) {
                remarks = res.comments;
            }

            groups[groupKey].rows.push({
                answers: rowAnswers,
                remarks: remarks || "-"
            });
        });

        // Convert groups to an array and calculate averages
        const reportData = Object.values(groups).map((group: any) => {
            const avg = group.respondents > 0 ? (group.overallTotalScore / group.respondents).toFixed(2) : "0.00";
            return {
                ...group,
                overallAverage: avg
            };
        });

        // Format metadata for header
        const metadata = {
            formTitle: form.title,
            course: form.targetDepartment?.code || "ALL",
            year: form.targetYear ? String(form.targetYear) : null,
            semester: form.targetSemester ? String(form.targetSemester) : "ALL",
            academicYear: form.academicYear?.name || "-",
            batch: batchName,
            sections: form.targetSections.map(s => s.name).join(", ") || "ALL"
        };

        return NextResponse.json({
            metadata,
            ratingQuestions: ratingQuestions.map((q: any) => q.text),
            reports: reportData
        });

    } catch (error: any) {
        console.error("Analysis Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
