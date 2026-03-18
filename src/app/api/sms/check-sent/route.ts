import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const historyId = searchParams.get("historyId");

        if (!historyId) return NextResponse.json({ error: "No history ID" }, { status: 400 });

        const history = await prisma.attendanceHistory.findUnique({
            where: { id: historyId }
        });

        if (!history) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Find if any SMS logs exist for this targetDate and section
        // Since we didn't store historyId directly in SMSLog, we look for logs with matching targetDate
        // for students in this section. We check count > 0.
        const logsCount = await prisma.sMSLog.count({
            where: {
                targetDate: {
                    gte: new Date(new Date(history.date).setHours(0, 0, 0, 0)),
                    lte: new Date(new Date(history.date).setHours(23, 59, 59, 999))
                },
                student: {
                    departmentId: history.departmentId,
                    year: history.year,
                    semester: history.semester,
                    sectionId: history.sectionId
                }
            }
        });

        return NextResponse.json({ alreadySent: logsCount > 0, count: logsCount });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed to check" }, { status: 500 });
    }
}
