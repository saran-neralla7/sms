import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get("departmentId");
        const subjectId = searchParams.get("subjectId");
        const sectionId = searchParams.get("sectionId");
        const search = searchParams.get("search"); // Search query for faculty name/code
        const startDateStr = searchParams.get("startDate");
        const endDateStr = searchParams.get("endDate");

        const userRole = session.user.role;
        const userId = session.user.id;

        // Fetch current academic year from cookies if not provided
        const cookieStore = await cookies();
        let academicYearId = cookieStore.get("academic-year-id")?.value;
        if (!academicYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            if (currentYear) academicYearId = currentYear.id;
        }

        // Base where clause
        let whereClause: any = {
            topicsTaught: { not: null },
            academicYearId: academicYearId || undefined,
            subjectId: subjectId || undefined,
            sectionId: sectionId || undefined,
        };

        // Role-based restrictions
        if (userRole === "FACULTY" || userRole === "SMS_USER") {
            // Faculty only sees their own logged diaries
            whereClause.downloadedBy = userId;
        } else if (userRole === "HOD") {
            // HOD sees their own department diaries only
            const userProfile = await prisma.user.findUnique({
                where: { id: userId },
                select: { departmentId: true }
            });
            if (userProfile?.departmentId) {
                whereClause.departmentId = userProfile.departmentId;
            } else {
                return NextResponse.json({ error: "HOD department profile not found." }, { status: 400 });
            }
        } else {
            // ADMIN / DIRECTOR / PRINCIPAL sees all departments, optional department filter
            if (departmentId) {
                whereClause.departmentId = departmentId;
            }
        }

        // Date range filter
        if (startDateStr || endDateStr) {
            whereClause.date = {};
            if (startDateStr) {
                const sDate = new Date(startDateStr);
                sDate.setHours(0, 0, 0, 0);
                whereClause.date.gte = sDate;
            }
            if (endDateStr) {
                const eDate = new Date(endDateStr);
                eDate.setHours(23, 59, 59, 999);
                whereClause.date.lte = eDate;
            }
        }

        // Search filter (Employee Name or Employee Code or Username)
        if (search) {
            const trimmedSearch = search.trim();
            whereClause.user = {
                OR: [
                    { username: { contains: trimmedSearch, mode: "insensitive" } },
                    { faculty: { empName: { contains: trimmedSearch, mode: "insensitive" } } },
                    { faculty: { empCode: { contains: trimmedSearch, mode: "insensitive" } } }
                ]
            };
        }

        // Fetch records
        const diaries = await prisma.attendanceHistory.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        username: true,
                        role: true,
                        faculty: {
                            select: {
                                empCode: true,
                                empName: true
                            }
                        }
                    }
                },
                subject: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        shortName: true,
                        year: true,
                        semester: true
                    }
                },
                section: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                },
                period: {
                    select: {
                        id: true,
                        name: true,
                        startTime: true,
                        endTime: true
                    }
                }
            },
            orderBy: { date: "desc" }
        });

        return NextResponse.json(diaries);

    } catch (error) {
        console.error("Failed to fetch teaching diary:", error);
        return NextResponse.json({ error: "Failed to fetch teaching diary" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { date, subjectId, sectionId, periodId, topicsTaught } = body;

        if (!date || !subjectId || !sectionId || !periodId || !topicsTaught) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Fetch subject details to get year, semester, departmentId
        const subject = await prisma.subject.findUnique({
            where: { id: subjectId }
        });

        if (!subject) {
            return NextResponse.json({ error: "Subject not found" }, { status: 404 });
        }

        // Get current academic year id
        const cookieStore = await cookies();
        let academicYearId = cookieStore.get("academic-year-id")?.value;
        if (!academicYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            if (currentYear) academicYearId = currentYear.id;
        }

        // Check if there is already an AttendanceHistory record for this date, section, period, year, department
        const existing = await prisma.attendanceHistory.findFirst({
            where: {
                date: new Date(date),
                sectionId,
                periodId,
                year: subject.year,
                departmentId: subject.departmentId
            }
        });

        if (existing) {
            // Update existing record
            const updated = await prisma.attendanceHistory.update({
                where: { id: existing.id },
                data: {
                    topicsTaught,
                    subjectId,
                    downloadedBy: session.user.id
                }
            });
            return NextResponse.json(updated);
        }

        // Create new record
        const record = await prisma.attendanceHistory.create({
            data: {
                date: new Date(date),
                year: subject.year,
                semester: subject.semester,
                sectionId,
                departmentId: subject.departmentId,
                academicYearId: academicYearId || null,
                subjectId,
                periodId,
                status: "Completed",
                type: "ACADEMIC",
                fileName: "Manual Entry",
                downloadedBy: session.user.id,
                details: "[]",
                topicsTaught
            }
        });

        return NextResponse.json(record);
    } catch (error: any) {
        console.error("Failed to create teaching diary entry:", error);
        return NextResponse.json({ error: error.message || "Failed to create entry" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, topicsTaught, date, periodId, sectionId, subjectId } = body;

        if (!id || !topicsTaught) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const data: any = { topicsTaught };
        if (date) data.date = new Date(date);
        if (periodId) data.periodId = periodId;
        if (sectionId) data.sectionId = sectionId;
        if (subjectId) data.subjectId = subjectId;

        const updated = await prisma.attendanceHistory.update({
            where: { id },
            data
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error("Failed to update teaching diary entry:", error);
        return NextResponse.json({ error: error.message || "Failed to update entry" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing entry ID" }, { status: 400 });
        }

        const record = await prisma.attendanceHistory.findUnique({
            where: { id }
        });

        if (!record) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        if (record.details === "[]" || !record.details || record.details === "null") {
            // Delete the record completely
            await prisma.attendanceHistory.delete({
                where: { id }
            });
        } else {
            // Keep attendance record, but delete topicsTaught text
            await prisma.attendanceHistory.update({
                where: { id },
                data: { topicsTaught: null }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete teaching diary entry:", error);
        return NextResponse.json({ error: error.message || "Failed to delete entry" }, { status: 500 });
    }
}

