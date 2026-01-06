import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const periods = await prisma.period.findMany({
            orderBy: { order: 'asc' }
        });
        return NextResponse.json(periods);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch periods" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, startTime, endTime, order } = body;

        const period = await prisma.period.create({
            data: {
                name,
                startTime,
                endTime,
                order: parseInt(order)
            }
        });
        return NextResponse.json(period);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create period" }, { status: 500 });
    }
}
