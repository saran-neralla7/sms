import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

export async function GET() {
    const session = await getServerSession(authOptions);

    // Only allow Admin or Director to see backup status
    if (!session || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const filePath = path.join(process.cwd(), "backup_status.json");
        const fileContent = await fs.readFile(filePath, "utf-8");
        const status = JSON.parse(fileContent);

        return NextResponse.json(status);
    } catch (error: any) {
        // If file doesn't exist, it means backup hasn't run yet
        if (error.code === 'ENOENT') {
            return NextResponse.json({
                status: "unknown",
                timestamp: null,
                message: "No backup has been recorded yet."
            });
        }

        console.error("Error reading backup status:", error);
        return NextResponse.json({ error: "Failed to read backup status" }, { status: 500 });
    }
}
