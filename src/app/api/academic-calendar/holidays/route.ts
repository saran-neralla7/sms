import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET() {
    try {
        const cookieStore = await cookies();
        let academicYearId = cookieStore.get("academic-year-id")?.value;
        if (!academicYearId) {
            const activeYear = await prisma.academicYear.findFirst({
                where: { isCurrent: true }
            });
            academicYearId = activeYear?.id;
        }

        if (!academicYearId) {
            return NextResponse.json([]);
        }

        const holidays = await prisma.academicHoliday.findMany({
            where: { academicYearId },
            orderBy: { date: "asc" }
        });

        return NextResponse.json(holidays);
    } catch (error: any) {
        console.error("GET /api/academic-calendar/holidays error:", error);
        return NextResponse.json({ error: error.message || "Failed to load holidays" }, { status: 500 });
    }
}
