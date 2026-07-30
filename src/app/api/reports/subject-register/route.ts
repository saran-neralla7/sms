import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentsForClass } from "@/lib/student-utils";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const subjectId = searchParams.get("subjectId");
    const labBatchId = searchParams.get("labBatchId");

    let finalDepartmentId: string | null | undefined = departmentId || (session.user as any)?.departmentId;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { department: true }
    });

    if (!user) {
        return NextResponse.json({ error: "User profile not found." }, { status: 403 });
    }

    if (!finalDepartmentId && user.departmentId) {
        finalDepartmentId = user.departmentId;
    }

    const targetSubject = subjectId ? await prisma.subject.findUnique({ where: { id: subjectId }, include: { department: true } }) : null;
    const isOpenElective = targetSubject?.type === "OPEN_ELECTIVE" || targetSubject?.isElective;

    if (!year || !semester || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing required query parameters." }, { status: 400 });
    }

    if (!isOpenElective && (!sectionId || !finalDepartmentId)) {
        return NextResponse.json({ error: "Missing required department or section parameter." }, { status: 400 });
    }

    const userRole = (user.role || "").toUpperCase();
    const userDeptCode = user.department?.code || "";
    const isGlobal = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole) || userDeptCode === "BSH";

    if (!isGlobal && userRole === "HOD") {
        finalDepartmentId = user.departmentId;
    }

    try {
        // Resolve academic year from date or fallback to current
        const academicYearObj = await prisma.academicYear.findFirst({
            where: {
                startDate: { lte: new Date(startDate) },
                endDate: { gte: new Date(startDate) }
            }
        }) || await prisma.academicYear.findFirst({ where: { isCurrent: true } });

        const academicYearId = academicYearObj?.id;
        if (!academicYearId) {
            return NextResponse.json({ error: "Academic Year not found" }, { status: 400 });
        }

        // Fetch students
        let students: any[] = [];
        if (isOpenElective && subjectId) {
            students = await prisma.student.findMany({
                where: {
                    subjects: { some: { id: subjectId } },
                    year: year,
                    semester: semester,
                    isLeftCollege: false
                },
                orderBy: { rollNumber: "asc" }
            });

            if (students.length === 0) {
                students = await getStudentsForClass({
                    academicYearId,
                    year,
                    semester,
                    subjectId
                });
            }
        } else {
            students = await prisma.student.findMany({
                where: {
                    sectionId: sectionId!,
                    departmentId: finalDepartmentId || undefined,
                    year: year,
                    semester: semester,
                    isLeftCollege: false
                },
                orderBy: { rollNumber: "asc" }
            });

            if (students.length === 0) {
                students = await getStudentsForClass({
                    academicYearId,
                    departmentId: finalDepartmentId || undefined,
                    year,
                    semester,
                    sectionId: sectionId || undefined,
                    subjectId: subjectId || undefined
                });
            }
        }

        // Filter by Lab Batch if provided
        if (labBatchId) {
            students = students.filter((s: any) =>
                s.labBatchId === labBatchId ||
                (s.labBatches && Array.isArray(s.labBatches) && s.labBatches.some((b: any) => b.id === labBatchId))
            );
        }

        // Where clause for attendance history
        const whereClause: any = {
            year: year,
            semester: semester,
            type: "ACADEMIC",
            date: {
                gte: new Date(startDate),
                lte: new Date(endDate + "T23:59:59.999Z")
            }
        };

        if (subjectId) {
            whereClause.subjectId = subjectId;
        }

        if (!isOpenElective) {
            if (finalDepartmentId) whereClause.departmentId = finalDepartmentId;
            if (sectionId) whereClause.sectionId = sectionId;
            if (labBatchId) whereClause.labBatchId = labBatchId;
        }

        const historyRecords = await prisma.attendanceHistory.findMany({
            where: whereClause,
            include: {
                period: true,
                subject: { select: { id: true, name: true, code: true, shortName: true } }
            },
            orderBy: [
                { date: 'asc' },
                { periodId: 'asc' }
            ]
        });

        // Unique sessions grouping (excluding Lunch)
        const sessionMap = new Map<string, { id: string; dateStr: string; rawDate: Date; periodName: string }>();

        historyRecords.forEach(rec => {
            if (!rec.subjectId || !rec.subject) return; // Skip non-academic/SMS records with no subject

            const periodName = rec.period?.name?.toUpperCase() || "";
            if (periodName.includes("LUNCH")) return;

            const dateIso = new Date(rec.date).toISOString().split('T')[0];
            const periodLabel = rec.period?.name || `P${rec.periodId || ''}`;
            const subjCode = rec.subject?.shortName || rec.subject?.code || rec.subject?.name || "";
            const sessionKey = `${dateIso}_${rec.periodId || rec.period?.name || 'P'}_${rec.subjectId || 'S'}`;

            if (!sessionMap.has(sessionKey)) {
                const d = new Date(rec.date);
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                sessionMap.set(sessionKey, {
                    id: sessionKey,
                    dateStr: `${day}/${month}`,
                    rawDate: d,
                    periodName: (!subjectId && subjCode) ? `${periodLabel}\n(${subjCode})` : periodLabel
                });
            }
        });

        const sessions = Array.from(sessionMap.values()).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

        // Process student-wise statuses
        const yearNum = parseInt(year);
        const semNum = parseInt(semester);

        const studentRows = students.map((s: any) => {
            // Date of Joining Trimming logic
            const stType = String(s.studentType || "").toUpperCase();
            const isRegularYr1Sem1 = (yearNum === 1 && semNum === 1 && (!stType || stType === "REGULAR"));
            const isLateralYr2Sem1 = (yearNum === 2 && semNum === 1 && stType === "LATERAL");
            const shouldApplyDoj = isRegularYr1Sem1 || isLateralYr2Sem1;

            const studentReportingDate = s.dateOfReporting ? new Date(s.dateOfReporting) : null;
            if (studentReportingDate) {
                studentReportingDate.setHours(0, 0, 0, 0);
            }

            const attendanceMap: Record<string, string> = {};
            let totalClasses = 0;
            let presentCount = 0;
            let absentCount = 0;

            sessions.forEach(sess => {
                const sessDate = new Date(sess.rawDate);
                sessDate.setHours(0, 0, 0, 0);

                if (shouldApplyDoj && studentReportingDate && sessDate < studentReportingDate) {
                    attendanceMap[sess.id] = "-";
                    return;
                }

                const rec = historyRecords.find(h => {
                    const hDate = new Date(h.date).toISOString().split('T')[0];
                    const hKey = `${hDate}_${h.periodId || h.period?.name || 'P'}_${h.subjectId || 'S'}`;
                    return hKey === sess.id;
                });

                if (!rec) {
                    attendanceMap[sess.id] = "-";
                    return;
                }

                totalClasses += 1;

                let details: any[] = [];
                try { details = JSON.parse(rec.details || "[]"); } catch (e) { }

                const roll = String(s.rollNumber || "").toLowerCase();
                const detailMatch = details.find((d: any) => {
                    const r = String(d["Roll Number"] || d["rollNumber"] || d["roll"] || "").toLowerCase();
                    return r === roll;
                });

                let isPresent = false;
                if (detailMatch) {
                    const st = String(detailMatch["Status"] || detailMatch["status"] || "").toLowerCase();
                    if (st === "present" || st === "p") {
                        isPresent = true;
                    }
                } else if (rec.status === "Marked Absent") {
                    isPresent = true;
                }

                if (isPresent) {
                    attendanceMap[sess.id] = "P";
                    presentCount += 1;
                } else {
                    attendanceMap[sess.id] = "A";
                    absentCount += 1;
                }
            });

            const percentage = totalClasses > 0 ? ((presentCount / totalClasses) * 100).toFixed(2) : "0.00";

            return {
                id: s.id,
                rollNumber: s.rollNumber,
                name: s.name,
                attendanceMap,
                totalClasses,
                present: presentCount,
                absent: absentCount,
                percentage
            };
        });

        const subjectDepartment = targetSubject?.department ? { id: targetSubject.department.id, name: targetSubject.department.name, code: targetSubject.department.code } : null;
        return NextResponse.json({ sessions, students: studentRows, subjectDepartment });
    } catch (error: any) {
        console.error("Subject Register API Error:", error);
        return NextResponse.json({ error: "Failed to generate Subject Register Report." }, { status: 500 });
    }
}
