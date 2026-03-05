import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const showAll = searchParams.get("all") === "true";

        const where: any = {};
        if (!showAll) {
            where.isAcademic = true;
        }

        const departments = await prisma.department.findMany({
            where,
            include: { sections: true },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(departments);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const sectionConnect = body.sectionIds ? body.sectionIds.map((id: string) => ({ id })) : [];

        const dept = await prisma.department.create({
            data: {
                name: body.name,
                code: body.code,
                isAcademic: body.isAcademic !== undefined ? body.isAcademic : true,
                sections: {
                    connect: sectionConnect
                }
            },
            include: { sections: true }
        });
        return NextResponse.json(dept);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
    }
}
