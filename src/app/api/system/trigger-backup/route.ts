import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execPromise = promisify(exec);

export async function POST() {
    const session = await getServerSession(authOptions);

    // Stricter permission check: Only ADMIN and DIRECTOR can trigger manual backup
    if (!session || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    try {
        const scriptPath = path.join(process.cwd(), "scripts", "backup_db.sh");
        
        // Execute the daily backup script
        const { stdout, stderr } = await execPromise(`bash "${scriptPath}"`);

        // Read updated backup status
        const statusFilePath = path.join(process.cwd(), "backup_status.json");
        let statusPayload = {
            status: "success",
            timestamp: new Date().toISOString(),
            message: "Manual Backup completed successfully."
        };

        try {
            const fileContent = await fs.readFile(statusFilePath, "utf-8");
            statusPayload = JSON.parse(fileContent);
        } catch (readErr) {
            console.warn("Could not read backup_status.json after manual run:", readErr);
        }

        return NextResponse.json({
            success: true,
            backupStatus: statusPayload,
            output: stdout || stderr
        });
    } catch (error: any) {
        console.error("Manual Backup Execution Error:", error);

        // Record failure in backup_status.json
        const failurePayload = {
            status: "error",
            timestamp: new Date().toISOString(),
            message: `Manual backup failed: ${error.message || "Script execution error"}`
        };

        try {
            const statusFilePath = path.join(process.cwd(), "backup_status.json");
            await fs.writeFile(statusFilePath, JSON.stringify(failurePayload, null, 2));
        } catch (writeErr) {
            console.error("Failed to write failure status to backup_status.json:", writeErr);
        }

        return NextResponse.json({
            success: false,
            error: error.message || "Manual backup failed",
            backupStatus: failurePayload
        }, { status: 500 });
    }
}
