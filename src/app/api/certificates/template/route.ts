import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file || !file.name.endsWith(".docx")) {
            return NextResponse.json({ error: "Invalid file format. Please upload a .docx file." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const destPath = path.join(process.cwd(), "public", "certificates", "tc_template.docx");

        fs.writeFileSync(destPath, buffer);

        return NextResponse.json({ success: true, message: "Template uploaded successfully." });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const destPath = path.join(process.cwd(), "public", "certificates", "tc_template.docx");
        const exists = fs.existsSync(destPath);

        return NextResponse.json({ exists });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
