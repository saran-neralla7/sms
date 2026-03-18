import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const pendingCount = await prisma.passwordResetRequest.count({
            where: {
                status: "PENDING"
            }
        });

        return NextResponse.json({ count: pendingCount });
    } catch (error) {
        console.error("Fetch Pending Resets Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
