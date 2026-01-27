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
            students // Array of { rollNumber, name, mobile, status, ... }
        } = body;

        // Validation
        if (!date || !year || !semester || !sectionId || !departmentId || !periodId || !students) {
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

        // Save to Database
        const record = await prisma.attendanceHistory.create({
            data: {
                date: new Date(date), // Should include time? Or just date? API usually sends date string.
                year,
                semester,
                sectionId,
                departmentId,
                periodId,
                subjectId: subjectId || null,
                status: "Completed",
                fileName: "Manual Entry",
                downloadedBy: (session.user as any).id,
                details
            }
        });

        return NextResponse.json({ success: true, id: record.id });

    } catch (error) {
        console.error("Attendance Submission Error:", error);
        return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
    }
}
