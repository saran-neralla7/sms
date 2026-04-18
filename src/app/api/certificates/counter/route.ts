import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const type = url.searchParams.get("type") || "TC";

        let counter = await prisma.certificateCounter.findUnique({
            where: { certificateType: type }
        });

        if (!counter) {
            counter = await prisma.certificateCounter.create({
                data: { certificateType: type, currentNumber: 0 }
            });
        }

        return NextResponse.json({ currentNumber: counter.currentNumber });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized. Admin only." }, { status: 401 });
        }

        const body = await req.json();
        const { type = "TC", startingNumber } = body;

        if (startingNumber === undefined || typeof startingNumber !== 'number') {
            return NextResponse.json({ error: "Valid starting number is required." }, { status: 400 });
        }

        const counter = await prisma.certificateCounter.upsert({
            where: { certificateType: type },
            update: { currentNumber: startingNumber },
            create: { certificateType: type, currentNumber: startingNumber }
        });

        return NextResponse.json({ success: true, baseNumber: counter.currentNumber });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
