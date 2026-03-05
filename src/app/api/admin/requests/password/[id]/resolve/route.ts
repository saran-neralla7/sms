import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcrypt";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const requestId = params.id;
        const resetReq = await prisma.passwordResetRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });

        if (!resetReq) return NextResponse.json({ error: "Request not found" }, { status: 404 });

        // Resolve
        const body = await request.json();
        const action = body.action; // "APPROVE" or "REJECT"

        if (action === "REJECT") {
            await prisma.passwordResetRequest.update({
                where: { id: requestId },
                data: { status: "REJECTED", resolvedBy: session.user.id }
            });
            return NextResponse.json({ message: "Request rejected" });
        }

        // Approve -> Reset Password
        // Default password format: "gvp1234" (Requested by Admin)
        const newPassword = "gvp1234";
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetReq.userId },
                data: { password: hashedPassword }
            }),
            prisma.passwordResetRequest.update({
                where: { id: requestId },
                data: { status: "RESOLVED", resolvedBy: session.user.id }
            })
        ]);

        // Log Audit
        await prisma.auditLog.create({
            data: {
                action: "PASSWORD_RESET",
                entity: "User",
                entityId: resetReq.userId,
                details: `Reset password for user ${resetReq.user.username} via request`,
                performedBy: session.user.id
            }
        });

        return NextResponse.json({ message: "Password reset to 'Welcome123'" });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to resolve request" }, { status: 500 });
    }
}
