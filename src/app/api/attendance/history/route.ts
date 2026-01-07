import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year");
        const semester = searchParams.get("semester");
        const sectionId = searchParams.get("sectionId");
        const departmentId = searchParams.get("departmentId");

        let whereClause: any = {
            year: year || undefined,
            semester: semester || undefined,
            sectionId: sectionId || undefined,
            departmentId: departmentId || undefined,
        };

        if (session.user.role === "HOD") {
            // HOD: Restricted to their department assigned in User profile
            const userProfile = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { departmentId: true }
            });
            if (userProfile?.departmentId) {
                whereClause.departmentId = userProfile.departmentId;
            }
        } else if (session.user.role === "USER" || session.user.role === "FACULTY") {
            // USER/FACULTY: Restricted to records THEY downloaded/saved
            whereClause.downloadedBy = session.user.id;
        }
        // ADMIN: Can see all, filters applied above (departmentId from searchParams)

        const history = await prisma.attendanceHistory.findMany({
            where: whereClause,
            include: {
                section: true,
                subject: true,
                user: { select: { username: true } } // Show who downloaded it
            },
            orderBy: { date: 'desc' }
        });
        return NextResponse.json(history);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();

        // Normalize periodIds: Use array if provided, otherwise fallback to single periodId
        const periodIds: string[] = body.periodIds && body.periodIds.length > 0
            ? body.periodIds
            : (body.periodId ? [body.periodId] : []);

        if (periodIds.length === 0) {
            // Fallback for cases where neither is provided (shouldn't happen with correct frontend) or non-period based attendance
            const history = await prisma.attendanceHistory.create({
                data: {
                    year: String(body.year),
                    semester: String(body.semester),
                    sectionId: String(body.sectionId || body.section),
                    departmentId: String(body.departmentId || body.department),
                    status: body.status,
                    fileName: body.fileName,
                    date: body.date,
                    details: body.details || "[]",
                    downloadedBy: session.user.id,
                    subjectId: body.subjectId || undefined,
                    periodId: undefined,
                },
            });
            return NextResponse.json(history);
        }

        // Transactional creation for multiple periods
        const createdRecords = await prisma.$transaction(
            periodIds.map((pid) =>
                prisma.attendanceHistory.create({
                    data: {
                        year: String(body.year),
                        semester: String(body.semester),
                        sectionId: String(body.sectionId || body.section),
                        departmentId: String(body.departmentId || body.department),
                        status: body.status,
                        fileName: body.fileName,
                        date: body.date,
                        details: body.details || "[]",
                        downloadedBy: session.user.id,
                        subjectId: body.subjectId || undefined,
                        periodId: pid,
                    },
                })
            )
        );

        return NextResponse.json(createdRecords[0]); // Return first record as success indicator
    } catch (error) {
        return NextResponse.json({ error: "Failed to log history" }, { status: 500 });
    }
}
