import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: Check if a UTR number already exists
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { utrNumber } = await request.json();
        if (!utrNumber) return NextResponse.json({ duplicate: false });

        const existing = await prisma.examApplication.findFirst({ where: { utrNumber } });
        return NextResponse.json({ duplicate: !!existing });
    } catch (error) {
        console.error("UTR check error:", error);
        return NextResponse.json({ error: "Failed to check" }, { status: 500 });
    }
}
