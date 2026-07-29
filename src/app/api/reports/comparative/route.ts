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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { department: true }
    });

    if (!user) {
        return NextResponse.json({ error: "User profile not found." }, { status: 403 });
    }

    const userRole = (user.role || "").toUpperCase();
    const isAuthorized = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(userRole);
    if (!isAuthorized) {
        return NextResponse.json({ error: "Access Denied: Admin, Director, Principal or HOD access required." }, { status: 403 });
    }

    if (!departmentId || !year || !semester || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing required filter parameters." }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Fetch all sections in department
        const deptSections = await prisma.section.findMany({
            where: {
                departments: {
                    some: { id: departmentId }
                }
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" }
        });

        const comparativeSections: any[] = [];

        for (const sec of deptSections) {
            const rawStudents = await prisma.student.findMany({
                where: {
                    departmentId,
                    year,
                    semester,
                    sectionId: sec.id,
                    isLeftCollege: false,
                    isDetained: false
                },
                select: { id: true, rollNumber: true, name: true }
            });
            if (rawStudents.length === 0) continue;

            const rawHistoryRecords = await prisma.attendanceHistory.findMany({
                where: {
                    departmentId,
                    year,
                    semester,
                    sectionId: sec.id,
                    date: { gte: start, lte: end },
                    type: "ACADEMIC"
                },
                select: { details: true, period: { select: { name: true } } }
            });

            // Filter out Lunch Hour periods
            const historyRecords = rawHistoryRecords.filter(rec => {
                const periodName = rec.period?.name?.toUpperCase() || "";
                return !periodName.includes("LUNCH");
            });

            const totalHeldClasses = historyRecords.length;
            const studentStats: Record<string, number> = {};
            rawStudents.forEach(s => { studentStats[s.rollNumber.toLowerCase()] = 0; });

            historyRecords.forEach(rec => {
                let details: any[] = [];
                try {
                    details = typeof rec.details === "string" ? JSON.parse(rec.details) : rec.details;
                } catch (e) {
                    details = [];
                }

                if (Array.isArray(details)) {
                    details.forEach((d: any) => {
                        const rollRaw = d["Roll Number"] || d["rollNumber"];
                        if (!rollRaw) return;
                        const roll = String(rollRaw).toLowerCase();
                        if (studentStats[roll] === undefined) return;

                        const status = d["Status"] || d["status"];
                        const isPresent = status === "Present" || status === "present" || status === "P" || d.isPresent === true;
                        if (isPresent) studentStats[roll] += 1;
                    });
                }
            });

            let highCount = 0;
            let condonationCount = 0;
            let detentionCount = 0;
            let totalPctSum = 0;

            rawStudents.forEach(s => {
                const roll = s.rollNumber.toLowerCase();
                const present = studentStats[roll] || 0;
                const total = totalHeldClasses > 0 ? totalHeldClasses : 1;
                const pct = (present / total) * 100;
                totalPctSum += pct;

                if (pct >= 75) highCount++;
                else if (pct >= 65) condonationCount++;
                else detentionCount++;
            });

            const avgPct = rawStudents.length > 0 ? parseFloat((totalPctSum / rawStudents.length).toFixed(2)) : 0;

            comparativeSections.push({
                sectionId: sec.id,
                sectionName: sec.name,
                totalStudents: rawStudents.length,
                totalClassesHeld: totalHeldClasses,
                averagePercentage: avgPct,
                highAttendanceCount: highCount,
                condonationCount: condonationCount,
                detentionCount: detentionCount
            });
        }

        return NextResponse.json({
            departmentId,
            year,
            semester,
            sections: comparativeSections
        });
    } catch (e: any) {
        console.error("Comparative Report Error:", e);
        return NextResponse.json({ error: "Failed to generate Comparative Report: " + e.message }, { status: 500 });
    }
}
