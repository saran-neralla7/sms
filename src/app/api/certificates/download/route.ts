import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const file = searchParams.get("file");

        if (!file) {
            return NextResponse.json({ error: "File parameter required" }, { status: 400 });
        }

        // Sanitize: only allow filenames, no path traversal
        const safeName = path.basename(file);
        const filePath = path.join(process.cwd(), "public", "certificates", "issued", safeName);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);
        
        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${safeName}"`,
                "Content-Length": String(fileBuffer.length),
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
