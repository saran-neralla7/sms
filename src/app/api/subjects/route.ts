import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const includeElectives = searchParams.get("includeElectives") === "true";
    const excludeElectives = searchParams.get("excludeElectives") === "true";
    const onlyElectives = searchParams.get("onlyElectives") === "true";
    const hasSyllabus = searchParams.get("hasSyllabus") === "true";

    const where: any = {};
    if (hasSyllabus) {
        where.syllabus = { not: null };
    } else {
        if (year) where.year = year;
        if (semester) where.semester = semester;

        if (onlyElectives) {
            where.isElective = true;
        } else if (departmentId) {
            if (includeElectives) {
                where.OR = [
                    { departmentId: departmentId },
                    { isElective: true }
                ];
            } else {
                where.departmentId = departmentId;
                if (excludeElectives) {
                    where.isElective = false;
                }
            }
        } else if (excludeElectives) {
            where.isElective = false;
        }
    }

    if (!hasSyllabus) {
        const isBSH = isBSHHod(session?.user as any);
        if (isBSH) {
            if (year && year !== "1") {
                return NextResponse.json([]);
            }
            where.year = "1";
        }

        // FACULTY SUBJECT MAPPING FALLBACK LOGIC
        const user = session?.user as any;
        const isFaculty = user?.role === "FACULTY";
        if (isFaculty && user?.facultyId) {
            const cookieStore = await cookies();
            let academicYearId = cookieStore.get("academic-year-id")?.value;
            if (!academicYearId) {
                const activeYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
                if (activeYear) academicYearId = activeYear.id;
            }

            if (academicYearId) {
                const mappings = await prisma.facultySubjectMapping.findMany({
                    where: {
                        facultyId: user.facultyId,
                        academicYearId: academicYearId,
                        subject: {
                            year: year || undefined,
                            semester: semester || undefined,
                            ...(onlyElectives ? { isElective: true } : (includeElectives ? {} : { departmentId: departmentId || undefined }))
                        }
                    },
                    select: { subjectId: true }
                });
                const mappedIds = mappings.map(m => m.subjectId);
                
                // If faculty has mappings for this criteria, restrict subjects. 
                // If empty, they fall back to seeing all subjects.
                if (mappedIds.length > 0) {
                    where.id = { in: mappedIds };
                }
            }
        }
    }

    try {
        const subjects = await prisma.subject.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { department: true, regulation: true, electiveSlotRelation: true }
        });
        return NextResponse.json(subjects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    const isBSH = isBSHHod(session?.user as any);
    if (!session || (session.user.role !== "ADMIN" && !isBSH)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { name, shortName, code, year, semester, type, departmentId, regulation, electiveSlot } = body;

        if (isBSH && year !== "1") {
            return NextResponse.json({ error: "BSH HOD can only create Year 1 subjects" }, { status: 403 });
        }

        const isElective = type.includes("ELECTIVE") || !!electiveSlot;

        // Resolve Regulation
        let regulationId = null;
        const regName = regulation || "R22";

        const regulationRecord = await prisma.regulation.findUnique({ where: { name: regName } });
        if (regulationRecord) {
            regulationId = regulationRecord.id;
        } else {
            const newReg = await prisma.regulation.create({ data: { name: regName } });
            regulationId = newReg.id;
        }

        // Resolve Elective Slot
        let electiveSlotId = null;
        if (electiveSlot) {
            const slotRecord = await prisma.electiveSlot.findUnique({ where: { name: electiveSlot } });
            if (slotRecord) {
                electiveSlotId = slotRecord.id;
            } else {
                const newSlot = await prisma.electiveSlot.create({ data: { name: electiveSlot } });
                electiveSlotId = newSlot.id;
            }
        }

        const subject = await prisma.subject.create({
            data: {
                name,
                shortName: shortName || null,
                code,
                year,
                semester,
                type,
                isElective,
                regulationId,
                electiveSlotId,
                departmentId
            }
        });
        return NextResponse.json(subject);
    } catch (error) {
        console.error("Error creating subject:", error);
        return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
    }
}
