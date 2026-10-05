import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStudentEditConfig, updateStudentEditPermissions } from "@/lib/student-permissions";
import { logActivity } from "@/lib/logging";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const config = await getStudentEditConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error("Error reading student edit config:", error);
        return NextResponse.json({ error: "Failed to read configuration" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session.user as any).role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const updated = await updateStudentEditPermissions(body);

        await logActivity(
            (session.user as any).id,
            "UPDATE",
            "StudentEditPermissions",
            "system_settings",
            body
        );

        return NextResponse.json({ success: true, permissions: updated });
    } catch (error: any) {
        console.error("Error updating student permissions:", error);
        return NextResponse.json({ error: error.message || "Failed to update permissions" }, { status: 500 });
    }
}
