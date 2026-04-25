import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const sectionId = url.searchParams.get("sectionId");
        const academicYearId = url.searchParams.get("academicYearId");

        if (!sectionId || !academicYearId) {
            return NextResponse.json({ error: "sectionId and academicYearId are required" }, { status: 400 });
        }

        const mappings = await prisma.facultySubjectMapping.findMany({
            where: { sectionId, academicYearId },
            include: {
                faculty: {
                    select: { id: true, empName: true, empCode: true, department: { select: { code: true } } }
                },
                subject: {
                    select: { id: true, name: true, code: true, type: true }
                }
            }
        });

        return NextResponse.json(mappings);
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
        const { sectionId, academicYearId, departmentId, mappings } = body;
        // mappings is array of { subjectId, facultyId }

        if (!sectionId || !academicYearId || !departmentId) {
            return NextResponse.json({ error: "sectionId, academicYearId and departmentId are required" }, { status: 400 });
        }

        // Transaction to sync mappings
        await prisma.$transaction(async (tx) => {
            // Delete existing mappings for this section, academic year and DEPARTMENT
            // Since section is shared across departments, we must only delete the subjects belonging to the currently edited department
            await tx.facultySubjectMapping.deleteMany({
                where: { 
                    sectionId, 
                    academicYearId,
                    subject: {
                        departmentId: departmentId
                    }
                }
            });

            // Insert new mappings
            if (mappings && mappings.length > 0) {
                await tx.facultySubjectMapping.createMany({
                    data: mappings.map((m: any) => ({
                        facultyId: m.facultyId,
                        subjectId: m.subjectId,
                        sectionId,
                        academicYearId
                    }))
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
