import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user details from DB to enforce permissions
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { department: true }
    });

    if (!user) {
        return NextResponse.json({ error: "User profile not found." }, { status: 403 });
    }

    const userRole = (user.role || "").toUpperCase();
    const userDeptCode = user.department?.code || "";
    const userDeptId = user.departmentId;

    const isGlobal = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole) || userDeptCode === "BSH";

    // Enforce role check: Only ADMIN, DIRECTOR, PRINCIPAL, HOD, and OFFICE allowed
    // Note: BSH roles (even if FACULTY) are allowed bypass
    if (!isGlobal && !["HOD", "OFFICE"].includes(userRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const slotType = searchParams.get("slotType") || "OE"; // Default to OE

    let finalDepartmentId: string | null | undefined = departmentId;
    if (!isGlobal) {
        // Enforce HOD/OFFICE's department
        finalDepartmentId = userDeptId || undefined;
    }

    try {
        // Build student query filter
        const studentWhere: any = {
            isAlumni: false,
            isLeftCollege: false,
            isDetained: false
        };

        if (batchId) {
            studentWhere.batchId = batchId;
        }
        if (finalDepartmentId) {
            studentWhere.departmentId = finalDepartmentId;
        }
        if (year) {
            studentWhere.year = year;
        }
        if (semester) {
            studentWhere.semester = semester;
        }

        // Fetch students and their enrolled subjects with elective slots
        const students = await prisma.student.findMany({
            where: studentWhere,
            include: {
                department: true,
                section: true,
                subjects: {
                    where: {
                        isElective: true,
                        electiveSlotId: { not: null }
                    },
                    include: {
                        electiveSlotRelation: true
                    }
                }
            },
            orderBy: {
                rollNumber: "asc"
            }
        });

        // Filter elective slots based on slotType
        const slotWhere: any = {};
        if (slotType === "OE") {
            slotWhere.OR = [
                { name: { startsWith: "OE", mode: "insensitive" } },
                { name: { startsWith: "OPEN", mode: "insensitive" } }
            ];
        } else if (slotType === "PE") {
            slotWhere.OR = [
                { name: { startsWith: "PE", mode: "insensitive" } },
                { name: { startsWith: "PROF", mode: "insensitive" } }
            ];
        }
        // If ALL, no extra filter on slot name

        const matchedSlots = await prisma.electiveSlot.findMany({
            where: slotWhere,
            orderBy: {
                name: "asc"
            }
        });

        const activeSlotNames = matchedSlots.map(s => s.name);

        // Process student list to extract matching elective choices
        const reportData = students.map(student => {
            const choices: Record<string, { id: string; code: string; name: string }> = {};

            student.subjects.forEach(subject => {
                const slotName = subject.electiveSlotRelation?.name;
                if (slotName && activeSlotNames.includes(slotName)) {
                    choices[slotName] = {
                        id: subject.id,
                        code: subject.code,
                        name: subject.name
                    };
                }
            });

            return {
                id: student.id,
                rollNumber: student.rollNumber,
                name: student.name,
                department: student.department?.code || student.department?.name || "N/A",
                section: student.section?.name || "N/A",
                choices
            };
        });

        // Determine which slots are actually used in the filtered student set
        const usedSlots = new Set<string>();
        reportData.forEach(student => {
            Object.keys(student.choices).forEach(slotName => {
                usedSlots.add(slotName);
            });
        });

        // Fallback to all matching slots if none are used yet
        const displaySlots = usedSlots.size > 0
            ? activeSlotNames.filter(name => usedSlots.has(name))
            : activeSlotNames;

        return NextResponse.json({
            students: reportData,
            electiveSlots: displaySlots
        });

    } catch (error) {
        console.error("Open electives report error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
