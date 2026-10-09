import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD", "OFFICE"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentName = searchParams.get("department");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");

    if (!departmentName || !year || !semester) {
        return NextResponse.json({ error: "department, year, semester are required" }, { status: 400 });
    }

    try {
        // Find department by name
        const dept = await prisma.department.findFirst({ where: { name: departmentName } });
        if (!dept) {
            return NextResponse.json({ error: "Department not found" }, { status: 404 });
        }

        // Find active exam application settings (or recent within current cycle window)
        const activeSettings = await prisma.examApplicationSetting.findMany({
            where: {
                isActive: true,
                endDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            select: { id: true }
        });
        const activeSettingIds = activeSettings.map(s => s.id);

        // Fetch all students in this class
        const students = await prisma.student.findMany({
            where: { departmentId: dept.id, year, semester },
            orderBy: { rollNumber: "asc" },
            select: {
                id: true,
                rollNumber: true,
                name: true,
                year: true,
                semester: true,
                examApplications: {
                    where: activeSettingIds.length > 0 ? {
                        settingId: { in: activeSettingIds }
                    } : {
                        submittedAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
                    },
                    select: {
                        id: true,
                        year: true,
                        semester: true,
                        type: true,
                        status: true,
                        utrNumber: true,
                        amountPaid: true,
                        paymentDate: true,
                        duplicateUtr: true,
                        editRequested: true,
                        settingId: true,
                        subjects: {
                            select: {
                                subject: { select: { code: true, name: true } }
                            }
                        }
                    }
                }
            }
        });

        // Format: separate regular vs backlog for the current cycle
        const result = students.map(s => {
            // Regular application must match year, semester, and type === 'REGULAR'
            const regular = s.examApplications.find(a => a.year === year && a.semester === semester && a.type === "REGULAR") || null;
            // Backlog applications: supplementary applications submitted in this cycle
            const backlogs = s.examApplications.filter(a => a.type === "SUPPLY");
            return {
                rollNumber: s.rollNumber,
                name: s.name,
                studentYear: s.year,
                studentSemester: s.semester,
                regular,
                backlogs
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Student tracker error:", error);
        return NextResponse.json({ error: "Failed to fetch tracker data" }, { status: 500 });
    }
}
