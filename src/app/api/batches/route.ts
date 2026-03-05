
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const batches = await prisma.batch.findMany({
            orderBy: {
                startYear: 'desc'
            },
            include: {
                _count: {
                    select: { students: true }
                }
            }
        });
        return NextResponse.json(batches);
    } catch (error) {
        console.error("Error fetching batches:", error);
        return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, startYear, endYear } = body;

        const newBatch = await prisma.batch.create({
            data: {
                name,
                startYear: parseInt(startYear),
                endYear: parseInt(endYear)
            }
        });

        return NextResponse.json(newBatch);
    } catch (error) {
        console.error("Error creating batch:", error);
        return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
    }
}
