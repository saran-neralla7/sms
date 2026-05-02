import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ filepath: string[] }> }
) {
    try {
        const { filepath: filepathArr } = await context.params;
        const filepath = filepathArr.join("/");
        // Security: only allow alphanumeric, dashes, underscores, dots
        if (!/^[\w\-\.]+$/.test(filepath)) {
            return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
        }

        const fullPath = join(process.cwd(), "public", "uploads", "circulars", filepath);

        if (!existsSync(fullPath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const fileBuffer = await readFile(fullPath);
        const isPdf = filepath.toLowerCase().endsWith(".pdf");
        const contentType = isPdf ? "application/pdf" : "image/*";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `inline; filename="${filepath}"`,
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("Error serving circular:", error);
        return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
    }
}
