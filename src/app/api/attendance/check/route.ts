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

        const existingRecord = await prisma.attendanceHistory.findFirst({
            where: {
                sectionId,
                periodId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
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
