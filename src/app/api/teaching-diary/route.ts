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
