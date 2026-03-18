import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(session.user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const requests = await prisma.passwordResetRequest.findMany({
            where: {
                status: "PENDING"
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        faculty: {
                            select: {
                                empName: true,
                                empCode: true,
                                department: { select: { name: true } }
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error("Fetch Reset Requests Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
