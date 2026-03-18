import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { requestId, action } = body; // action: 'approve' | 'reject'

        if (!requestId || !action) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const resetRequest = await prisma.passwordResetRequest.findUnique({
            where: { id: requestId },
            include: { user: { include: { faculty: true } } }
        });

        if (!resetRequest) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        if (action === "reject") {
            await prisma.passwordResetRequest.delete({ where: { id: requestId } });
            return NextResponse.json({ message: "Request rejected and deleted" });
        }

        if (action === "approve") {
            // Determine default password
            // If student -> rollNumber
            // If faculty -> empCode
            // Else -> username
            
            let defaultPassword = resetRequest.user.username;
            
            // Check if student
            if (resetRequest.user.role === "STUDENT") {
                 // username IS the roll number for students
                 defaultPassword = resetRequest.user.username;
            } else if (resetRequest.user.faculty) {
                 defaultPassword = resetRequest.user.faculty.empCode;
            }

            const hashedPassword = await bcrypt.hash(defaultPassword, 10);

            // Update user password and delete request
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: resetRequest.userId },
                    data: { password: hashedPassword }
                }),
                prisma.passwordResetRequest.delete({
                    where: { id: requestId }
                })
            ]);

            return NextResponse.json({ message: `Password reset to default: ${defaultPassword}` });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error) {
        console.error("Process Reset Request Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
