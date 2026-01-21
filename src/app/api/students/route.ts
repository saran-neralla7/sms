import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const section = searchParams.get("section"); // This is actually sectionId now? Or name? Let's check params.
    // Ideally frontend sends ID. But if it sends "A", we need to find Section ID.
    // Let's assume frontend sends IDs for robust code or we join tables.
    // For now, let's assume sectionId is passed as 'section' param or we look it up.
    // Given the major UI refactor, let's switch to 'sectionId'.

    const sectionId = searchParams.get("sectionId");
    const sectionIds = searchParams.get("sectionIds"); // Comma separated

    const where: any = {};
    if (year) where.year = year;
    if (semester) where.semester = semester;

    if (sectionIds) {
        where.sectionId = { in: sectionIds.split(",") };
    } else if (sectionId) {
        where.sectionId = sectionId;
    }

    // Scoping
    const userRole = (session.user as any).role;
    const userDeptId = (session.user as any).departmentId;

    if (userRole !== "ADMIN") {
        if (!userDeptId) {
            return NextResponse.json({ error: "User has no department assigned" }, { status: 403 });
        }
        where.departmentId = userDeptId;
    } else {
        // Admin can filter by dept if passed
        const departmentId = searchParams.get("departmentId");
        if (departmentId) where.departmentId = departmentId;
    }

    const includeSubjects = searchParams.get("includeSubjects") === "true";

    try {
        const students = await prisma.student.findMany({
            where,
            include: {
                section: true,
                department: true,
                subjects: includeSubjects ? { select: { id: true } } : false
            },
            orderBy: { rollNumber: "asc" },
        });
        return NextResponse.json(students);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
    }
}

export async function POST(request: Request) {
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
        // Body should contain rollout, name, mobile, year, sem, sectionId, departmentId

        // Basic validation
        if (!body.departmentId || !body.sectionId) {
            return NextResponse.json({ error: "Department and Section are required" }, { status: 400 });
        }

        // HOD Scoping Enforcement
        if (role === "HOD" && body.departmentId !== userDeptId) {
            return NextResponse.json({ error: "You can only add/update students in your own department" }, { status: 403 });
        }

        // Check if exists
        const existingStudent = await prisma.student.findUnique({
            where: { rollNumber: body.rollNumber }
        });

        // Resolve Regulation
        let regulationId = null;
        const regName = body.regulation || "R22";

        const regulationRecord = await prisma.regulation.findUnique({ where: { name: regName } });
        if (regulationRecord) {
            regulationId = regulationRecord.id;
        } else {
            // Lazy create if needed, or error? Let's lazy create for now to support bulk uploads easily or old fallback
            const newReg = await prisma.regulation.create({ data: { name: regName } });
            regulationId = newReg.id;
        }

        let result;
        let action = "created";

        if (existingStudent) {
            // Update
            result = await prisma.student.update({
                where: { rollNumber: body.rollNumber },
                data: {
                    name: body.name,
                    mobile: body.mobile,
                    year: body.year,
                    semester: body.semester,
                    sectionId: body.sectionId,
                    departmentId: body.departmentId,
                    regulationId: regulationId
                }
            });
            action = "updated";
        } else {
            // Create
            result = await prisma.student.create({
                data: {
                    rollNumber: body.rollNumber,
                    name: body.name,
                    mobile: body.mobile,
                    year: body.year,
                    semester: body.semester,
                    sectionId: body.sectionId,
                    departmentId: body.departmentId,
                    regulationId: regulationId
                },
            });
            action = "created";
        }

        return NextResponse.json({ ...result, action }); // Return action status
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to process student" }, { status: 500 });
    }
}
