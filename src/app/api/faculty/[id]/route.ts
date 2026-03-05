import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const body = await req.json();
        const { id } = params;

        const existing = await prisma.faculty.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: "Faculty not found" }, { status: 404 });

        const faculty = await prisma.faculty.update({
            where: { id },
            data: {
                empName: body.empName,
                shortName: body.shortName,
                dob: body.dob ? new Date(body.dob) : undefined,
                gender: body.gender,
                joinDate: body.joinDate ? new Date(body.joinDate) : undefined,
                resignDate: body.resignDate ? new Date(body.resignDate) : null,
                designation: body.designation,
                departmentId: body.departmentId,
                mobile: body.mobile,
                email: body.email,
                bloodGroup: body.bloodGroup,
                basicSalary: body.basicSalary ? parseFloat(body.basicSalary) : null,
                fatherName: body.fatherName,
                motherName: body.motherName,
                address: body.address,
                qualification: body.qualification,
                aadharNo: body.aadharNo,
                panNo: body.panNo,
            }
        });

        return NextResponse.json(faculty);
    } catch (error) {
        console.error("Error updating faculty:", error);
        return NextResponse.json({ error: "Failed to update faculty" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;

        // Transaction to delete Faculty and linked User
        await prisma.$transaction(async (tx) => {
            // Find linked user
            const faculty = await tx.faculty.findUnique({
                where: { id },
                include: { user: true }
            });

            if (!faculty) throw new Error("Faculty not found");

            if (faculty.user) {
                await tx.user.delete({ where: { id: faculty.user.id } });
            }

            await tx.faculty.delete({ where: { id } });
        });

        return NextResponse.json({ message: "Faculty deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting faculty:", error);
        return NextResponse.json({ error: error.message || "Failed to delete faculty" }, { status: 500 });
    }
}
