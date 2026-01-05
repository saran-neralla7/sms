import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    if (!year || !semester || !sectionId || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing required filters" }, { status: 400 });
    }

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59); // Include the entire end date

        // 1. Fetch History Records for the range
        const history = await prisma.attendanceHistory.findMany({
            where: {
                year,
                semester,
                sectionId,
                departmentId: departmentId || undefined,
                date: {
                    gte: start,
                    lte: end
                }
            },
            select: {
                details: true,
                date: true
            }
        });

        // 2. Aggregate Data
        const studentStats: Record<string, {
            name: string,
            rollNumber: string,
            totalClasses: number,
            present: number,
            absent: number
        }> = {};

        // If no classes happened, we might still want to list students? 
        // For now, let's build from history to ensure we only count students who were actually part of the class.
        // Alternatively, fetch all students in section to show 0/0 for those never marked? 
        // Let's stick to history first for accuracy of "what happened". 
        // Actually, better to fetch current students to ensure everyone is listed.

        const students = await prisma.student.findMany({
            where: {
                year,
                semester,
                sectionId,
                departmentId: departmentId || undefined
            },
            select: { rollNumber: true, name: true }
        });

        // Initialize everyone with 0
        students.forEach(s => {
            studentStats[s.rollNumber] = {
                name: s.name,
                rollNumber: s.rollNumber,
                totalClasses: 0,
                present: 0,
                absent: 0
            };
        });

        history.forEach(record => {
            try {
                const details = JSON.parse(record.details);
                // "details" is an array of students with "Status": "Present" | "Absent"
                // We increment totalClasses for *everyone in the class* (or everyone in the record)
                // If a student is in the record, they were part of that class.

                details.forEach((s: any) => {
                    const roll = s["Roll Number"];
                    // If student exists in our master list (or new one encountered in history)
                    if (!studentStats[roll]) {
                        studentStats[roll] = {
                            name: s["Name"],
                            rollNumber: roll,
                            totalClasses: 0,
                            present: 0,
                            absent: 0
                        };
                    }

                    studentStats[roll].totalClasses += 1;
                    if (s["Status"] === "Present") {
                        studentStats[roll].present += 1;
                    } else {
                        studentStats[roll].absent += 1;
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
