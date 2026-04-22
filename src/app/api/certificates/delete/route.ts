import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized. Admin only." }, { status: 401 });
        }

        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: "Certificate ID missing" }, { status: 400 });
        }

        const cert = await prisma.certificate.findUnique({
            where: { id }
        });

        if (!cert) {
            return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
        }

        // 1. Transaction to delete and potentially revert counter safely
        await prisma.$transaction(async (tx) => {
            const counter = await tx.certificateCounter.findUnique({
                where: { certificateType: cert.certificateType }
            });

            if (counter && counter.currentNumber === cert.certificateNo) {
                // It's the latest generation (and not a duplicate), so revert!
                await tx.certificateCounter.update({
                    where: { certificateType: cert.certificateType },
                    data: { currentNumber: counter.currentNumber - 1 }
                });
            }

            await tx.certificate.delete({ where: { id } });
        });

        // 2. Clear out physics file
        if (cert.fileUrl) {
            const fileName = path.basename(cert.fileUrl);
            const filePath = path.join(process.cwd(), "public", "certificates", "issued", fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        return NextResponse.json({ success: true, message: "Certificate successfully deleted." });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
