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
    const thresholdParam = searchParams.get("threshold") || "75"; // default 75%
    const threshold = parseFloat(thresholdParam);

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

    if (!departmentId || !year || !semester || !sectionId || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing required filter parameters." }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Fetch students in section
        const rawStudents = await prisma.student.findMany({
            where: {
                departmentId,
                year,
                semester,
                sectionId,
                isLeftCollege: false,
                isDetained: false
            },
            select: { id: true, rollNumber: true, name: true, mobile: true, studentContactNumber: true, fatherName: true, motherName: true, address: true }
        });

        // Fetch attendance history for the section and date range
        const rawHistoryRecords = await prisma.attendanceHistory.findMany({
            where: {
                departmentId,
                year,
                semester,
                sectionId,
                date: { gte: start, lte: end },
                type: "ACADEMIC"
            },
            select: {
                id: true,
                details: true,
                period: { select: { name: true } }
            }
        });

        // Filter out Lunch Hour periods
        const historyRecords = rawHistoryRecords.filter(rec => {
            const periodName = rec.period?.name?.toUpperCase() || "";
            return !periodName.includes("LUNCH");
        });

        const totalHeldClasses = historyRecords.length;

        // Calculate present counts per student using roll number matching
        const studentStats: Record<string, { present: number; absent: number }> = {};
        rawStudents.forEach(s => {
            studentStats[s.rollNumber.toLowerCase()] = { present: 0, absent: 0 };
        });

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
                    if (!studentStats[roll]) return;

                    const status = d["Status"] || d["status"];
                    const isPresent = status === "Present" || status === "present" || status === "P" || d.isPresent === true;
                    if (isPresent) {
                        studentStats[roll].present += 1;
                    } else {
                        studentStats[roll].absent += 1;
                    }
                });
            }
        });

        const defaulterStudents = rawStudents.map(s => {
            const roll = s.rollNumber.toLowerCase();
            const stats = studentStats[roll] || { present: 0, absent: 0 };
            const total = totalHeldClasses > 0 ? totalHeldClasses : (stats.present + stats.absent);
            const pct = total > 0 ? parseFloat(((stats.present / total) * 100).toFixed(2)) : 0;
            const shortagePct = parseFloat((100 - pct).toFixed(2));
            const statusLabel = pct < 65 ? "Detention Risk" : (pct < 75 ? "Condonation Eligible" : "Satisfactory");

            return {
                id: s.id,
                rollNumber: s.rollNumber,
                name: s.name,
                mobile: s.mobile || s.studentContactNumber || "N/A",
                parentName: s.fatherName || s.motherName || "Guardian",
                address: s.address || null,
                totalClasses: total,
                present: stats.present,
                absent: total - stats.present,
                percentage: pct,
                shortagePercentage: shortagePct,
                statusLabel
            };
        }).filter(s => s.percentage < threshold)
          .sort((a, b) => a.percentage - b.percentage);

        return NextResponse.json({
            totalHeld: totalHeldClasses,
            totalStudents: rawStudents.length,
            defaulterCount: defaulterStudents.length,
            students: defaulterStudents
        });
    } catch (e: any) {
        console.error("Defaulter Report Error:", e);
        return NextResponse.json({ error: "Failed to generate Defaulter Report: " + e.message }, { status: 500 });
    }
}
