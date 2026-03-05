import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const departmentId = searchParams.get("departmentId");

        const where: any = {};
        if (departmentId) where.departmentId = departmentId;

        const faculty = await prisma.faculty.findMany({
            where,
            include: {
                department: true,
                user: {
                    select: {
                        username: true,
                        role: true
                    }
                }
            },
            orderBy: { empCode: "asc" }
        });

        return NextResponse.json(faculty);
    } catch (error) {
        console.error("Error fetching faculty:", error);
        return NextResponse.json({ error: "Failed to fetch faculty" }, { status: 500 });
    }
}


export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const performerId = session?.user?.id || "SYSTEM"; // Fallback if seeding or public form

    try {
        const body = await req.json();

        // Check if empCode exists
        const existing = await prisma.faculty.findUnique({
            where: { empCode: body.empCode }
        });

        if (existing) {
            return NextResponse.json({ error: "Employee Code already exists" }, { status: 400 });
        }

        // Transaction to create Faculty, User, and Log
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Faculty
            const faculty = await tx.faculty.create({
                data: {
                    empCode: body.empCode,
                    empName: body.empName,
                    shortName: body.shortName,
                    dob: new Date(body.dob),
                    gender: body.gender,
                    joinDate: new Date(body.joinDate),
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

            // 2. Create User Login
            // Password = 'gvp@2026' (Default)
            // Username = ShortName (if available) else EmpCode
            const passwordPlain = "gvp@2026";
            const hashedPassword = await bcrypt.hash(passwordPlain, 10);

            const username = body.shortName || body.empCode;

            // Check if username exists
            const existingUser = await tx.user.findUnique({ where: { username } });
            if (existingUser) {
                throw new Error(`Username ${username} already taken by another user.`);
            }

            const user = await tx.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role: "FACULTY",
                    departmentId: body.departmentId,
                    facultyId: faculty.id
                }
            });

            // 3. Create Audit Log
            await tx.auditLog.create({
                data: {
                    action: "CREATE",
                    entity: "Faculty",
                    entityId: faculty.id,
                    details: JSON.stringify({ empCode: faculty.empCode, name: faculty.empName, userId: user.id }),
                    performedBy: performerId
                }
            });

            return { faculty, user };
        });

        return NextResponse.json(result.faculty, { status: 201 });
    } catch (error: any) {
        console.error("Error creating faculty:", error);
        return NextResponse.json({ error: error.message || "Failed to create faculty" }, { status: 500 });
    }
}

