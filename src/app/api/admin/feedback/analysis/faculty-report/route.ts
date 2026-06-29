import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const facultyId = url.searchParams.get("facultyId");
        const academicYearId = url.searchParams.get("academicYearId");

        if (!facultyId || !academicYearId) {
            return NextResponse.json({ error: "facultyId and academicYearId are required" }, { status: 400 });
        }

        const isBSH = isBSHHod(session.user);
        const feedbackWhere: any = {
            facultyId: facultyId,
            form: { academicYearId: academicYearId }
        };
        if (isBSH) {
            feedbackWhere.subject = {
                year: "1"
            };
        }

        // 1. Fetch all distinct forms this faculty has responses for in the given academic year
        const distinctForms = await prisma.feedbackResponse.findMany({
            where: feedbackWhere,
            select: { formId: true },
            distinct: ['formId']
        });

        const formIds = distinctForms.map(df => df.formId);

        if (formIds.length === 0) {
            return NextResponse.json([]);
        }

        const resultPayload = [];

        // 2. Loop through each form and build the report just for this faculty
        for (const fId of formIds) {
            const form = await prisma.feedbackForm.findUnique({
                where: { id: fId },
                include: {
                    academicYear: true,
                    targetDepartment: true,
                    targetBatch: true,
                    targetSections: true,
                    template: { select: { name: true, questions: true } }
                }
            });

            if (!form) continue;

            const questions = Array.isArray(form.template.questions) ? form.template.questions : JSON.parse(form.template.questions as string);
            const ratingQuestions = questions.filter((q: any) => q.type === "SCALE_1_5");
            const remarksQuestion = questions.find((q: any) => q.type === "TEXT");

            // Infer batch if missing
            let batchName = form.targetBatch?.name;
            if (!batchName) {
                const firstSubmission = await prisma.feedbackSubmission.findFirst({
                    where: { formId: fId },
                    include: { student: { include: { batch: true } } }
                });
                batchName = firstSubmission?.student?.batch?.name || "-";
            }

            const responsesWhere: any = { formId: fId, facultyId: facultyId };
            if (isBSH) {
                responsesWhere.subject = {
                    year: "1"
                };
            }

            // Fetch responses ONLY for this faculty for this form
            const responses = await prisma.feedbackResponse.findMany({
                where: responsesWhere,
                include: {
                    faculty: { select: { empName: true, photoUrl: true } },
                    subject: { select: { name: true, code: true } }
                }
            });

            const groups: Record<string, any> = {};

            responses.forEach((res) => {
                const subKey = res.subjectId || "GENERAL";
                const groupKey = `${facultyId}_${subKey}`;

                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        facultyName: res.faculty?.empName || "General Faculty",
                        facultyPhoto: res.faculty?.photoUrl || null,
                        subjectName: res.subject ? `${res.subject.name} (${res.subject.code})` : "General Subject",
                        respondents: 0,
                        overallTotalScore: 0,
                        rows: []
                    };
                }

                groups[groupKey].respondents += 1;
                groups[groupKey].overallTotalScore += res.overallRating;

                const ratingsMap = res.ratings as any;
                const rowAnswers = ratingQuestions.map((q: any) => ratingsMap[q.id] || "-");

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

            const reportData = Object.values(groups).map((group: any) => ({
                ...group,
                overallAverage: group.respondents > 0 ? (group.overallTotalScore / group.respondents).toFixed(2) : "0.00"
            }));

            const metadata = {
                formTitle: form.title,
                course: form.targetDepartment?.code || "ALL",
                year: form.targetYear ? String(form.targetYear) : null,
                semester: form.targetSemester ? String(form.targetSemester) : "ALL",
                academicYear: form.academicYear?.name || "-",
                batch: batchName,
                sections: form.targetSections.map(s => s.name).join(", ") || "ALL"
            };

            resultPayload.push({
                formId: fId,
                formTitle: form.title,
                metadata,
                ratingQuestions: ratingQuestions.map((q: any) => q.text),
                reports: reportData
            });
        }

        return NextResponse.json(resultPayload);

    } catch (error: any) {
        console.error("Faculty Specific Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
