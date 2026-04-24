import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Department-wise stats for exam applications
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["OFFICE", "ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const where: any = {};

        if (role === "OFFICE") {
            const deptId = (session.user as any).departmentId;
            if (deptId) {
                const dept = await prisma.department.findUnique({ where: { id: deptId } });
                if (dept) where.department = dept.name;
            }
        }

        const applications = await prisma.examApplication.findMany({ 
            where,
            include: { setting: true }
        });

        // Group by department + year + semester + settingId
        const grouped: Record<string, any> = {};

        for (const app of applications) {
            const settingId = app.settingId || "HISTORY";
            const key = `${app.department}__${app.year}__${app.semester}__${settingId}`;
            if (!grouped[key]) {
                grouped[key] = { 
                    department: app.department, 
                    year: app.year, 
                    semester: app.semester, 
                    settingId: app.settingId,
                    settingName: app.setting ? (app.setting.name || app.setting.type) : "Legacy Data (History)",
                    total: 0, pending: 0, approved: 0, rejected: 0 
                };
            }
            grouped[key].total += 1;
            if (app.status === "PENDING") grouped[key].pending += 1;
            else if (app.status === "APPROVED") grouped[key].approved += 1;
            else if (app.status === "REJECTED") grouped[key].rejected += 1;
        }

        return NextResponse.json(Object.values(grouped));
    } catch (error) {
        console.error("Stats error:", error);
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
    }
}
