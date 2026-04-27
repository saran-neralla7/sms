import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const passingYear = url.searchParams.get("passingYear");

        const whereCondition = passingYear ? { passingYear } : {};

        const alumni = await prisma.alumni.findMany({
            where: whereCondition,
            orderBy: {
                passingYear: 'desc',
            },
            include: {
                department: true,
                batch: true,
                academicYear: true
            }
        });

        return NextResponse.json(alumni);
    } catch (error) {
        console.error("Error fetching alumni:", error);
        return NextResponse.json({ error: "Failed to fetch alumni" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { rollNumber, name, mobile, passingYear, departmentId } = body;

        const newAlumni = await prisma.alumni.create({
            data: {
                rollNumber,
                name,
                mobile,
                passingYear,
                departmentId
            },
        });

        return NextResponse.json(newAlumni, { status: 201 });
    } catch (error) {
        console.error("Error creating alumni:", error);
        return NextResponse.json({ error: "Failed to create alumni" }, { status: 500 });
    }
}
