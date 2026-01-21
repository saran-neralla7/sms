import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ... imports

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

        const userRole = session.user.role;
        const userId = session.user.id;

        let whereClause: any = {
            year: year || undefined,
            semester: semester || undefined,
            sectionId: sectionId || undefined,
            departmentId: departmentId || undefined,
        };

        if (userRole === "USER") {
            // USER: Strictly sees ONLY what they uploaded (SMS History)
            whereClause.downloadedBy = userId;
        } else {
            // ACADEMIC (Admin/HOD/Faculty): 
            // 1. See Academic Attendance (NOT marked by USER role)
            // 2. Filter by Dept if HOD

            whereClause.user = { role: { not: "USER" } };

            if (userRole === "HOD") {
                const userProfile = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { departmentId: true }
                });
                if (userProfile?.departmentId) {
                    whereClause.departmentId = userProfile.departmentId;
                }
            }
            // FACULTY can see all academic history or just their own? 
            // Usually academic history is open to Staff. Let's keep it open for now but excluding 'USER' SMS logs.
        }

        const history = await prisma.attendanceHistory.findMany({
            where: whereClause,
            include: {
                section: true,
                subject: true,
                user: { select: { username: true, role: true } } // Include role to verify
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
        const userRole = session.user.role;

        // Validation Logic
        if (userRole !== "USER") {
            // ACADEMIC Roles: Must select Subject
            if (!body.subjectId) {
                return NextResponse.json({ error: "Subject selection is mandatory for Academic Attendance" }, { status: 400 });
            }
        }

        // Normalize periodIds
        const periodIds: string[] = body.periodIds && body.periodIds.length > 0
            ? body.periodIds
            : (body.periodId ? [body.periodId] : []);

        if (periodIds.length === 0) {
            // If USER (SMS only) uses standard mode without periods
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

        return NextResponse.json(createdRecords[0]);
    } catch (error) {
        return NextResponse.json({ error: "Failed to log history" }, { status: 500 });
    }
}
