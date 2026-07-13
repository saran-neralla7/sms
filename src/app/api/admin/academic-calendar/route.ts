import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const academicYearId = searchParams.get("academicYearId");

        if (!academicYearId) {
            return NextResponse.json({ error: "academicYearId is required" }, { status: 400 });
        }

        const holidays = await prisma.academicHoliday.findMany({
            where: { academicYearId },
            orderBy: { date: "asc" }
        });

        const timelines = await prisma.academicSemesterTimeline.findMany({
            where: { academicYearId },
            orderBy: [{ year: "asc" }, { semester: "asc" }]
        });

        return NextResponse.json({ holidays, timelines });
    } catch (error: any) {
        console.error("GET /api/admin/academic-calendar error:", error);
        return NextResponse.json({ error: error.message || "Failed to load calendar data" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { type } = body;

        if (type === "holiday") {
            const { academicYearId, date, endDate, name } = body;
            if (!academicYearId || !date || !name) {
                return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
            }

            // Validate endDate is after date if provided
            if (endDate && new Date(endDate + "T00:00:00") <= new Date(date + "T00:00:00")) {
                return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
            }

            const parsedDate = new Date(date + "T00:00:00");
            const parsedEndDate = endDate ? new Date(endDate + "T00:00:00") : null;

            const holiday = await prisma.academicHoliday.upsert({
                where: {
                    academicYearId_date: {
                        academicYearId,
                        date: parsedDate
                    }
                },
                update: {
                    name,
                    endDate: parsedEndDate
                },
                create: {
                    academicYearId,
                    date: parsedDate,
                    endDate: parsedEndDate,
                    name
                }
            });

            return NextResponse.json({ success: true, data: holiday });
        } else if (type === "timeline") {
            const {
                academicYearId,
                year,
                semester,
                classworkStart,
                classworkEnd,
                mid1Start,
                mid1End,
                mid2Start,
                mid2End,
                semExamStart,
                semExamEnd
            } = body;

            if (!academicYearId || !year || !semester || !classworkStart || !classworkEnd || !mid1Start || !mid1End || !mid2Start || !mid2End || !semExamStart || !semExamEnd) {
                return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
            }

            const timeline = await prisma.academicSemesterTimeline.upsert({
                where: {
                    academicYearId_year_semester: {
                        academicYearId,
                        year,
                        semester
                    }
                },
                update: {
                    classworkStart: new Date(classworkStart + "T00:00:00"),
                    classworkEnd: new Date(classworkEnd + "T00:00:00"),
                    mid1Start: new Date(mid1Start + "T00:00:00"),
                    mid1End: new Date(mid1End + "T00:00:00"),
                    mid2Start: new Date(mid2Start + "T00:00:00"),
                    mid2End: new Date(mid2End + "T00:00:00"),
                    semExamStart: new Date(semExamStart + "T00:00:00"),
                    semExamEnd: new Date(semExamEnd + "T00:00:00")
                },
                create: {
                    academicYearId,
                    year,
                    semester,
                    classworkStart: new Date(classworkStart + "T00:00:00"),
                    classworkEnd: new Date(classworkEnd + "T00:00:00"),
                    mid1Start: new Date(mid1Start + "T00:00:00"),
                    mid1End: new Date(mid1End + "T00:00:00"),
                    mid2Start: new Date(mid2Start + "T00:00:00"),
                    mid2End: new Date(mid2End + "T00:00:00"),
                    semExamStart: new Date(semExamStart + "T00:00:00"),
                    semExamEnd: new Date(semExamEnd + "T00:00:00")
                }
            });

            return NextResponse.json({ success: true, data: timeline });
        } else {
            return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
        }
    } catch (error: any) {
        console.error("POST /api/admin/academic-calendar error:", error);
        return NextResponse.json({ error: error.message || "Failed to save calendar data" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const id = searchParams.get("id");

        if (!type || !id) {
            return NextResponse.json({ error: "Type and ID are required" }, { status: 400 });
        }

        if (type === "holiday") {
            await prisma.academicHoliday.delete({
                where: { id }
            });
            return NextResponse.json({ success: true });
        } else if (type === "timeline") {
            await prisma.academicSemesterTimeline.delete({
                where: { id }
            });
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
        }
    } catch (error: any) {
        console.error("DELETE /api/admin/academic-calendar error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete item" }, { status: 500 });
    }
}
