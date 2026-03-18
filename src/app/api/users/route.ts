import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { hasGlobalAccess, GLOBAL_ROLES } from "@/lib/permissions";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                role: true,
                departmentId: true,
                department: {
                    select: { name: true, code: true }
                },
                createdAt: true,
            },
        });
        return NextResponse.json(users);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!hasGlobalAccess(session?.user)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { username, password, role, departmentId } = await request.json();

        // Validation Checks
        const isGlobalRole = GLOBAL_ROLES.includes(role);

        // Non-global roles MUST have a department (HOD, FACULTY, USER)
        // OFFICE role can optionally have a department (scoped) or no department (all departments)
        if (!isGlobalRole && role !== "OFFICE" && !departmentId) {
            return NextResponse.json({ error: "Department is required for this role" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: role || "USER",
                departmentId: (isGlobalRole || !departmentId) ? null : departmentId
            },
            select: {
                id: true,
                username: true,
                role: true,
                department: true
            },
        });
        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { ids } = await request.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "No User IDs provided" }, { status: 400 });
        }

        // Prevent deleting self
        if (ids.includes(session.user.id)) {
            return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
        }

        await prisma.user.deleteMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });

        return NextResponse.json({ message: "Users deleted successfully" });
    } catch (error: any) {
        console.error("Delete Error:", error);
        // P2003 is Prisma's error for Foreign Key Constraint Violation
        if (error.code === 'P2003' || error.message?.includes('violates RESTRICT setting')) {
            return NextResponse.json({
                error: "Cannot delete users who have linked data (e.g., downloaded attendance, faculty records). Please deactivate the user or remove linked data first."
            }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to delete users" }, { status: 500 });
    }
}
