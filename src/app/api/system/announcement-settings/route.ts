import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const setting = await prisma.systemSetting.findUnique({
            where: { key: "ENABLE_DEEMED_UNIVERSITY_POPUP" }
        });

        // Default to true if not explicitly set to "false"
        const enabled = setting ? setting.value !== "false" : true;

        return NextResponse.json({ enabled });
    } catch (error: any) {
        console.error("Failed to fetch announcement settings:", error);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user.role !== "ADMIN" && session.user.role !== "DIRECTOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { enabled } = await request.json();

        const setting = await prisma.systemSetting.upsert({
            where: { key: "ENABLE_DEEMED_UNIVERSITY_POPUP" },
            update: { value: enabled ? "true" : "false" },
            create: { key: "ENABLE_DEEMED_UNIVERSITY_POPUP", value: enabled ? "true" : "false" }
        });

        return NextResponse.json({ success: true, enabled: setting.value === "true" });
    } catch (error: any) {
        console.error("Failed to update announcement settings:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}
