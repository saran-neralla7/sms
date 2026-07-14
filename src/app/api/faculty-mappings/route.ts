import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authOptions as any);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const academicYearId = url.searchParams.get("academicYearId");

        if (!academicYearId) {
            return NextResponse.json({ error: "academicYearId is required" }, { status: 400 });
        }

        let facultyId = session.user.facultyId;
        
        if (!facultyId) {
            const faculty = await prisma.faculty.findFirst({
                where: { user: { username: session.user.username } }
            });
            if (faculty) {
                facultyId = faculty.id;
            }
        }

        if (!facultyId && session.user.role === "FACULTY") {
            return NextResponse.json({ error: "Faculty profile not found" }, { status: 404 });
        }

        const whereClause: any = {
            academicYearId
        };

        if (session.user.role === "FACULTY" || facultyId) {
            whereClause.facultyId = facultyId;
        }

        const mappings = await prisma.facultySubjectMapping.findMany({
            where: whereClause,
            include: {
                subject: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        type: true,
                        year: true,
                        semester: true,
                        departmentId: true,
                        isElective: true,
                        electiveSlotId: true,
                        electiveSlotRelation: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                section: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                academicYear: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        return NextResponse.json(mappings);
    } catch (error: any) {
        console.error("Error fetching faculty mappings:", error);
        return NextResponse.json({ error: "Failed to fetch mappings" }, { status: 500 });
    }
}
