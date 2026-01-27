"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function uploadStudentPhotos(formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "HOD" && session.user.role !== "DIRECTOR" && session.user.role !== "PRINCIPAL")) {
        return { error: "Unauthorized" };
    }

    const files = formData.getAll("files") as File[];
    if (!files || files.length === 0) {
        return { error: "No files uploaded" };
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
            const rollNumber = path.parse(originalName).name.toUpperCase();

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
            await prisma.student.update({
                where: { id: student.id },
                data: { photoUrl }
            });

            results.push({ file: originalName, status: "success", rollNumber });
            successCount++;

        } catch (err: any) {
            console.error(`Failed to process ${file.name}:`, err);
            results.push({ file: file.name, status: "error", message: err.message });
            failCount++;
        }
    }

    return {
        success: true,
        message: `Processed ${files.length} files. Success: ${successCount}, Failed: ${failCount}`,
        results,
        successCount,
        failCount
    };
}
