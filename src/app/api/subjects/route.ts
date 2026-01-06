import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");

    const where: any = {};
    if (departmentId) where.departmentId = departmentId;
    if (year) where.year = year;
    if (semester) where.semester = semester;

    try {
        const subjects = await prisma.subject.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { department: true }
        });
        return NextResponse.json(subjects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, code, year, semester, type, departmentId } = body;

        const subject = await prisma.subject.create({
            data: {
                name,
                code,
                year,
                semester,
                type,
                departmentId
            }
        });
        return NextResponse.json(subject);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
    }
}
