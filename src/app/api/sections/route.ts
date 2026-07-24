import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    const where: any = {};
    if (departmentId) {
        where.departments = {
            some: { id: departmentId }
        };
    }

    if (session?.user?.role === "FACULTY") {
        let facultyId = (session.user as any).facultyId;
        if (!facultyId && session.user.username) {
            const fac = await prisma.faculty.findFirst({
                where: { user: { username: session.user.username } },
                select: { id: true }
            });
            if (fac) facultyId = fac.id;
        }

        if (facultyId) {
            const mappings = await prisma.facultySubjectMapping.findMany({
                where: { facultyId },
                select: { sectionId: true }
            });
            const mappedSectionIds = Array.from(new Set(mappings.map(m => m.sectionId).filter(Boolean)));
            where.id = { in: mappedSectionIds as string[] };
        }
    }

    try {
        const sections = await prisma.section.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(sections);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const section = await prisma.section.create({
            data: {
                name: body.name
            }
        });
        return NextResponse.json(section);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
    }
}
