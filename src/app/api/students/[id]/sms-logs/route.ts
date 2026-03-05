
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const studentId = params.id;
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: { rollNumber: true, sectionId: true, name: true }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Fetch all SMS attendance records for this student's section
        // Optimization: We could filter by date range if needed, but for now specific requirement is "all days"
        const records = await prisma.attendanceHistory.findMany({
            where: {
                sectionId: student.sectionId,
                type: "SMS",
                status: "Completed"
            },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                date: true,
                details: true,
                fileName: true // Sometimes used for "Manual Entry" label, or Department info
            }
        });

        const absentDates: any[] = [];

        for (const record of records) {
            try {
                const details = JSON.parse(record.details);
                // details is Array<{ "Roll Number": string, "Status": string, ... }>

                // Find student in this record
                const entry = details.find((d: any) => d["Roll Number"] === student.rollNumber);

                if (entry && entry["Status"] === "Absent") {
                    absentDates.push({
                        date: record.date,
                        recordId: record.id
                    });
                }
            } catch (e) {
                console.error("Error parsing details for record", record.id, e);
            }
        }

        return NextResponse.json({
            student: { name: student.name, rollNumber: student.rollNumber },
            absentDates
        });

    } catch (error) {
        console.error("Error fetching SMS logs:", error);
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }
}
