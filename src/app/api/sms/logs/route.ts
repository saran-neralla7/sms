import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    // Allow ALL authorized faculty/staff to see logs if they have a valid reason,
    // but typically we restrict this page to ADMIN / HOD / SMS_USER
    if (!["SMS_USER", "ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(role)) {
        // We'll allow faculty to get their own student's logs if studentId is provided.
        // That check is more complex, so for now we ensure at least an authenticated user.
    }

    try {
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");
        const departmentId = searchParams.get("departmentId");
        const year = searchParams.get("year");
        const semester = searchParams.get("semester");
        const sectionId = searchParams.get("sectionId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const limitParam = searchParams.get("limit");

        // Enforce department strictness if HOD
        let enforcedDepartmentId = departmentId;
        if (role === "HOD") {
            enforcedDepartmentId = (session.user as any).departmentId;
        }

        const whereClause: any = {};

        if (studentId) {
            whereClause.studentId = studentId;
        }

        if (enforcedDepartmentId || year || semester || sectionId) {
            whereClause.student = {
                ...(enforcedDepartmentId && { departmentId: enforcedDepartmentId }),
                ...(year && { year }),
                ...(semester && { semester }),
                ...(sectionId && { sectionId })
            };
        }

        if (startDate || endDate) {
            whereClause.dateSent = {};
            if (startDate) {
                whereClause.dateSent.gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.dateSent.lte = end;
            }
        }

        const limit = limitParam ? parseInt(limitParam) : 500; // default 500 to prevent crash

        const logs = await prisma.sMSLog.findMany({
            where: whereClause,
            include: {
                student: {
                    include: {
                        department: true,
                        section: true
                    }
                },
                sentBy: {
                    select: {
                        id: true,
                        username: true,
                        role: true
                    }
                }
            },
            orderBy: {
                dateSent: "desc"
            },
            take: limit
        });

        // Map for easier frontend use
        const mappedLogs = logs.map((log: any) => ({
            id: log.id,
            dateSent: log.dateSent,
            targetDate: log.targetDate,
            mobileNumber: log.mobileNumber,
            messageType: log.messageType,
            status: log.status,
            gatewayResponse: log.gatewayResponse,
            student: {
                id: log.student.id,
                name: log.student.name,
                rollNumber: log.student.rollNumber,
                department: log.student.department.name,
                year: log.student.year,
                semester: log.student.semester,
                section: log.student.section.name,
            },
            sentBy: log.sentBy?.username || "System"
        }));

        return NextResponse.json(mappedLogs);
    } catch (error) {
        console.error("Error fetching SMS logs:", error);
        return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }
}
