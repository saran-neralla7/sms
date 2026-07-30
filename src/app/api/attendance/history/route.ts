import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ... imports

import { cookies } from "next/headers";

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
        const facultyUsername = searchParams.get("facultyUsername");

        const userRole = session.user.role;
        const userId = session.user.id;

        // Academic Year Filter
        const cookieStore = await cookies();
        let academicYearId = cookieStore.get("academic-year-id")?.value;

        if (!academicYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            if (currentYear) academicYearId = currentYear.id;
        }

        // Search logic...

        let whereClause: any = {
            academicYearId: academicYearId || undefined,
            year: year || undefined,
            semester: semester || undefined,
            sectionId: sectionId || undefined,
            departmentId: departmentId || undefined,
        };

        if (facultyUsername) {
            whereClause.user = {
                username: {
                    contains: facultyUsername,
                    mode: "insensitive"
                }
            };
        }

        // Exclude MBA records for non-MBA, non-admin users
        const userProfileForMbaCheck = await prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true, role: true }
        });
        const mbaDept = await prisma.department.findFirst({
            where: { code: "MBA" }
        });
        if (mbaDept) {
            const isMbaUser = userProfileForMbaCheck?.departmentId === mbaDept.id;
            const isAdminUser = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userProfileForMbaCheck?.role || "");
            if (!isMbaUser && !isAdminUser) {
                if (whereClause.departmentId === mbaDept.id) {
                    whereClause.departmentId = "NONE";
                } else if (!whereClause.departmentId) {
                    whereClause.departmentId = {
                        not: mbaDept.id
                    };
                }
            }
        }

        if (userRole === "SMS_USER") {
            whereClause.type = "SMS";
            whereClause.downloadedBy = userId;
        } else if (userRole === "FACULTY") {
            whereClause.type = "ACADEMIC";

            const facProfile = await prisma.faculty.findFirst({
                where: { user: { id: userId } },
                select: { id: true }
            });

            if (facProfile) {
                const mappings = await prisma.facultySubjectMapping.findMany({
                    where: { facultyId: facProfile.id },
                    select: { subjectId: true, sectionId: true }
                });

                const mappedConditions = mappings.map(m => ({
                    subjectId: m.subjectId,
                    sectionId: m.sectionId
                }));

                whereClause.OR = [
                    { downloadedBy: userId },
                    ...(mappedConditions.length > 0 ? mappedConditions : [])
                ];
            } else {
                whereClause.downloadedBy = userId;
            }
        } else {
            // ACADEMIC (Admin/HOD): 
            const mode = searchParams.get("mode");

            if (mode === "sms") {
                // View SMS Log History
                whereClause.type = "SMS";
            } else {
                // Default: View Academic Attendance
                whereClause.type = "ACADEMIC";
            }

            if (userRole === "HOD") {
                const userProfile = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { departmentId: true }
                });
                if (userProfile?.departmentId) {
                    whereClause.departmentId = userProfile.departmentId;
                }
            }
        }

        const history = await prisma.attendanceHistory.findMany({
            where: whereClause,
            include: {
                section: true,
                subject: true,
                period: true,
                department: { select: { name: true, code: true } },
                user: { select: { username: true, role: true, faculty: { select: { empName: true } } } }
            },
            orderBy: { date: 'desc' }
        });

        // Pre-fetch FacultySubjectMapping to attach all assigned faculty names for each record
        const allMappings = await prisma.facultySubjectMapping.findMany({
            where: {
                academicYearId: academicYearId || undefined
            },
            include: {
                faculty: {
                    select: {
                        empName: true,
                        user: { select: { username: true } }
                    }
                }
            }
        });

        const mappedFacultyMap = new Map<string, Array<string>>();
        for (const m of allMappings) {
            const key = `${m.subjectId}_${m.sectionId}`;
            if (!mappedFacultyMap.has(key)) {
                mappedFacultyMap.set(key, []);
            }
            const name = m.faculty?.empName || m.faculty?.user?.username;
            if (name) {
                const list = mappedFacultyMap.get(key)!;
                if (!list.includes(name)) {
                    list.push(name);
                }
            }
        }

        // Resolve student departments if details exist
        const rollNumbers = new Set<string>();
        for (const record of history) {
            try {
                const students = JSON.parse(record.details || "[]");
                for (const student of students) {
                    const roll = student["Roll Number"] || student.rollNumber;
                    if (roll) {
                        rollNumbers.add(roll);
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        const studentsDb = await prisma.student.findMany({
            where: {
                rollNumber: { in: Array.from(rollNumbers) }
            },
            select: {
                rollNumber: true,
                department: {
                    select: {
                        code: true,
                        name: true
                    }
                }
            }
        });

        const studentDeptMap = new Map<string, string>();
        for (const s of studentsDb) {
            if (s.department) {
                studentDeptMap.set(s.rollNumber, s.department.code || s.department.name);
            }
        }

        const historyWithResolvedDepts = history.map(record => {
            const resolvedDeptsSet = new Set<string>();
            try {
                const students = JSON.parse(record.details || "[]");
                for (const student of students) {
                    const roll = student["Roll Number"] || student.rollNumber;
                    if (roll) {
                        const dept = studentDeptMap.get(roll);
                        if (dept) {
                            resolvedDeptsSet.add(dept);
                        }
                    }
                }
            } catch (e) {
                // ignore
            }

            const recKey = `${record.subjectId}_${record.sectionId}`;
            const mappedFacs = mappedFacultyMap.get(recKey) || [];

            const postedByEmpName = record.user?.faculty?.empName || record.user?.username || "Unknown";

            const allFacNamesSet = new Set<string>();
            mappedFacs.forEach(f => allFacNamesSet.add(f));
            allFacNamesSet.add(postedByEmpName);

            return {
                ...record,
                resolvedDepts: Array.from(resolvedDeptsSet),
                mappedFacultyNames: Array.from(allFacNamesSet),
                postedByName: postedByEmpName
            };
        });

        return NextResponse.json(historyWithResolvedDepts);
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

            // Verify Subject matches the provided Year and Semester
            if (body.subjectId && body.year && body.semester) {
                const subject = await prisma.subject.findUnique({ where: { id: body.subjectId } });
                if (!subject) {
                    return NextResponse.json({ error: "Invalid Subject selected" }, { status: 400 });
                }
                if (subject.year !== String(body.year) || subject.semester !== String(body.semester)) {
                    return NextResponse.json({
                        error: `Subject '${subject.name}' belongs to Year ${subject.year} - Sem ${subject.semester}, but you are trying to post for Year ${body.year} - Sem ${body.semester}. Please refresh the page and select the correct subject.`
                    }, { status: 400 });
                }
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
