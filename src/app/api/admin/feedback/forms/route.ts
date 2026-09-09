import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";

import { cookies } from "next/headers";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const searchAyId = url.searchParams.get("academicYearId");

        const cookieStore = await cookies();
        const cookieAyId = cookieStore.get("academic-year-id")?.value;

        const isBSH = isBSHHod(session.user);
        const where: any = {};
        if (isBSH) {
            where.targetYear = 1;
        }

        // Apply academic year filter if query param or cookie is present (and not "ALL")
        const targetAyId = searchAyId !== null ? searchAyId : cookieAyId;
        if (targetAyId && targetAyId !== "ALL") {
            where.academicYearId = targetAyId;
        }

        const forms = await prisma.feedbackForm.findMany({
            where,
            include: {
                academicYear: true,
                template: true,
                targetSections: { select: { id: true, name: true } },
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
        if (!session?.user || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, academicYearId, templateId, startDate, endDate, isActive, sectionIds, targetYear, targetSemester, targetDepartmentId, targetBatchId } = body;

        if (!title || !academicYearId || !templateId || !startDate || !endDate) {
            return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
        }

        const data: any = {
            title,
            description,
            academicYearId,
            templateId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive: isActive !== undefined ? isActive : true,
            targetYear: targetYear ? parseInt(targetYear) : null,
            targetSemester: targetSemester ? parseInt(targetSemester) : null,
            targetDepartmentId: targetDepartmentId || null,
            targetBatchId: targetBatchId || null
        };

        if (Array.isArray(sectionIds) && sectionIds.length > 0) {
            data.targetSections = {
                connect: sectionIds.map((id: string) => ({ id }))
            };
        }

        const form = await prisma.feedbackForm.create({
            data
        });

        return NextResponse.json(form);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
