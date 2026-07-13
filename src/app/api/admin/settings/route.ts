import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: "DISABLE_STUDENT_LOGIN" }
        });
        return NextResponse.json({ value: setting?.value === "true" });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { value } = await request.json();
        
        const setting = await prisma.systemSetting.upsert({
            where: { key: "DISABLE_STUDENT_LOGIN" },
            update: { value: String(value) },
            create: { key: "DISABLE_STUDENT_LOGIN", value: String(value) }
        });

        return NextResponse.json({ success: true, value: setting.value === "true" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
