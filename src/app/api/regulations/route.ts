
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const regulations = await prisma.regulation.findMany({
            orderBy: { name: "asc" }
        });
        return NextResponse.json(regulations);
    } catch (error) {
        console.error("Error fetching regulations:", error);
        return NextResponse.json({ error: "Failed to fetch regulations" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { name } = await request.json();
        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const existing = await prisma.regulation.findUnique({
            where: { name }
        });

        if (existing) {
            return NextResponse.json({ error: "Regulation already exists" }, { status: 400 });
        }

        const regulation = await prisma.regulation.create({
            data: { name }
        });

        return NextResponse.json(regulation, { status: 201 });
    } catch (error) {
        console.error("Error creating regulation:", error);
        return NextResponse.json({ error: "Failed to create regulation" }, { status: 500 });
    }
}
