import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const academicYearId = url.searchParams.get("academicYearId");
        const year = url.searchParams.get("year");
        const semester = url.searchParams.get("semester");

        if (!academicYearId) {
            return NextResponse.json({ error: "academicYearId is required" }, { status: 400 });
        }

        // Fetch all open elective subjects for the given year/sem
        const subjects = await prisma.subject.findMany({
            where: {
                isElective: true,
                year: year || undefined,
                semester: semester || undefined,
                electiveSlotRelation: {
                    OR: [
                        { name: { startsWith: "OE", mode: "insensitive" } },
                        { name: { startsWith: "OPEN", mode: "insensitive" } }
                    ]
                }
            },
            include: {
                department: { select: { id: true, name: true, code: true } }
            },
            orderBy: { name: "asc" }
        });

        const subjectIds = subjects.map(s => s.id);

        // Fetch all mappings for these subjects in the chosen academic year
        const mappings = await prisma.facultySubjectMapping.findMany({
            where: {
                academicYearId: academicYearId,
                subjectId: { in: subjectIds }
            },
            include: {
                faculty: {
                    select: { id: true, empName: true, empCode: true, department: { select: { code: true } } }
                }
            }
        });

        // Group mappings by subjectId to get a unique list of assigned faculty IDs
        const subjectFacultyMap = new Map<string, Set<string>>();
        mappings.forEach(m => {
            if (!subjectFacultyMap.has(m.subjectId)) {
                subjectFacultyMap.set(m.subjectId, new Set());
            }
            subjectFacultyMap.get(m.subjectId)!.add(m.facultyId);
        });

        // Construct response structure
        const result = subjects.map(sub => {
            const facultyIds = Array.from(subjectFacultyMap.get(sub.id) || []);
            return {
                ...sub,
                facultyIds: facultyIds
            };
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error fetching open elective mappings:", error);
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
        const { academicYearId, mappings } = body;
        // mappings is array of { subjectId, facultyIds: string[] }

        if (!academicYearId || !mappings || !Array.isArray(mappings)) {
            return NextResponse.json({ error: "academicYearId and mappings array are required" }, { status: 400 });
        }

        // Get all sections in the database to map open electives globally
        const sections = await prisma.section.findMany({ select: { id: true } });

        // Transaction to sync elective mappings across all sections
        await prisma.$transaction(async (tx) => {
            for (const m of mappings) {
                const { subjectId, facultyIds } = m;
                if (!subjectId) continue;

                // Delete existing mapping for this subject & academic year across all sections
                await tx.facultySubjectMapping.deleteMany({
                    where: {
                        subjectId,
                        academicYearId
                    }
                });

                // Create new mappings for each section if facultyIds are provided
                if (facultyIds && Array.isArray(facultyIds) && facultyIds.length > 0) {
                    const dataToInsert: any[] = [];
                    sections.forEach((sec) => {
                        facultyIds.forEach((fid) => {
                            if (fid) {
                                dataToInsert.push({
                                    facultyId: fid,
                                    subjectId,
                                    sectionId: sec.id,
                                    academicYearId
                                });
                            }
                        });
                    });

                    if (dataToInsert.length > 0) {
                        await tx.facultySubjectMapping.createMany({
                            data: dataToInsert,
                            skipDuplicates: true
                        });
                    }
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Open Electives Faculty Mapping POST error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
