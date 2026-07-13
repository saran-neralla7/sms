import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function cleanHtmlText(text: string): string {
    if (!text) return "";
    return text
        .replace(/<[^>]*>/g, "") // Strip HTML tags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const subjectId = searchParams.get("subjectId");
        const sectionId = searchParams.get("sectionId");
        let academicYearId = searchParams.get("academicYearId");

        if (!subjectId || !sectionId) {
            return NextResponse.json({ error: "Missing subjectId or sectionId parameter." }, { status: 400 });
        }

        // Fetch current academic year if not provided
        if (!academicYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            if (currentYear) {
                academicYearId = currentYear.id;
            }
        }

        // Fetch subject details (including name, code, and syllabus)
        const subject = await prisma.subject.findUnique({
            where: { id: subjectId },
            select: {
                id: true,
                name: true,
                code: true,
                syllabus: true,
            }
        });

        if (!subject) {
            return NextResponse.json({ error: "Subject not found." }, { status: 404 });
        }

        // If there's no syllabus JSON, return empty completion metrics
        const syllabusData = subject.syllabus as any;
        if (!syllabusData || !Array.isArray(syllabusData.units)) {
            return NextResponse.json({
                subjectName: subject.name,
                subjectCode: subject.code,
                overallCompletionPercentage: 0,
                completedTopicsCount: 0,
                totalTopicsCount: 0,
                units: []
            });
        }

        // Fetch all teaching diary logs (AttendanceHistory entries) where topicsTaught is recorded
        const diaries = await prisma.attendanceHistory.findMany({
            where: {
                subjectId: subjectId,
                sectionId: sectionId,
                academicYearId: academicYearId || undefined,
                topicsTaught: { not: null },
            },
            select: {
                topicsTaught: true,
                date: true,
            },
            orderBy: {
                date: "asc"
            }
        });

        // Build a map of lowercase clean topics -> earliest date taught
        const taughtTopicsMap = new Map<string, string>();
        diaries.forEach(log => {
            if (log.topicsTaught) {
                log.topicsTaught.split(",").forEach(topic => {
                    const cleanTopic = cleanHtmlText(topic).toLowerCase();
                    if (cleanTopic && !taughtTopicsMap.has(cleanTopic)) {
                        taughtTopicsMap.set(cleanTopic, log.date.toISOString());
                    }
                });
            }
        });

        let overallTotal = 0;
        let overallCompleted = 0;

        const unitsProgress = syllabusData.units.map((unit: any) => {
            // Split unit content (topics list) by commas and strip HTML tags
            const topicsList = unit.content
                ? unit.content.split(",").map((t: string) => cleanHtmlText(t)).filter(Boolean)
                : [];

            let completedInUnit = 0;

            const topicsStatus = topicsList.map((topicName: string) => {
                const cleanName = topicName.toLowerCase();
                const isCompleted = taughtTopicsMap.has(cleanName);
                if (isCompleted) {
                    completedInUnit++;
                    overallCompleted++;
                }
                overallTotal++;

                return {
                    name: topicName,
                    completed: isCompleted,
                    dateTaught: isCompleted ? taughtTopicsMap.get(cleanName) : null
                };
            });

            const unitPct = topicsList.length > 0
                ? Math.round((completedInUnit / topicsList.length) * 100)
                : 0;

            return {
                name: unit.name || "Unnamed Unit",
                title: cleanHtmlText(unit.title) || "No Title",
                completionPercentage: unitPct,
                completedCount: completedInUnit,
                totalCount: topicsList.length,
                topics: topicsStatus
            };
        });

        const overallPct = overallTotal > 0
            ? Math.round((overallCompleted / overallTotal) * 100)
            : 0;

        return NextResponse.json({
            subjectName: subject.name,
            subjectCode: subject.code,
            overallCompletionPercentage: overallPct,
            completedTopicsCount: overallCompleted,
            totalTopicsCount: overallTotal,
            units: unitsProgress
        });

    } catch (error: any) {
        console.error("Syllabus completion API error:", error);
        return NextResponse.json({ error: error.message || "Failed to calculate syllabus completion analytics." }, { status: 500 });
    }
}
