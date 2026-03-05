import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PUT(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { password, ...otherData } = body;

        // Only hash password if it's being updated
        const dataToUpdate: any = { ...otherData };
        if (password) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: params.id },
            data: dataToUpdate,
            select: {
                id: true,
                username: true,
                role: true,
            },
        });
        return NextResponse.json(user);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        // Prevent deleting self? Or ensure at least one admin exists?
        // For simplicity, just allow delete.
        if (params.id === session.user.id) {
            return NextResponse.json({ error: "Cannot delete self" }, { status: 400 });
        }

        await prisma.user.delete({
            where: { id: params.id },
        });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Error:", error);
        if (error.code === 'P2003' || error.message?.includes('violates RESTRICT setting')) {
            return NextResponse.json({
                error: "Cannot delete this user because they have linked records (e.g. downloaded attendance). Please deactivate them instead."
            }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}
