import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure directory exists
        const uploadDir = join(process.cwd(), "public", "uploads", "circulars");
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (err) {
            // ignore if exists
        }

        // Generate unique filename to prevent collisions, but keep original extension
        const originalName = file.name;
        const extension = originalName.substring(originalName.lastIndexOf('.'));
        const uniqueFilename = `${uuidv4()}${extension}`;
        const path = join(uploadDir, uniqueFilename);

        await writeFile(path, buffer);

        // Return the relative URL via our API serving route
        return NextResponse.json({ url: `/api/circulars/${uniqueFilename}` });
    } catch (error) {
        console.error("Error uploading circular:", error);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }
}
