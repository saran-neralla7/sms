import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const userRole = (session.user.role || "").toUpperCase();
        if (!["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(userRole)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
        let departmentId = searchParams.get("departmentId");
        const year = searchParams.get("year");
        const semester = searchParams.get("semester");

        // HOD Restriction
        if (userRole === "HOD") {
            const dbUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { departmentId: true }
            });
            if (dbUser?.departmentId) {
                departmentId = dbUser.departmentId;
            }
        }

        // Date bounds
        const targetDate = new Date(dateStr);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

        // 1. Fetch Faculty-Subject Assignments
        const mappingWhere: any = {};
        if (departmentId) {
            mappingWhere.subject = {
                departmentId: departmentId
            };
        }
        if (year || semester) {
            mappingWhere.subject = {
                ...mappingWhere.subject,
                ...(year ? { year: String(year) } : {}),
                ...(semester ? { semester: String(semester) } : {})
            };
        }

        const facultyMappings = await prisma.facultySubjectMapping.findMany({
            where: mappingWhere,
            include: {
                faculty: {
                    select: {
                        id: true,
                        empName: true,
                        mobile: true,
                        user: { select: { id: true, username: true } },
                        department: { select: { code: true, name: true } }
                    }
                },
                subject: {
                    select: { id: true, name: true, code: true, year: true, semester: true, isElective: true, type: true }
                },
                section: {
                    select: { id: true, name: true }
                }
            }
        });

        // 2. Fetch AttendanceHistory records for the date
        const historyWhere: any = {
            date: {
                gte: startOfDay,
                lte: endOfDay
            }
        };
        if (departmentId) {
            historyWhere.departmentId = departmentId;
        }
        if (year) historyWhere.year = String(year);
        if (semester) historyWhere.semester = String(semester);

        const historyRecords = await prisma.attendanceHistory.findMany({
            where: historyWhere,
            include: {
                user: { select: { id: true, username: true } },
                period: { select: { name: true } },
                subject: { select: { id: true, name: true } },
                section: { select: { id: true, name: true } }
            }
        });

        // Build quick lookup for posted attendance: key = `userId_subjectId_sectionId` or `userId_subjectId`
        const postedMap = new Map<string, { date: Date, periods: string[] }>();

        for (const h of historyRecords) {
            const keyWithSec = `${h.downloadedBy}_${h.subjectId}_${h.sectionId}`;
            const keyNoSec = `${h.downloadedBy}_${h.subjectId}`;

            const periodName = h.period?.name || "Recorded";

            for (const key of [keyWithSec, keyNoSec]) {
                if (!postedMap.has(key)) {
                    postedMap.set(key, { date: h.date, periods: [periodName] });
                } else {
                    const existing = postedMap.get(key)!;
                    if (!existing.periods.includes(periodName)) {
                        existing.periods.push(periodName);
                    }
                }
            }
        }

        // 3. Evaluate each assigned mapping
        const postedList: any[] = [];
        const pendingList: any[] = [];
        const seenItems = new Set<string>();

        for (const m of facultyMappings) {
            const userId = m.faculty?.user?.id;
            const facultyName = m.faculty?.empName || m.faculty?.user?.username || "Unknown Faculty";
            const username = m.faculty?.user?.username || "N/A";
            const mobile = m.faculty?.mobile || "N/A";
            const deptCode = m.faculty?.department?.code || m.faculty?.department?.name || "Dept";
            const subjectName = m.subject?.name || "N/A";
            const subjectCode = m.subject?.code || "";
            const isElective = m.subject?.isElective || false;
            const secName = m.section?.name || (isElective ? "All Sections (Elective)" : "N/A");
            const yrSem = `Yr ${m.subject?.year || "-"} Sem ${m.subject?.semester || "-"}`;

            const itemKey = `${userId}_${m.subjectId}_${m.sectionId || "ALL"}`;
            if (seenItems.has(itemKey)) continue;
            seenItems.add(itemKey);

            const lookupKeyWithSec = `${userId}_${m.subjectId}_${m.sectionId}`;
            const lookupKeyNoSec = `${userId}_${m.subjectId}`;

            const recordInfo = postedMap.get(lookupKeyWithSec) || postedMap.get(lookupKeyNoSec);

            if (recordInfo) {
                postedList.push({
                    facultyName,
                    username,
                    deptCode,
                    subjectName,
                    subjectCode,
                    sectionName: secName,
                    yrSem,
                    periods: recordInfo.periods.join(", "),
                    status: "Posted"
                });
            } else {
                pendingList.push({
                    facultyName,
                    username,
                    mobile,
                    deptCode,
                    subjectName,
                    subjectCode,
                    sectionName: secName,
                    yrSem,
                    status: "Pending"
                });
            }
        }

        const totalAssigned = postedList.length + pendingList.length;
        const completionRate = totalAssigned > 0 ? ((postedList.length / totalAssigned) * 100).toFixed(1) + "%" : "0%";

        return NextResponse.json({
            date: dateStr,
            summary: {
                totalAssigned,
                postedCount: postedList.length,
                pendingCount: pendingList.length,
                completionRate
            },
            postedList,
            pendingList
        });
    } catch (error) {
        console.error("Error in faculty posting status report:", error);
        return NextResponse.json({ error: "Failed to generate posting status report" }, { status: 500 });
    }
}
