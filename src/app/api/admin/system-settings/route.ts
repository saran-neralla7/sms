import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import { logActivity } from "@/lib/logging";

const getSettingsPath = () => path.join(process.cwd(), "system_settings.json");

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const filePath = getSettingsPath();
        const fileContent = await fs.readFile(filePath, "utf-8");
        const settings = JSON.parse(fileContent);
        return NextResponse.json(settings);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ hideBulkDownload: false });
        }
        console.error("Error reading system settings:", error);
        return NextResponse.json({ error: "Failed to read system settings" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        if (typeof body.hideBulkDownload !== "boolean") {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        const filePath = getSettingsPath();
        const settings = { hideBulkDownload: body.hideBulkDownload };
        await fs.writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");

        // Log setting change to Audit Log
        await logActivity(
            (session.user as any).id,
            "UPDATE",
            "SystemConfig",
            "hideBulkDownload",
            { hideBulkDownload: body.hideBulkDownload }
        );

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error updating system settings:", error);
        return NextResponse.json({ error: "Failed to update system settings" }, { status: 500 });
    }
}
