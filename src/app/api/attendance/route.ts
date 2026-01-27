import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            date,
            year,
            semester,
            sectionId,
            departmentId,
            subjectId,
            periodId,
            periodIds, // Added support for multiple periods
            students // Array of { rollNumber, name, mobile, status, ... }
        } = body;

        // Validation - Date, Year, Sem, Section, Dept, Students are mandatory.
        // Needs EITHER periodId OR periodIds
        if (!date || !year || !semester || !sectionId || !departmentId || (!periodId && (!periodIds || periodIds.length === 0)) || !students) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Department Enforcement for non-admins
        const userRole = (session.user as any).role;
        const userDeptId = (session.user as any).departmentId;

        if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole)) {
            if (userDeptId && userDeptId !== departmentId) {
                return NextResponse.json({ error: "You can only submit attendance for your own department" }, { status: 403 });
            }
        }

        // Normalize periods to array
        const finalPeriodIds: string[] = periodIds && periodIds.length > 0
            ? periodIds
            : [periodId];

        // Format Details JSON
        const details = JSON.stringify(students.map((s: any) => ({
            "Roll Number": s.rollNumber,
            "Name": s.name,
            "Status": s.status, // "Present" or "Absent"
            "Mobile": s.mobile
        })));

        // Determine Overall Status
        const status = "Marked Present"; // or calculate based on absentees? Usually just a label.
        // Let's use "Marked" or stick to what history page shows.
        // History page checks for "Marked Absent" color.

        // Save to Database (Transaction to ensure all or nothing)
        const records = await prisma.$transaction(
            finalPeriodIds.map(pid =>
                prisma.attendanceHistory.create({
                    data: {
                        date: new Date(date),
                        year,
                        semester,
                        sectionId,
                        departmentId,
                        periodId: pid,
                        subjectId: subjectId || null,
                        status: "Completed",
                        fileName: "Manual Entry",
                        downloadedBy: (session.user as any).id,
                        details
                    }
                })
            )
        );

        return NextResponse.json({ success: true, count: records.length });

    } catch (error) {
        console.error("Attendance Submission Error:", error);
        return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
    }
}
