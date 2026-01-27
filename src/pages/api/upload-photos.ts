import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from 'fs';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
        sizeLimit: '500mb', // Technically redundant if bodyParser is false, but good practice
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(session.user.role)) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const uploadDir = path.join(process.cwd(), "public/student-photos");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const form = formidable({
            uploadDir,
            keepExtensions: true,
            maxFileSize: 500 * 1024 * 1024, // 500MB
            multiples: true,
        });

        const [fields, files] = await form.parse(req);

        const uploadedFiles = files.files;
        // formidable v3 returns an array of files for 'files' field if multiples: true
        // It might be a single file or array.

        const fileArray = Array.isArray(uploadedFiles) ? uploadedFiles : (uploadedFiles ? [uploadedFiles] : []);

        if (fileArray.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (const file of fileArray) {
            try {
                const originalName = file.originalFilename || file.newFilename;
                const rollNumber = path.parse(originalName).name.toUpperCase();

                // Find student
                const student = await prisma.student.findFirst({
                    where: {
                        rollNumber: { equals: rollNumber, mode: 'insensitive' }
                    }
                });

                if (!student) {
                    results.push({ file: originalName, status: "error", message: "Student not found" });
                    // We should delete the temp uploaded file
                    fs.unlinkSync(file.filepath);
                    failCount++;
                    continue;
                }

                // Move/Rename file to final destination
                const cleanFileName = `${rollNumber}${path.extname(originalName).toLowerCase()}`;
                const targetPath = path.join(uploadDir, cleanFileName);

                // Rename (move)
                fs.renameSync(file.filepath, targetPath);

                // Update DB
                const photoUrl = `/student-photos/${cleanFileName}`;
                await prisma.student.update({
                    where: { id: student.id },
                    data: { photoUrl }
                });

                results.push({ file: originalName, status: "success", rollNumber });
                successCount++;

            } catch (err: any) {
                console.error(`Error processing ${file.originalFilename}:`, err);
                results.push({ file: file.originalFilename, status: "error", message: err.message });
                failCount++;
                // Try to cleanup
                if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);
            }
        }

        return res.status(200).json({
            message: `Processed ${fileArray.length} files`,
            results,
            successCount,
            failCount
        });

    } catch (error) {
        console.error("Upload handler error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
