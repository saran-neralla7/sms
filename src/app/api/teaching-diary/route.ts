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
        const includeAll = searchParams.get("includeAll") === "true";

        const userRole = session.user.role;
        const userId = session.user.id;

        // Fetch current academic year from cookies if not provided
        const cookieStore = await cookies();
        let academicYearId = cookieStore.get("academic-year-id")?.value;
        if (!academicYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            if (currentYear) academicYearId = currentYear.id;
        }

        // Find all sections mapped to this subject in the current academic year
        let sectionIds: string[] = [];
        if (subjectId) {
            const mappings = await prisma.facultySubjectMapping.findMany({
                where: {
                    academicYearId: academicYearId || undefined,
                    subjectId
                },
                select: { sectionId: true }
            });
            sectionIds = Array.from(new Set(mappings.map(m => m.sectionId)));
            if (sectionId && !sectionIds.includes(sectionId)) {
                sectionIds.push(sectionId);
            }
        } else if (sectionId) {
            sectionIds = [sectionId];
        }

        // Base where clause
        let whereClause: any = {
            academicYearId: academicYearId || undefined,
            subjectId: subjectId || undefined,
        };

        if (sectionIds.length > 0) {
            whereClause.sectionId = { in: sectionIds };
        }

        if (!includeAll) {
            whereClause.topicsTaught = { not: null };
        }

        // Role-based restrictions
        if (userRole === "FACULTY" || userRole === "SMS_USER") {
            // Faculty only sees their own logged diaries or diaries for mapped subjects and sections
            const userObj = await prisma.user.findUnique({
                where: { id: userId },
                select: { facultyId: true }
            });
            if (userObj?.facultyId) {
                const facultyMappings = await prisma.facultySubjectMapping.findMany({
                    where: {
                        academicYearId: academicYearId || undefined,
                        facultyId: userObj.facultyId
                    },
                    select: { subjectId: true, sectionId: true }
                });

                if (facultyMappings.length > 0) {
                    whereClause.OR = [
                        { downloadedBy: userId },
                        {
                            AND: [
                                { subjectId: { in: facultyMappings.map(m => m.subjectId) } },
                                { sectionId: { in: facultyMappings.map(m => m.sectionId) } }
                            ]
                        }
                    ];
                } else {
                    whereClause.downloadedBy = userId;
                }
            } else {
                whereClause.downloadedBy = userId;
            }
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

        // Group/De-duplicate diaries that belong to the same date, period, subject, and creator (downloadedBy)
        const uniqueDiaries: typeof diaries = [];
        const seenKeys = new Set<string>();
        const groups = new Map<string, typeof diaries>();

        for (const d of diaries) {
            const dateKey = d.date instanceof Date ? d.date.toISOString().split("T")[0] : String(d.date).split("T")[0];
            const key = `${dateKey}_${d.periodId || "no-period"}_${d.subjectId || "no-subject"}_${d.downloadedBy || "no-user"}`;
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(d);
        }

        for (const d of diaries) {
            const dateKey = d.date instanceof Date ? d.date.toISOString().split("T")[0] : String(d.date).split("T")[0];
            const key = `${dateKey}_${d.periodId || "no-period"}_${d.subjectId || "no-subject"}_${d.downloadedBy || "no-user"}`;
            
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                const group = groups.get(key)!;
                
                // Find a record with non-empty topicsTaught
                let representative = group.find(r => (r.topicsTaught || "").trim() !== "");
                if (!representative) {
                    representative = group[0];
                }

                // Extract all section names
                const sectionNames = Array.from(
                    new Set(
                        group
                            .map(r => r.section?.name)
                            .filter((name): name is string => typeof name === "string" && name.trim() !== "")
                    )
                ).sort();

                const mergedSectionName = sectionNames.join(", ");

                uniqueDiaries.push({
                    ...representative,
                    section: representative.section ? {
                        ...representative.section,
                        name: mergedSectionName || representative.section.name
                    } : representative.section
                });
            }
        }

        return NextResponse.json(uniqueDiaries);

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

        let record;
        if (existing) {
            // Update existing record
            record = await prisma.attendanceHistory.update({
                where: { id: existing.id },
                data: {
                    topicsTaught,
                    subjectId,
                    downloadedBy: session.user.id
                }
            });
        } else {
            // Create new record
            record = await prisma.attendanceHistory.create({
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
        }

        // Resolve the actual Faculty ID for this mapping
        let resolvedFacultyId: string | null = null;
        const mappingForThis = await prisma.facultySubjectMapping.findFirst({
            where: {
                academicYearId: academicYearId || undefined,
                subjectId,
                sectionId
            }
        });
        if (mappingForThis) {
            resolvedFacultyId = mappingForThis.facultyId;
        } else if (session.user.role === "FACULTY" || session.user.role === "SMS_USER") {
            const userObj = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { facultyId: true }
            });
            resolvedFacultyId = userObj?.facultyId || null;
        }

        // Find all other sections mapped to this subject for this faculty
        const otherSectionIds = resolvedFacultyId
            ? Array.from(new Set(
                (await prisma.facultySubjectMapping.findMany({
                    where: {
                        academicYearId: academicYearId || undefined,
                        subjectId,
                        facultyId: resolvedFacultyId
                    },
                    select: { sectionId: true }
                })).map(m => m.sectionId)
              )).filter(sid => sid !== sectionId)
            : [];

        // Sync/replicate the entry to other sections for the same date and period
        for (const sid of otherSectionIds) {
            const existingOther = await prisma.attendanceHistory.findFirst({
                where: {
                    date: new Date(date),
                    sectionId: sid,
                    periodId,
                    year: subject.year,
                    departmentId: subject.departmentId
                }
            });

            if (existingOther) {
                 await prisma.attendanceHistory.update({
                     where: { id: existingOther.id },
                     data: {
                         topicsTaught,
                         subjectId,
                         downloadedBy: session.user.id
                     }
                 });
             }
        }

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

        const targetRecord = await prisma.attendanceHistory.findUnique({
            where: { id }
        });
        if (!targetRecord) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        const updated = await prisma.attendanceHistory.update({
            where: { id },
            data
        });

        // Resolve the actual Faculty ID for this mapping
        let resolvedFacultyId: string | null = null;
        const mappingForThis = await prisma.facultySubjectMapping.findFirst({
            where: {
                academicYearId: targetRecord.academicYearId || undefined,
                subjectId: targetRecord.subjectId || undefined,
                sectionId: targetRecord.sectionId
            }
        });
        if (mappingForThis) {
            resolvedFacultyId = mappingForThis.facultyId;
        } else if (session.user.role === "FACULTY" || session.user.role === "SMS_USER") {
            const userObj = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { facultyId: true }
            });
            resolvedFacultyId = userObj?.facultyId || null;
        }

        // Find other sections mapped to this subject for this faculty
        const otherSectionIds = resolvedFacultyId
            ? Array.from(new Set(
                (await prisma.facultySubjectMapping.findMany({
                    where: {
                        academicYearId: targetRecord.academicYearId || undefined,
                        subjectId: targetRecord.subjectId || undefined,
                        facultyId: resolvedFacultyId
                    },
                    select: { sectionId: true }
                })).map(m => m.sectionId)
              )).filter(sid => sid !== targetRecord.sectionId)
            : [];

        // Synchronize update to other sections' entries for the exact same date and period
        if (otherSectionIds.length > 0 && targetRecord.date && targetRecord.periodId) {
            await prisma.attendanceHistory.updateMany({
                where: {
                    subjectId: targetRecord.subjectId || undefined,
                    date: targetRecord.date,
                    periodId: targetRecord.periodId,
                    sectionId: { in: otherSectionIds }
                },
                data: {
                    topicsTaught
                }
            });
        }

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

        // Resolve the actual Faculty ID for this mapping
        let resolvedFacultyId: string | null = null;
        const mappingForThis = await prisma.facultySubjectMapping.findFirst({
            where: {
                academicYearId: record.academicYearId || undefined,
                subjectId: record.subjectId || undefined,
                sectionId: record.sectionId
            }
        });
        if (mappingForThis) {
            resolvedFacultyId = mappingForThis.facultyId;
        } else if (session.user.role === "FACULTY" || session.user.role === "SMS_USER") {
            const userObj = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { facultyId: true }
            });
            resolvedFacultyId = userObj?.facultyId || null;
        }

        // Find other sections mapped to this subject for this faculty
        const otherSectionIds = resolvedFacultyId
            ? Array.from(new Set(
                (await prisma.facultySubjectMapping.findMany({
                    where: {
                        academicYearId: record.academicYearId || undefined,
                        subjectId: record.subjectId || undefined,
                        facultyId: resolvedFacultyId
                    },
                    select: { sectionId: true }
                })).map(m => m.sectionId)
              )).filter(sid => sid !== record.sectionId)
            : [];

        if (record.details === "[]" || !record.details || record.details === "null") {
            // Delete the record completely
            await prisma.attendanceHistory.delete({
                where: { id }
            });

            // Delete other records that have no details as well
            if (otherSectionIds.length > 0 && record.date && record.periodId) {
                await prisma.attendanceHistory.deleteMany({
                    where: {
                        subjectId: record.subjectId || undefined,
                        date: record.date,
                        periodId: record.periodId,
                        sectionId: { in: otherSectionIds },
                        OR: [
                            { details: "" },
                            { details: "[]" },
                            { details: "null" }
                        ]
                    }
                });

                // Clear topicsTaught for any that DO have details
                await prisma.attendanceHistory.updateMany({
                    where: {
                        subjectId: record.subjectId || undefined,
                        date: record.date,
                        periodId: record.periodId,
                        sectionId: { in: otherSectionIds },
                        NOT: [
                            { details: "" },
                            { details: "[]" },
                            { details: "null" }
                        ]
                    },
                    data: { topicsTaught: null }
                });
            }
        } else {
            // Keep attendance record, but delete topicsTaught text
            await prisma.attendanceHistory.update({
                where: { id },
                data: { topicsTaught: null }
            });

            // Clear topicsTaught for other sections
            if (otherSectionIds.length > 0 && record.date && record.periodId) {
                await prisma.attendanceHistory.updateMany({
                    where: {
                        subjectId: record.subjectId || undefined,
                        date: record.date,
                        periodId: record.periodId,
                        sectionId: { in: otherSectionIds }
                    },
                    data: { topicsTaught: null }
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete teaching diary entry:", error);
        return NextResponse.json({ error: error.message || "Failed to delete entry" }, { status: 500 });
    }
}

