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
        sizeLimit: '500mb',
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

        const uploadDir = path.join(process.cwd(), "public/faculty-photos");
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
                const baseName = path.parse(originalName).name.toUpperCase();
                const empCodeWithSlashes = baseName.replace(/[-_]/g, '/');

                // Find faculty by either exact filename or filename with dashes/underscores replaced by slashes
                const faculty = await prisma.faculty.findFirst({
                    where: {
                        OR: [
                            { empCode: { equals: baseName, mode: 'insensitive' } },
                            { empCode: { equals: empCodeWithSlashes, mode: 'insensitive' } }
                        ]
                    }
                });

                if (!faculty) {
                    results.push({ file: originalName, status: "error", message: "Faculty not found" });
                    fs.unlinkSync(file.filepath);
                    failCount++;
                    continue;
                }

                // Move/Rename file to final destination
                // Replace any slashes in the database empCode with dashes so we don't accidentally create directories
                const safeEmpCode = faculty.empCode.replace(/[\/\\]/g, '-').toUpperCase();
                const cleanFileName = `${safeEmpCode}${path.extname(originalName).toLowerCase()}`;
                const targetPath = path.join(uploadDir, cleanFileName);

                fs.renameSync(file.filepath, targetPath);

                // Update DB
                const photoUrl = `/api/faculty-photos/${cleanFileName}`;
                await prisma.faculty.update({
                    where: { id: faculty.id },
                    data: { photoUrl }
                });

                results.push({ file: originalName, status: "success", empCode: faculty.empCode });
                successCount++;

            } catch (err: any) {
                console.error(`Error processing ${file.originalFilename}:`, err);
                results.push({ file: file.originalFilename, status: "error", message: err.message });
                failCount++;
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
