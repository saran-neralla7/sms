import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const slots = await prisma.electiveSlot.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(slots);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch slots" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { name } = await request.json();
        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const slot = await prisma.electiveSlot.create({
            data: { name }
        });

        return NextResponse.json(slot);
    } catch (error) {
        console.error("Error creating slot:", error);
        return NextResponse.json({ error: "Failed to create slot" }, { status: 500 });
    }
}
