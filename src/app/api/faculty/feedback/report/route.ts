import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authOptions as any);
        if (!session || !session.user || session.user.role !== "FACULTY") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const username = session.user.username;
        const faculty = await prisma.faculty.findFirst({
            where: { user: { username } }
        });

        if (!faculty) {
            return NextResponse.json({ error: "Faculty profile not found" }, { status: 404 });
        }

        const facultyId = faculty.id;
        const url = new URL(req.url);
        const subjectId = url.searchParams.get("subjectId");
        const formId = url.searchParams.get("formId");
        const sectionId = url.searchParams.get("sectionId");

        if (!subjectId) {
            return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
        }

        // Define closed condition for forms
        const now = new Date();
        const closedCondition = {
            OR: [
                { endDate: { lt: now } },
                { isActive: false }
            ]
        };

        // Mode 1: No formId provided - list distinct closed forms for this faculty and subject
        if (!formId) {
            const distinctResponses = await prisma.feedbackResponse.findMany({
                where: {
                    facultyId,
                    subjectId,
                    ...(sectionId && sectionId !== "ALL" ? { sectionId } : {}),
                    form: closedCondition
                },
                select: {
                    formId: true,
                    form: {
                        select: {
                            title: true
                        }
                    }
                },
                distinct: ['formId']
            });

            const formsList = distinctResponses.map(dr => ({
                id: dr.formId,
                title: dr.form?.title || "Untitled Form"
            }));

            return NextResponse.json(formsList);
        }

        // Mode 2: Both subjectId and formId provided - get detailed feedback report
        // Fetch Form Data and Template Questions, verifying the form is indeed closed
        const form = await prisma.feedbackForm.findFirst({
            where: {
                id: formId,
                AND: closedCondition
            },
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
            return NextResponse.json({ error: "Feedback form not found or the feedback window is not closed yet." }, { status: 403 });
        }

        // Parse Template Questions
        const questions = Array.isArray(form.template.questions) ? form.template.questions : JSON.parse(form.template.questions as string);
        const ratingQuestions = questions.filter((q: any) => q.type === "SCALE_1_5");
        const remarksQuestion = questions.find((q: any) => q.type === "TEXT");

        // Infer batch if missing
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

        // Fetch responses ONLY for this faculty, subject, and form
        const responses = await prisma.feedbackResponse.findMany({
            where: {
                formId,
                facultyId,
                subjectId,
                ...(sectionId && sectionId !== "ALL" ? { sectionId } : {})
            },
            include: {
                faculty: { select: { empName: true, photoUrl: true } },
                subject: { select: { name: true, code: true } }
            }
        });

        let sectionsLabel = form.targetSections.map(s => s.name).join(", ") || "ALL";
        if (sectionId && sectionId !== "ALL") {
            const sec = await prisma.section.findUnique({ where: { id: sectionId } });
            if (sec) {
                sectionsLabel = sec.name;
            }
        }

        if (responses.length === 0) {
            return NextResponse.json({
                metadata: {
                    formTitle: form.title,
                    course: form.targetDepartment?.code || "ALL",
                    year: form.targetYear ? String(form.targetYear) : null,
                    semester: form.targetSemester ? String(form.targetSemester) : "ALL",
                    academicYear: form.academicYear?.name || "-",
                    batch: batchName,
                    sections: sectionsLabel
                },
                ratingQuestions: ratingQuestions.map((q: any) => q.text),
                report: null
            });
        }

        // Group Responses
        const report = {
            facultyName: responses[0].faculty?.empName || faculty.empName,
            facultyPhoto: responses[0].faculty?.photoUrl || faculty.photoUrl || null,
            subjectName: responses[0].subject ? `${responses[0].subject.name} (${responses[0].subject.code})` : "General Subject",
            respondents: 0,
            overallTotalScore: 0,
            excellents: 0,
            veryGood: 0,
            good: 0,
            fair: 0,
            poor: 0,
            totalRatings: 0,
            rows: [] as any[]
        };

        responses.forEach((res) => {
            report.respondents += 1;
            report.overallTotalScore += res.overallRating;

            const ratingsMap = res.ratings as any;
            
            const rowAnswers = ratingQuestions.map((q: any) => {
                const val = ratingsMap[q.id];
                if (val !== undefined && typeof val === 'number') {
                    report.totalRatings += 1;
                    if (val === 5) report.excellents += 1;
                    else if (val === 4) report.veryGood += 1;
                    else if (val === 3) report.good += 1;
                    else if (val === 2) report.fair += 1;
                    else if (val === 1) report.poor += 1;
                }
                return val || "-";
            });

            // Extract remarks
            let remarks = "";
            if (remarksQuestion && ratingsMap[remarksQuestion.id]) {
                remarks = ratingsMap[remarksQuestion.id];
            } else if (res.comments) {
                remarks = res.comments;
            }

            report.rows.push({
                answers: rowAnswers,
                remarks: remarks || "-"
            });
        });

        const overallAverage = report.respondents > 0 
            ? (report.overallTotalScore / report.respondents).toFixed(2) 
            : "0.00";

        const metadata = {
            formTitle: form.title,
            course: form.targetDepartment?.code || "ALL",
            year: form.targetYear ? String(form.targetYear) : null,
            semester: form.targetSemester ? String(form.targetSemester) : "ALL",
            academicYear: form.academicYear?.name || "-",
            batch: batchName,
            sections: sectionsLabel
        };

        return NextResponse.json({
            metadata,
            ratingQuestions: ratingQuestions.map((q: any) => q.text),
            report: {
                ...report,
                overallAverage
            }
        });

    } catch (error: any) {
        console.error("Faculty Feedback Analysis Report Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
