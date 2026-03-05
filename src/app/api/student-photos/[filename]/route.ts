import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

// Handles GET /api/student-photos/[filename]
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
        // Construct the absolute path to where we save the photos
        const filePath = path.join(process.cwd(), "public/student-photos", filename);

        if (!existsSync(filePath)) {
            // Serve a default placeholder if the image doesn't exist
            // Or just return a proper 404. Returning 404 is cleaner.
            return new NextResponse("Image not found", { status: 404 });
        }

        // Read the file buffer
        const fileBuffer = readFileSync(filePath);

        // Determine the content type based on the file extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".gif") contentType = "image/gif";

        // Generate response with correct headers
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
