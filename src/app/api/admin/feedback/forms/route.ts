import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const forms = await prisma.feedbackForm.findMany({
            include: {
                academicYear: true,
                _count: {
                    select: { submissions: true, responses: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json(forms);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, academicYearId, startDate, endDate, isActive } = body;

        if (!title || !academicYearId || !startDate || !endDate) {
            return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
        }

        const form = await prisma.feedbackForm.create({
            data: {
                title,
                description,
                academicYearId,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive: isActive !== undefined ? isActive : true
            }
        });

        return NextResponse.json(form);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
