
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const years = await prisma.academicYear.findMany({
            orderBy: {
                startDate: 'desc'
            }
        });
        return NextResponse.json(years);
    } catch (error) {
        console.error("Error fetching academic years:", error);
        return NextResponse.json({ error: "Failed to fetch academic years" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, startDate, endDate, isCurrent } = body;

        // If isCurrent is true, unset others
        if (isCurrent) {
            await prisma.academicYear.updateMany({
                where: { isCurrent: true },
                data: { isCurrent: false }
            });
        }

        const newYear = await prisma.academicYear.create({
            data: {
                name,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isCurrent: isCurrent || false
            }
        });

        return NextResponse.json(newYear);
    } catch (error) {
        console.error("Error creating academic year:", error);
        return NextResponse.json({ error: "Failed to create academic year" }, { status: 500 });
    }
}
