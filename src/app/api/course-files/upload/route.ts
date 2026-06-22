import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadDir = join(process.cwd(), "public", "uploads", "course-files");
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // directory already exists
    }

    const originalName = file.name;
    const extension = originalName.substring(originalName.lastIndexOf("."));
    const uniqueFilename = `${uuidv4()}${extension}`;
    const filePath = join(uploadDir, uniqueFilename);

    await writeFile(filePath, buffer);

    // Return the public serving URL
    const url = `/uploads/course-files/${uniqueFilename}`;
    return NextResponse.json({ success: true, url, filename: originalName });
  } catch (error: any) {
    console.error("Error uploading course file asset:", error);
    return NextResponse.json({ error: error.message || "Failed to upload file" }, { status: 500 });
  }
}
