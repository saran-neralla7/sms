import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "STUDENT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get the active academic year
        const activeYear = await prisma.academicYear.findFirst({
            where: { isCurrent: true }
        });

        if (!activeYear) {
            return NextResponse.json({ error: "Active academic year not found" }, { status: 500 });
        }

        const holidays = await prisma.academicHoliday.findMany({
            where: { academicYearId: activeYear.id },
            orderBy: { date: "asc" }
        });

        const timelines = await prisma.academicSemesterTimeline.findMany({
            where: { academicYearId: activeYear.id },
            orderBy: [{ year: "asc" }, { semester: "asc" }]
        });

        return NextResponse.json({
            academicYear: activeYear.name,
            holidays: holidays.map(h => ({
                id: h.id,
                date: h.date.toISOString().split("T")[0],
                endDate: h.endDate ? h.endDate.toISOString().split("T")[0] : null,
                name: h.name
            })),
            timelines: timelines.map(t => ({
                id: t.id,
                year: t.year,
                semester: t.semester,
                classworkStart: t.classworkStart.toISOString().split("T")[0],
                classworkEnd: t.classworkEnd.toISOString().split("T")[0],
                mid1Start: t.mid1Start.toISOString().split("T")[0],
                mid1End: t.mid1End.toISOString().split("T")[0],
                mid2Start: t.mid2Start.toISOString().split("T")[0],
                mid2End: t.mid2End.toISOString().split("T")[0],
                semExamStart: t.semExamStart.toISOString().split("T")[0],
                semExamEnd: t.semExamEnd.toISOString().split("T")[0]
            }))
        });

    } catch (error) {
        console.error("Fetch academic calendar error:", error);
        return NextResponse.json({ error: "Failed to fetch academic calendar" }, { status: 500 });
    }
}
