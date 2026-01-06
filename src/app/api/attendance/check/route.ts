import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const sectionId = searchParams.get("sectionId");
    const periodId = searchParams.get("periodId");

    if (!date || !sectionId || !periodId) {
        return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    try {
        // Find if any record exists for this combination
        // Note: We check against the date (ignoring time)
        const checkDate = new Date(date);
        const startOfDay = new Date(checkDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(checkDate.setHours(23, 59, 59, 999));

        const subjectId = searchParams.get("subjectId");

        // Logic:
        // If subjectId is provided (likely Elective), check for (Section + Period + Subject + Date)
        // If subjectId is NOT provided (Core), check for (Section + Period + Date) -- Assuming generic lock
        // BUT optimization: If an elective record exists, and we try to check without subject, should we block?
        // Current requirement: Allow parallel electives.

        // Simplest robust logic:
        // Always check basic Section+Period collision first.
        // IF collision found:
        //    CHECK if the existing record has a subjectId.
        //    IF existing record subject == current subject, then BLOCK.
        //    IF existing record subject != current subject, 
        //       AND (existing is ELECTIVE && current is ELECTIVE) -> ALLOW (Concurrent)
        //       ELSE -> BLOCK (Core vs Core, or Core vs Elective Overlap)

        // ACTUALLY, simpler:
        // Just search for exact match.
        // If User selects "BDA", we check if "BDA" is marked for this period.
        // If User selects "Core Math", we check if "Core Math" is marked.
        // The previous logic was "One Period = One Record per Section".
        // We are changing it to "One Record per Section per Subject (if Elective)".

        // Let's refine the query:
        const whereClause: any = {
            sectionId,
            periodId,
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };

        if (subjectId) {
            whereClause.subjectId = subjectId;
        }

        const existingRecord = await prisma.attendanceHistory.findFirst({
            where: whereClause,
            include: {
                user: true,
                subject: true
            }
        });

        if (existingRecord) {
            return NextResponse.json({
                exists: true,
                markedBy: existingRecord.user.username,
                subjectName: existingRecord.subject?.name || "Unknown Subject",
                recordedAt: existingRecord.date
            });
        }

        return NextResponse.json({ exists: false });
    } catch (error) {
        console.error("Check Attendance Error:", error);
        return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
    }
}
