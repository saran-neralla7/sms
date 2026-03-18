import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List all exam application settings
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const settings = await prisma.examApplicationSetting.findMany({
            orderBy: [{ year: "asc" }, { semester: "asc" }]
        });
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Fetch settings error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

// POST: Create a new exam application setting (admin)
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { year, semester, startDate, endDate, lateFeeEndDate } = body;

        if (!year || !semester || !startDate || !endDate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const setting = await prisma.examApplicationSetting.upsert({
            where: { year_semester: { year, semester } },
            update: {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                lateFeeEndDate: lateFeeEndDate ? new Date(lateFeeEndDate) : null,
                isActive: true
            },
            create: {
                year,
                semester,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                lateFeeEndDate: lateFeeEndDate ? new Date(lateFeeEndDate) : null,
            }
        });

        return NextResponse.json(setting);
    } catch (error) {
        console.error("Create setting error:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}
