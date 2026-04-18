import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const type = url.searchParams.get("type") || "TC";

        const certs = await prisma.certificate.findMany({
            where: { certificateType: type },
            include: {
                student: {
                    select: { name: true, rollNumber: true, department: true, section: true, batchString: true }
                },
                issuedBy: { select: { username: true } }
            },
            orderBy: { certificateNo: 'desc' }
        });

        return NextResponse.json(certs);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
