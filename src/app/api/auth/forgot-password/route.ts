import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username } = body;

        if (!username) {
            return NextResponse.json({ error: "Username is required" }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    // Support email lookup if needed, but username is primary
                ]
            }
        });

        if (!user) {
            return NextResponse.json({ error: "Username does not exist" }, { status: 404 });
        }

        // Check pending
        const existing = await prisma.passwordResetRequest.findFirst({
            where: {
                userId: user.id,
                status: "PENDING"
            }
        });

        if (existing) {
            return NextResponse.json({ message: "Request already pending" });
        }

        await prisma.passwordResetRequest.create({
            data: {
                userId: user.id,
                status: "PENDING"
            }
        });

        return NextResponse.json({ message: "Request submitted successfully" });

    } catch (error) {
        console.error("Forgot password error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
