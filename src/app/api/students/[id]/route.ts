import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { role, departmentId } = session.user as any;

    // Scoping handled by check below or simple fetch?
    // User/Faculty can view students? Yes, view only.
    // HOD/Admin/Director/Principal can view.

    try {
        const student = await prisma.student.findUnique({
            where: { id: params.id },
            include: {
                department: true,
                section: true,
                regulation: true,
                batch: true,
                originalBatch: true,
                labBatch: true,
                internalMarks: {
                    include: {
                        subject: true,
                        academicYear: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

        // Scoping Check if needed? 
        // Faculty: Can view any student? Or only their Dept?
        // User (Student): Can view only self? Or anyone?
        // Let's assume Faculty/Staff can view all for now, or match existing filtering logic.
        // Existing GET all logic allowed Faculty/User STRICTLY by department.

        const isGlobalAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
        if (!isGlobalAdmin) {
            if (role === "USER" && student.departmentId !== departmentId) {
                // Maybe stricter for students? But requirements say "Students Page" is view only.
                // If Middleware allows navigation to list, they can see this.
                // let's match department constraint.
                if (student.departmentId !== departmentId) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            } else if (role === "HOD" || role === "FACULTY") {
                if (student.departmentId !== departmentId) {
                    return NextResponse.json({ error: "Access denied" }, { status: 403 });
                }
            }
        }

        return NextResponse.json(student);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch student" }, { status: 500 });
    }
}

export async function PUT(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId: userDeptId } = session.user as any;
    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();

        // Check if student exists and belongs to department if HOD
        if (role === "HOD") {
            const existingStudent = await prisma.student.findUnique({
                where: { id: params.id },
                select: { departmentId: true }
            });

            if (!existingStudent) {
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }

            if (existingStudent.departmentId !== userDeptId) {
                return NextResponse.json({ error: "You can only update students of your department" }, { status: 403 });
            }

            // Also prevent moving student to another department
            if (body.departmentId && body.departmentId !== userDeptId) {
                return NextResponse.json({ error: "You cannot move students to another department" }, { status: 403 });
            }
        }

        const student = await prisma.student.update({
            where: { id: params.id },
            data: {
                name: body.name,
                mobile: body.mobile,
                year: body.year,
                semester: body.semester,
                sectionId: body.sectionId,
                departmentId: body.departmentId,
                regulationId: body.regulationId,
                batchId: body.batchId || null,
                isDetained: body.isDetained || false,
                originalBatchId: body.originalBatchId || null,
                hallTicketNumber: body.hallTicketNumber || null,
                eamcetRank: body.eamcetRank || null,
                dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
                dateOfReporting: body.dateOfReporting ? new Date(body.dateOfReporting) : null,
                gender: body.gender || null,
                caste: body.caste || null,
                casteName: body.casteName || null,
                category: body.category || null,
                admissionType: body.admissionType || null,
                fatherName: body.fatherName || null,
                motherName: body.motherName || null,
                address: body.address || null,
                studentContactNumber: body.studentContactNumber || null,
                emailId: body.emailId || null,
                aadharNumber: body.aadharNumber || null,
                abcId: body.abcId || null,
                reimbursement: body.reimbursement === true || body.reimbursement === "true",
                certificatesSubmitted: body.certificatesSubmitted === true || body.certificatesSubmitted === "true",
                domainMailId: body.rollNumber ? `${body.rollNumber.toUpperCase()}@gvpcdpgc.edu.in` : null
            },
        });

        // Audit Log for UPDATE
        const performerId = session.user.id;
        try {
            await prisma.auditLog.create({
                data: {
                    action: "UPDATE",
                    entity: "Student",
                    entityId: student.rollNumber,
                    details: JSON.stringify({ rollNumber: student.rollNumber, name: student.name, changes: "Student Profile Updated" }),
                    performedBy: performerId
                }
            });
        } catch (logError) {
            console.error("Failed to log update:", logError);
        }

        return NextResponse.json(student);
    } catch (error: any) {
        console.error("Student Update Error:", error);
        return NextResponse.json({ error: error.message || "Failed to update student" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId: userDeptId } = session.user as any;
    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // Check scoping for HOD
        if (role === "HOD") {
            const existingStudent = await prisma.student.findUnique({
                where: { id: params.id },
                select: { departmentId: true }
            });

            if (!existingStudent) {
                return NextResponse.json({ error: "Student not found" }, { status: 404 });
            }

            if (existingStudent.departmentId !== userDeptId) {
                return NextResponse.json({ error: "You can only delete students of your department" }, { status: 403 });
            }
        }

        await prisma.student.delete({
            where: { id: params.id },
        });

        // Audit Log for DELETE
        const performerId = session.user.id;
        try {
            await prisma.auditLog.create({
                data: {
                    action: "DELETE",
                    entity: "Student",
                    entityId: params.id,
                    details: JSON.stringify({ studentId: params.id }),
                    performedBy: performerId
                }
            });
        } catch (logError) {
            console.error("Failed to log delete:", logError);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
    }
}
