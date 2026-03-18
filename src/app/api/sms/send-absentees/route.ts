import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendAbsenteeSMS } from "@/lib/sms";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (!["SMS_USER", "ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        const { historyId } = await request.json();

        if (!historyId) {
            return NextResponse.json({ error: "Missing historyId" }, { status: 400 });
        }

        // Fetch Attendance History Record
        const historyRecord = await prisma.attendanceHistory.findUnique({
            where: { id: historyId }
        });

        if (!historyRecord || !historyRecord.details) {
            return NextResponse.json({ error: "Attendance record not found or has no details" }, { status: 404 });
        }

        // Parse Details
        let details: any[] = [];
        try {
            details = JSON.parse(historyRecord.details);
        } catch (e) {
            return NextResponse.json({ error: "Invalid attendance details format" }, { status: 500 });
        }

        const absenteesData = details.filter(s => s["Status"] === "Absent" || s.status === "Absent");
        const rollNumbers = absenteesData.map(s => s["Roll Number"] || s.rollNumber);

        if (rollNumbers.length === 0) {
            return NextResponse.json({ successCount: 0, failureCount: 0, message: "No absentees found" });
        }

        // Fetch reliable Student DB records for mobile numbers and IDs
        // STRICT FILTER: Must belong to the exact department, year, semester, and section of the attendance record
        const students = await prisma.student.findMany({
            where: {
                rollNumber: { in: rollNumbers },
                departmentId: historyRecord.departmentId,
                year: historyRecord.year,
                semester: historyRecord.semester,
                sectionId: historyRecord.sectionId
            }
        });

        let successCount = 0;
        let failureCount = 0;
        const smsLogsToCreate: any[] = [];

        // Send SMS sequentially to honor rate limits potentially
        for (const student of students) {
            // Find specific mobile to use
            const mobile = student.mobile || student.studentContactNumber;
            if (!mobile) {
                failureCount++;
                smsLogsToCreate.push({
                    studentId: student.id,
                    sentById: (session.user as any).id,
                    targetDate: historyRecord.date,
                    mobileNumber: "N/A",
                    status: "FAILED",
                    gatewayResponse: "No mobile number on record"
                });
                continue;
            }

            // Call Platinum SMS API
            const result = await sendAbsenteeSMS(mobile, student.rollNumber, student.name);

            if (result.success) {
                successCount++;
            } else {
                failureCount++;
            }

            // Prepare log
            smsLogsToCreate.push({
                studentId: student.id,
                sentById: (session.user as any).id,
                targetDate: historyRecord.date,
                mobileNumber: mobile,
                status: result.success ? "SUCCESS" : "FAILED",
                gatewayResponse: result.response
            });
        }

        // Save logs to DB
        if (smsLogsToCreate.length > 0) {
            await prisma.sMSLog.createMany({
                data: smsLogsToCreate
            });
        }

        return NextResponse.json({
            successCount,
            failureCount,
            message: "SMS processing complete"
        });

    } catch (error) {
        console.error("Error in send-absentees:", error);
        return NextResponse.json({ error: "Failed to process SMS requests" }, { status: 500 });
    }
}
