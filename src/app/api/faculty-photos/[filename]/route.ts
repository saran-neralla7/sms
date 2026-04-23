import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

// Handles GET /api/faculty-photos/[filename]
export async function GET(
    request: NextRequest,
    context: any
) {
    const params = await context.params;
    const filename = params?.filename;

    if (!filename) {
        return new NextResponse("Filename not provided", { status: 400 });
    }

    try {
        const filePath = path.join(process.cwd(), "public/faculty-photos", filename);

        if (!existsSync(filePath)) {
            return new NextResponse("Image not found", { status: 404 });
        }

        const fileBuffer = readFileSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        let contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".gif") contentType = "image/gif";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": `inline; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error("Error serving static photo:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
