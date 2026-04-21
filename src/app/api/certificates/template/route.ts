import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

const TEMPLATE_MAP: Record<string, string> = {
    TC: "tc_template.docx",
    SC: "sc_template.docx",
};

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const type = (formData.get("type") as string) || "TC";

        if (!file || !file.name.endsWith(".docx")) {
            return NextResponse.json({ error: "Invalid file format. Please upload a .docx file." }, { status: 400 });
        }

        const templateName = TEMPLATE_MAP[type] || TEMPLATE_MAP.TC;
        const buffer = Buffer.from(await file.arrayBuffer());
        const destDir = path.join(process.cwd(), "public", "certificates");
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const destPath = path.join(destDir, templateName);

        fs.writeFileSync(destPath, buffer);

        return NextResponse.json({ success: true, message: `${type} template uploaded successfully.` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "TC";
        const templateName = TEMPLATE_MAP[type] || TEMPLATE_MAP.TC;
        const destPath = path.join(process.cwd(), "public", "certificates", templateName);
        const exists = fs.existsSync(destPath);

        return NextResponse.json({ exists });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
