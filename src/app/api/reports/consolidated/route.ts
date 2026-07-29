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
    const reportType = searchParams.get("reportType") || "standard"; // "standard" | "scholarship" | "monthly"
    const targetWorkingDaysParam = searchParams.get("targetWorkingDays");

    // Fetch user details from DB to enforce permissions
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { department: true }
    });

    if (!user) {
        return NextResponse.json({ error: "User profile not found." }, { status: 403 });
    }

    const userRole = (user.role || "").toUpperCase();
    const userDeptCode = user.department?.code || "";
    const userDeptId = user.departmentId;
    const userFacultyId = user.facultyId;

    const isGlobal = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole) || userDeptCode === "BSH";
    let finalDepartmentId: string | null | undefined = departmentId;

    const mbaDept = await prisma.department.findFirst({
        where: { code: "MBA" }
    });

    if (mbaDept && (departmentId === mbaDept.id || finalDepartmentId === mbaDept.id)) {
        if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole) && userDeptId !== mbaDept.id) {
            return NextResponse.json({ error: "Access Denied: You are not authorized to view reports for the MBA department." }, { status: 403 });
        }
    }

    if (!isGlobal) {
        if (userRole === "HOD") {
            finalDepartmentId = userDeptId || undefined;
        } else if (userRole === "FACULTY") {
            let isAllowed = false;
            if (userFacultyId) {
                const mappingWhere: any = { facultyId: userFacultyId };
                if (sectionId) mappingWhere.sectionId = sectionId;
                if (subjectId) mappingWhere.subjectId = subjectId;

                const mappingCount = await prisma.facultySubjectMapping.count({
                    where: mappingWhere
                });
                if (mappingCount > 0) {
                    isAllowed = true;
                }
            }

            if (!isAllowed) {
                return NextResponse.json({ error: "Access Denied: You are not authorized to view reports for this section/subject." }, { status: 403 });
            }
            finalDepartmentId = departmentId || userDeptId || undefined;
        } else {
            finalDepartmentId = userDeptId || undefined;
        }
    }

    let isElective = false;

    try {
        if (subjectId) {
            const subjectInfo = await prisma.subject.findUnique({
                where: { id: subjectId },
                select: { isElective: true, type: true }
            });
            if (subjectInfo && (subjectInfo.isElective || (subjectInfo.type && subjectInfo.type.toUpperCase().includes("ELECTIVE")))) {
                isElective = true;
            }
        }
    } catch (e) {
        console.error("Error fetching subject info:", e);
    }

    const isValidationOk = year && semester && startDate && endDate && (isElective || sectionId);
    if (!isValidationOk) {
        return NextResponse.json({ error: "Missing required filters" }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59);

        const historyWhere: any = {
            year,
            semester,
            date: {
                gte: start,
                lte: end
            },
            type: "ACADEMIC"
        };

        if (isElective && subjectId) {
            historyWhere.subjectId = subjectId;
        } else {
            historyWhere.sectionId = sectionId;
            historyWhere.departmentId = finalDepartmentId || undefined;
            if (subjectId) {
                historyWhere.subjectId = subjectId;
            }
        }

        const rawHistory = await prisma.attendanceHistory.findMany({
            where: historyWhere,
            select: {
                id: true,
                details: true,
                date: true,
                status: true,
                academicYearId: true,
                period: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { date: "asc" }
        });

        // Filter out Lunch Hour periods
        const history = rawHistory.filter(rec => {
            const periodName = rec.period?.name?.toUpperCase() || "";
            return !periodName.includes("LUNCH");
        });

        // Resolve target academic year
        const academicYearId = history[0]?.academicYearId || (await prisma.academicYear.findFirst({
            where: {
                startDate: { lte: start },
                endDate: { gte: start }
            }
        }))?.id || (await prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;

        if (!academicYearId) {
            return NextResponse.json({ error: "Academic Year not found" }, { status: 400 });
        }

        let classStudents = await getStudentsForClass({
            academicYearId,
            departmentId: isElective ? undefined : (finalDepartmentId || undefined),
            year,
            semester,
            sectionId: (isElective ? undefined : sectionId) || undefined,
            subjectId: subjectId || undefined
        });

        if (labBatchId) {
            classStudents = classStudents.filter(s => s.labBatchId === labBatchId);
        }

        // --- MODE 1: GOVT SCHOLARSHIP DAY-WISE MAJORITY RULE REPORT ---
        if (reportType === "scholarship") {
            const dateRecordsMap: Record<string, typeof history> = {};
            history.forEach(rec => {
                const dateStr = new Date(rec.date).toISOString().split("T")[0];
                if (!dateRecordsMap[dateStr]) dateRecordsMap[dateStr] = [];
                dateRecordsMap[dateStr].push(rec);
            });

            const targetDays = targetWorkingDaysParam ? parseInt(targetWorkingDaysParam, 10) : 0;

            const scholarshipReport = classStudents.map(s => {
                const isEligibleForTrim = (
                    (year === "1" && semester === "1" && !s.isLateralEntry) ||
                    (year === "2" && semester === "1" && s.isLateralEntry === true)
                );
                const repDate = (isEligibleForTrim && s.dateOfReporting) ? new Date(s.dateOfReporting) : null;
                if (repDate) repDate.setHours(0, 0, 0, 0);

                let presentDays = 0;
                let absentDays = 0;
                let totalWorkingDays = 0;

                Object.entries(dateRecordsMap).forEach(([dateStr, recsOnDay]) => {
                    const recDate = new Date(dateStr);
                    recDate.setHours(0, 0, 0, 0);

                    if (repDate && recDate < repDate) {
                        return; // Exclude days prior to reporting date
                    }

                    totalWorkingDays += 1;
                    const periodsConducted = recsOnDay.length;
                    let periodsPresent = 0;

                    recsOnDay.forEach(rec => {
                        let details: any[] = [];
                        try { details = JSON.parse(rec.details); } catch (e) { }
                        const roll = s.rollNumber.toLowerCase();
                        const detailMatch = details.find((d: any) => {
                            const r = (d["Roll Number"] || d["rollNumber"] || "").toString().toLowerCase();
                            return r === roll;
                        });

                        if (detailMatch) {
                            const status = detailMatch["Status"] || detailMatch["status"];
                            if (status === "Present" || status === "present") periodsPresent += 1;
                        } else if (rec.status === "Marked Absent") {
                            periodsPresent += 1;
                        }
                    });

                    // Majority Rule: present if present for >= half of non-lunch periods conducted on that day
                    if (periodsConducted > 0 && periodsPresent >= Math.ceil(periodsConducted / 2)) {
                        presentDays += 1;
                    } else {
                        absentDays += 1;
                    }
                });

                const effectiveTotalDays = (targetDays && targetDays > 0) ? targetDays : totalWorkingDays;
                const percentage = effectiveTotalDays > 0 ? ((presentDays / effectiveTotalDays) * 100).toFixed(2) : "0.00";

                return {
                    id: s.id,
                    rollNumber: s.rollNumber,
                    name: s.name,
                    scholarshipId: (s as any).scholarshipId || null,
                    reimbursement: s.reimbursement,
                    totalDays: effectiveTotalDays,
                    presentDays,
                    absentDays: Math.max(0, effectiveTotalDays - presentDays),
                    percentage
                };
            }).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

            return NextResponse.json(scholarshipReport);
        }

        // --- MODE 2: PROGRESSIVE MONTHLY REPORT ---
        if (reportType === "monthly") {
            const monthsMap: Record<string, Date> = {}; // "YYYY-MM" -> Max Date in Month
            history.forEach(rec => {
                const recDate = new Date(rec.date);
                const monthKey = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthsMap[monthKey] || recDate > monthsMap[monthKey]) {
                    monthsMap[monthKey] = recDate;
                }
            });

            const sortedMonthKeys = Object.keys(monthsMap).sort();

            const monthlyReport = classStudents.map(s => {
                const isEligibleForTrim = (
                    (year === "1" && semester === "1" && !s.isLateralEntry) ||
                    (year === "2" && semester === "1" && s.isLateralEntry === true)
                );
                const repDate = (isEligibleForTrim && s.dateOfReporting) ? new Date(s.dateOfReporting) : null;
                if (repDate) repDate.setHours(0, 0, 0, 0);

                const monthlyStats = sortedMonthKeys.map(mKey => {
                    const cutoffDate = new Date(monthsMap[mKey]);
                    cutoffDate.setHours(23, 59, 59);

                    const historyUpToCutoff = history.filter(r => new Date(r.date) <= cutoffDate);

                    let totalClasses = 0;
                    let present = 0;
                    let absent = 0;

                    historyUpToCutoff.forEach(rec => {
                        const recDate = new Date(rec.date);
                        recDate.setHours(0, 0, 0, 0);

                        if (repDate && recDate < repDate) return;

                        if (labBatchId) {
                            try {
                                const details = JSON.parse(rec.details);
                                const firstDetail = details[0];
                                const recordLabBatchId = firstDetail ? (firstDetail["Lab Batch ID"] || firstDetail["labBatchId"]) : null;
                                if (recordLabBatchId && recordLabBatchId !== labBatchId) return;
                            } catch (e) { }
                        }

                        totalClasses += 1;

                        let details: any[] = [];
                        try { details = JSON.parse(rec.details); } catch (e) { }
                        const roll = s.rollNumber.toLowerCase();
                        const recordStatusMap = new Map<string, string>();
                        details.forEach((d: any) => {
                            const rollRaw = d["Roll Number"] || d["rollNumber"];
                            if (rollRaw) {
                                const r = String(rollRaw).toLowerCase();
                                const st = d["Status"] || d["status"];
                                recordStatusMap.set(r, st);
                            }
                        });

                        if (recordStatusMap.has(roll)) {
                            const st = recordStatusMap.get(roll);
                            if (st === "Present" || st === "present") present += 1;
                            else absent += 1;
                        } else {
                            if (rec.status === "Marked Absent") present += 1;
                            else totalClasses -= 1;
                        }
                    });

                    const monthDateObj = new Date(`${mKey}-01`);
                    const monthLabel = monthDateObj.toLocaleString('en-US', { month: 'short' });

                    return {
                        monthKey: mKey,
                        monthLabel: `Up to ${monthLabel}`,
                        totalClasses,
                        present,
                        absent,
                        percentage: totalClasses > 0 ? ((present / totalClasses) * 100).toFixed(2) : "0.00"
                    };
                });

                return {
                    id: s.id,
                    rollNumber: s.rollNumber,
                    name: s.name,
                    dateOfReporting: s.dateOfReporting,
                    scholarshipId: (s as any).scholarshipId || null,
                    monthlyStats
                };
            }).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

            return NextResponse.json(monthlyReport);
        }

        // --- MODE 4: CONSOLIDATED SUBJECT-WISE SUMMARY REPORT ---
        if (reportType === "subject_summary") {
            const officialSubjects = await prisma.subject.findMany({
                where: {
                    ...(finalDepartmentId ? { departmentId: finalDepartmentId } : {}),
                    year,
                    semester
                },
                include: {
                    electiveSlotRelation: true
                }
            });

            const historyWithSubjects = await prisma.attendanceHistory.findMany({
                where: historyWhere,
                include: {
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            shortName: true,
                            code: true,
                            year: true,
                            semester: true,
                            isElective: true,
                            electiveSlotId: true,
                            electiveSlotRelation: { select: { id: true, name: true } }
                        }
                    },
                    period: { select: { id: true, name: true } }
                },
                orderBy: { date: "asc" }
            });

            const validHistory = historyWithSubjects.filter(rec => {
                const periodName = rec.period?.name?.toUpperCase() || "";
                return !periodName.includes("LUNCH");
            });

            // Detect Open Elective subjects strictly:
            // 1. Subject belongs to an elective slot whose name contains "OE" or "OPEN"
            // 2. Subject name explicitly contains "OPEN ELECTIVE"
            // 3. Subject is marked isElective AND belongs to an OE slot
            // NOTE: "Elective - I" (Professional Elective) must NOT be classified as OE
            function isOpenElective(sub: any) {
                if (!sub) return false;
                const slotName = (sub.electiveSlotRelation?.name || "").toUpperCase();
                if (slotName.includes("OE") || slotName.includes("OPEN")) {
                    return true;
                }
                const nameUpper = (sub.name || "").toUpperCase();
                if (nameUpper.includes("OPEN ELECTIVE")) {
                    return true;
                }
                // isElective flag + has an elective slot that is OE-type
                if (sub.isElective && sub.electiveSlotId) {
                    return true;
                }
                return false;
            }

            const regularSubjects: any[] = [];
            const oeSubjects: any[] = [];

            officialSubjects.forEach(sub => {
                if (isOpenElective(sub)) {
                    oeSubjects.push(sub);
                } else {
                    regularSubjects.push(sub);
                }
            });

            // Determine OE slot label from the subjects
            let oeSlotLabel = "OE";
            const slotFromSub = oeSubjects.find(s => s.electiveSlotRelation?.name)?.electiveSlotRelation?.name;
            if (slotFromSub) {
                oeSlotLabel = slotFromSub;
            }

            const OE_COL_ID = "OE_GROUP_COLUMN";
            const subjectMap = new Map<string, { id: string; name: string; shortName: string; code: string; totalHeld: number; isOE: boolean }>();

            regularSubjects.forEach(sub => {
                subjectMap.set(sub.id, {
                    id: sub.id,
                    name: sub.name,
                    shortName: sub.shortName || sub.code || sub.name,
                    code: sub.code || "",
                    totalHeld: 0,
                    isOE: false
                });
            });

            // Register single Open Elective grouped column
            if (oeSubjects.length > 0) {
                subjectMap.set(OE_COL_ID, {
                    id: OE_COL_ID,
                    name: `Open Elective (${oeSlotLabel})`,
                    shortName: oeSlotLabel,
                    code: oeSlotLabel,
                    totalHeld: 0,
                    isOE: true
                });
            }

            // Count totalHeld for regular subjects from history
            validHistory.forEach(rec => {
                const subj = rec.subject;
                if (!subj) return;

                const isRecOE = isOpenElective(subj);

                if (isRecOE) {
                    // OE totalHeld is counted per-student later, not globally
                } else if (subj.year === year && subj.semester === semester) {
                    if (subjectMap.has(subj.id)) {
                        subjectMap.get(subj.id)!.totalHeld += 1;
                    }
                }
            });

            // Fetch students with their elective subject mappings
            const targetStudents = await prisma.student.findMany({
                where: {
                    ...(finalDepartmentId ? { departmentId: finalDepartmentId } : {}),
                    year,
                    semester,
                    ...(sectionId && !isElective ? { sectionId } : {}),
                    isLeftCollege: false,
                    isDetained: false
                },
                select: {
                    id: true,
                    rollNumber: true,
                    name: true,
                    dateOfReporting: true,
                    isLateralEntry: true,
                    subjects: {
                        where: { electiveSlotId: { not: null } },
                        select: { id: true, electiveSlotId: true }
                    }
                },
                orderBy: { rollNumber: "asc" }
            });

            const activeStudents = targetStudents.length > 0 ? targetStudents : classStudents;

            // Collect all OE subject IDs from the elective slots
            const oeSubjectIds = new Set(oeSubjects.map(s => s.id));

            // Also collect OE slot IDs
            const oeSlotIds = new Set<string>();
            oeSubjects.forEach(s => {
                if (s.electiveSlotId) oeSlotIds.add(s.electiveSlotId);
                if (s.electiveSlotRelation?.id) oeSlotIds.add(s.electiveSlotRelation.id);
            });

            // For OE: count how many OE history records each student appears in
            // First, collect all OE history records
            const oeHistoryRecords = validHistory.filter(rec => {
                const subj = rec.subject;
                return subj && isOpenElective(subj);
            });

            // Build per-student OE totalHeld count (count only records where student appears in details)
            const studentOeHeld: Record<string, number> = {};
            const studentOePresent: Record<string, number> = {};

            oeHistoryRecords.forEach(rec => {
                let details: any[] = [];
                try { details = JSON.parse(rec.details); } catch (e) { }

                details.forEach((d: any) => {
                    const rollRaw = d["Roll Number"] || d["rollNumber"];
                    if (!rollRaw) return;
                    const roll = String(rollRaw).toLowerCase();
                    const status = d["Status"] || d["status"];

                    if (!studentOeHeld[roll]) studentOeHeld[roll] = 0;
                    if (!studentOePresent[roll]) studentOePresent[roll] = 0;

                    studentOeHeld[roll] += 1;
                    if (status === "Present" || status === "present") {
                        studentOePresent[roll] += 1;
                    }
                });
            });

            // Build subject list - set OE totalHeld to max across students (or from history)
            const maxOeHeld = Object.values(studentOeHeld).length > 0
                ? Math.max(...Object.values(studentOeHeld))
                : 0;
            if (subjectMap.has(OE_COL_ID)) {
                subjectMap.get(OE_COL_ID)!.totalHeld = maxOeHeld;
            }

            // Remove OE column if 0 held classes and no OE subjects
            if (subjectMap.has(OE_COL_ID) && subjectMap.get(OE_COL_ID)!.totalHeld === 0 && oeSubjects.length === 0) {
                subjectMap.delete(OE_COL_ID);
            }

            const subjectList = Array.from(subjectMap.values());

            const studentStatsMap: Record<string, {
                id: string;
                rollNumber: string;
                name: string;
                subjectStats: Record<string, { present: number; totalHeld: number }>;
                totalClasses: number;
                totalPresent: number;
                totalAbsent: number;
                percentage: string;
            }> = {};

            activeStudents.forEach(s => {
                const roll = s.rollNumber.toLowerCase();
                const subStats: Record<string, { present: number; totalHeld: number }> = {};

                subjectList.forEach(sub => {
                    if (sub.isOE) {
                        // Per-student OE totalHeld
                        subStats[sub.id] = { present: studentOePresent[roll] || 0, totalHeld: studentOeHeld[roll] || 0 };
                    } else {
                        subStats[sub.id] = { present: 0, totalHeld: sub.totalHeld };
                    }
                });

                studentStatsMap[roll] = {
                    id: s.id,
                    rollNumber: s.rollNumber,
                    name: s.name,
                    subjectStats: subStats,
                    totalClasses: 0,
                    totalPresent: 0,
                    totalAbsent: 0,
                    percentage: "0.00"
                };
            });

            // Process regular (non-OE) history records for attendance
            validHistory.forEach(rec => {
                const subj = rec.subject;
                if (!subj) return;

                // Skip OE records - already handled above
                if (isOpenElective(subj)) return;

                if (!subjectMap.has(subj.id)) return;

                let details: any[] = [];
                try { details = JSON.parse(rec.details); } catch (e) { }

                const recordStatusMap = new Map<string, string>();
                details.forEach((s: any) => {
                    const rollRaw = s["Roll Number"] || s["rollNumber"];
                    if (rollRaw) {
                        const roll = String(rollRaw).toLowerCase();
                        const status = s["Status"] || s["status"];
                        recordStatusMap.set(roll, status);
                    }
                });

                const recordDate = new Date(rec.date);
                recordDate.setHours(0, 0, 0, 0);

                activeStudents.forEach(studentObj => {
                    const roll = studentObj.rollNumber.toLowerCase();
                    const stat = studentStatsMap[roll];
                    if (!stat) return;

                    const isEligibleForTrim = (
                        (year === "1" && semester === "1" && !studentObj.isLateralEntry) ||
                        (year === "2" && semester === "1" && studentObj.isLateralEntry === true)
                    );
                    const repDate = (isEligibleForTrim && studentObj.dateOfReporting) ? new Date(studentObj.dateOfReporting) : null;
                    if (repDate) repDate.setHours(0, 0, 0, 0);

                    if (repDate && recordDate < repDate) return;

                    if (recordStatusMap.has(roll)) {
                        const status = recordStatusMap.get(roll);
                        if (status === "Present" || status === "present") {
                            if (stat.subjectStats[subj.id]) {
                                stat.subjectStats[subj.id].present += 1;
                            }
                            stat.totalPresent += 1;
                        } else {
                            stat.totalAbsent += 1;
                        }
                    }
                });
            });

            // Add OE present counts to totalPresent
            activeStudents.forEach(s => {
                const roll = s.rollNumber.toLowerCase();
                const stat = studentStatsMap[roll];
                if (!stat) return;
                stat.totalPresent += (studentOePresent[roll] || 0);
            });

            const studentReports = Object.values(studentStatsMap).map(stat => {
                // Per-student total: sum of regular totalHeld + their specific OE totalHeld
                let totalClasses = 0;
                Object.values(stat.subjectStats).forEach(ss => {
                    totalClasses += ss.totalHeld;
                });

                const percentage = totalClasses > 0
                    ? ((stat.totalPresent / totalClasses) * 100).toFixed(2)
                    : "0.00";

                return {
                    ...stat,
                    totalClasses,
                    percentage
                };
            }).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

            return NextResponse.json({
                subjects: subjectList,
                students: studentReports
            });
        }

        // --- MODE 3: STANDARD PERIOD-WISE CONSOLIDATED REPORT ---
        const studentStats: Record<string, {
            id: string,
            name: string,
            rollNumber: string,
            totalClasses: number,
            present: number,
            absent: number,
            dateOfReporting?: Date | null,
            scholarshipId?: string | null
        }> = {};

        classStudents.forEach(s => {
            studentStats[s.rollNumber.toLowerCase()] = {
                id: s.id,
                name: s.name,
                rollNumber: s.rollNumber,
                totalClasses: 0,
                present: 0,
                absent: 0,
                dateOfReporting: s.dateOfReporting,
                scholarshipId: (s as any).scholarshipId || null
            };
        });

        history.forEach((record) => {
            try {
                const details = JSON.parse(record.details);

                if (labBatchId) {
                    const firstDetail = details[0];
                    const recordLabBatchId = firstDetail ? (firstDetail["Lab Batch ID"] || firstDetail["labBatchId"]) : null;
                    if (recordLabBatchId && recordLabBatchId !== labBatchId) {
                        return;
                    }
                }

                const recordStatusMap = new Map<string, string>();
                details.forEach((s: any) => {
                    const rollRaw = s["Roll Number"] || s["rollNumber"];
                    if (rollRaw) {
                        const roll = String(rollRaw).toLowerCase();
                        const status = s["Status"] || s["status"];
                        recordStatusMap.set(roll, status);
                    }
                });

                const recordDate = new Date(record.date);
                recordDate.setHours(0, 0, 0, 0);

                classStudents.forEach((studentObj) => {
                    const roll = studentObj.rollNumber.toLowerCase();
                    const stat = studentStats[roll];
                    if (!stat) return;

                    // Date of joining trimming check
                    const isEligibleForTrim = (
                        (year === "1" && semester === "1" && !studentObj.isLateralEntry) ||
                        (year === "2" && semester === "1" && studentObj.isLateralEntry === true)
                    );
                    const repDate = (isEligibleForTrim && studentObj.dateOfReporting) ? new Date(studentObj.dateOfReporting) : null;
                    if (repDate) repDate.setHours(0, 0, 0, 0);

                    if (repDate && recordDate < repDate) {
                        return; // Exclude class before student reporting date
                    }

                    stat.totalClasses += 1;

                    if (recordStatusMap.has(roll)) {
                        const status = recordStatusMap.get(roll);
                        if (status === "Present" || status === "present") {
                            stat.present += 1;
                        } else {
                            stat.absent += 1;
                        }
                    } else {
                        if (record.status === "Marked Absent") {
                            stat.present += 1;
                        } else {
                            stat.totalClasses -= 1;
                        }
                    }
                });

            } catch (e) {
                console.error("Error parsing details for record", record);
            }
        });

        const report = Object.values(studentStats).map(stat => ({
            ...stat,
            percentage: stat.totalClasses > 0
                ? ((stat.present / stat.totalClasses) * 100).toFixed(2)
                : "0.00"
        })).sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

        return NextResponse.json(report);

    } catch (error) {
        console.error("Consolidated report error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
