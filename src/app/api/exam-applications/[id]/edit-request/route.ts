import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDeviceFromHeaders } from "@/lib/device-detector";
import { logActivity } from "@/lib/logging";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== "STUDENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { reason } = await req.json();

        if (!reason || reason.trim() === "") {
            return NextResponse.json({ error: "Reason is required" }, { status: 400 });
        }

        const application = await prisma.examApplication.findUnique({
            where: { id },
            include: { student: true }
        });

        if (!application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        if (application.student.rollNumber !== session.user.username) {
            return NextResponse.json({ error: "Unauthorized to edit this application" }, { status: 403 });
        }

        if (application.editRequested) {
            return NextResponse.json({ error: "Edit already requested" }, { status: 400 });
        }

        const deviceInfo = parseDeviceFromHeaders(req.headers);
        const deviceSummary = [deviceInfo.deviceModel, deviceInfo.os, deviceInfo.browser].filter(Boolean).join(" • ") || deviceInfo.deviceType;

        const updated = await prisma.examApplication.update({
            where: { id },
            data: {
                editRequested: true,
                editRequestReason: reason.trim(),
                editRequestIp: deviceInfo.ip,
                editRequestDevice: deviceSummary,
                editRequestAt: new Date()
            }
        });

        // Also record in system AuditLog
        await logActivity(
            (session.user as any).id || application.rollNumber,
            "EDIT_REQUEST",
            "ExamApplication",
            `${application.rollNumber} | Year ${application.year} Sem ${application.semester}`,
            {
                reason: reason.trim(),
                applicationId: application.id,
                ip: deviceInfo.ip,
                device: deviceSummary
            },
            deviceInfo
        );

        return NextResponse.json({ success: true, application: updated });
    } catch (error) {
        console.error("Error creating edit request:", error);
        return NextResponse.json({ error: "Failed to create edit request" }, { status: 500 });
    }
}

