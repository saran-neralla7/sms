
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import fs from "fs";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    // Only ADMIN or HOD or FACULTY can upload? Let's restrict to ADMIN/HOD for bulk.
    // For now, let's allow ADMIN/HOD.
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HOD")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const files = formData.getAll("files") as File[]; // Expecting field name "files" for multiple

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), "public/student-photos");

        // Ensure directory exists
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (e) {
            // Ignore if exists
        }

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (const file of files) {
            try {
                // Filename expected: "21131A0501.jpg" or "21131A0501.png"
                const originalName = file.name;
                const rollNumber = path.parse(originalName).name.toUpperCase(); // "21131A0501"

                // Validate Roll Number exists in DB
                const student = await prisma.student.findFirst({
                    where: {
                        rollNumber: {
                            equals: rollNumber,
                            mode: 'insensitive'
                        }
                    }
                });

                if (!student) {
                    results.push({ file: originalName, status: "error", message: "Student not found" });
                    failCount++;
                    continue;
                }

                // Save File
                const buffer = Buffer.from(await file.arrayBuffer());
                const cleanFileName = `${rollNumber}${path.extname(originalName).toLowerCase()}`;
                const filePath = path.join(uploadDir, cleanFileName);

                await writeFile(filePath, buffer);

                // Update DB
                const photoUrl = `/student-photos/${cleanFileName}`;
                const data: any = { photoUrl };
                await prisma.student.update({
                    where: { id: student.id },
                    data
                });

                results.push({ file: originalName, status: "success", rollNumber });
                successCount++;

            } catch (err: any) {
                console.error(`Failed to process ${file.name}:`, err);
                results.push({ file: file.name, status: "error", message: err.message });
                failCount++;
            }
        }

        return NextResponse.json({
            message: `Processed ${files.length} files. Success: ${successCount}, Failed: ${failCount}`,
            results,
            successCount,
            failCount
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
