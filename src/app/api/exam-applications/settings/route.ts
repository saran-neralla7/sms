import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// GET: List exam application settings
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const role = (session.user as any)?.role;

    try {
        const where: any = {};
        if (academicYearId && academicYearId !== "ALL") {
            where.academicYearId = academicYearId;
        }

        const settings = await prisma.examApplicationSetting.findMany({
            where,
            include: { academicYear: true },
            orderBy: [{ year: "asc" }, { semester: "asc" }]
        });

        // For student, evaluate accessMode, allowedRollNumbers, and allowAlumni
        if (role === "STUDENT") {
            const studentRoll = ((session.user as any)?.username || "").toUpperCase();
            
            // Fetch student record to get mobile and alumni status
            const studentRecord = await prisma.student.findUnique({
                where: { rollNumber: studentRoll },
                select: {
                    id: true,
                    rollNumber: true,
                    mobile: true,
                    studentContactNumber: true,
                    isAlumni: true,
                }
            });

            const studentMobileClean = (studentRecord?.mobile || "").replace(/[^0-9]/g, "");
            const studentContactClean = (studentRecord?.studentContactNumber || "").replace(/[^0-9]/g, "");
            const isStudentAlumni = !!studentRecord?.isAlumni;

            const evaluatedSettings = settings.map((s: any) => {
                // 1. Check Alumni Rule if setting specifies allowAlumni
                // Default: allowAlumni is true for SUPPLY, false for REGULAR
                const allowAlumniSetting = s.allowAlumni !== undefined && s.allowAlumni !== null
                    ? s.allowAlumni
                    : (s.type === "SUPPLY"); // Default legacy behavior: alumni allowed for supply, not regular

                if (isStudentAlumni && !allowAlumniSetting) {
                    return {
                        ...s,
                        isAllowed: false,
                        isHold: true,
                        holdMessage: s.holdMessage || "Alumni students are not permitted to register for this exam cycle."
                    };
                }

                // 2. Check Whitelist / Blacklist (Roll Numbers & Mobile Numbers)
                const listItems: string[] = Array.isArray(s.allowedRollNumbers)
                    ? s.allowedRollNumbers.map((r: any) => String(r).toUpperCase().trim())
                    : [];

                const isItemMatched = listItems.some(item => {
                    const cleanItem = item.replace(/[^0-9]/g, "");
                    // If it is a 10-digit number, check if it matches student mobile
                    if (cleanItem.length === 10 && (cleanItem === studentMobileClean || cleanItem === studentContactClean)) {
                        return true;
                    }
                    // Otherwise match roll number (clean alphanumeric)
                    return item === studentRoll;
                });

                const mode = s.accessMode || "ALL";

                if (mode === "SELECTED" || mode === "WHITELIST") {
                    // Only whitelisted students are allowed
                    const isAllowed = isItemMatched;
                    return {
                        ...s,
                        isAllowed,
                        isHold: !isAllowed,
                        holdMessage: s.holdMessage || "Your exam application is kept on hold, please contact the OFFICE."
                    };
                } else if (mode === "BLACKLIST") {
                    // Listed students are blocked / on hold; others are allowed
                    const isBlocked = isItemMatched;
                    return {
                        ...s,
                        isAllowed: !isBlocked,
                        isHold: isBlocked,
                        holdMessage: s.holdMessage || "Your exam application is kept on hold, please contact the OFFICE."
                    };
                }

                return {
                    ...s,
                    isAllowed: true,
                    isHold: false
                };
            });
            return NextResponse.json(evaluatedSettings);
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Fetch settings error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

// POST: Create a new exam application setting (admin)
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { year, semester, startDate, endDate, lateFeeEndDate, academicYearId } = body;

        if (!year || !semester || !startDate || !endDate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Clean and normalize allowedRollNumbers if provided
        let normalizedRolls: string[] | null = null;
        const isRestrictedMode = body.accessMode === "SELECTED" || body.accessMode === "WHITELIST" || body.accessMode === "BLACKLIST";
        if (isRestrictedMode && Array.isArray(body.allowedRollNumbers)) {
            normalizedRolls = Array.from(
                new Set(
                    body.allowedRollNumbers
                        .map((r: any) => String(r).trim().toUpperCase())
                        .filter(Boolean)
                )
            );
        }

        const allowAlumniVal = body.allowAlumni !== undefined && body.allowAlumni !== null
            ? Boolean(body.allowAlumni)
            : (body.type === "SUPPLY"); // Default to true for supply, false for regular

        const setting = await prisma.examApplicationSetting.create({
            data: {
                name: body.name || null,
                type: body.type || "REGULAR",
                year,
                semester,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                lateFeeEndDate: lateFeeEndDate ? new Date(lateFeeEndDate) : null,
                isActive: true,
                academicYearId: academicYearId || null,
                regularFee: body.regularFee || null,
                circularFileUrl: body.circularFileUrl || null,
                accessMode: body.accessMode || "ALL",
                allowedRollNumbers: (isRestrictedMode && normalizedRolls) ? normalizedRolls : Prisma.JsonNull,
                allowAlumni: allowAlumniVal,
                holdMessage: body.holdMessage || "Your exam application is kept on hold, please contact the OFFICE."
            },
            include: { academicYear: true }
        });

        return NextResponse.json(setting);
    } catch (error) {
        console.error("Create setting error:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}

// PUT: Update an existing exam application setting
export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing required setting ID" }, { status: 400 });
        }

        const existing = await prisma.examApplicationSetting.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "Setting not found" }, { status: 404 });
        }

        const year = body.year !== undefined ? String(body.year) : existing.year;
        const semester = body.semester !== undefined ? String(body.semester) : existing.semester;
        const startDate = body.startDate !== undefined ? new Date(body.startDate) : existing.startDate;
        const endDate = body.endDate !== undefined ? new Date(body.endDate) : existing.endDate;
        const lateFeeEndDate = body.lateFeeEndDate !== undefined 
            ? (body.lateFeeEndDate ? new Date(body.lateFeeEndDate) : null)
            : existing.lateFeeEndDate;

        const effectiveAccessMode = body.accessMode !== undefined ? body.accessMode : existing.accessMode;
        const isRestrictedMode = effectiveAccessMode === "SELECTED" || effectiveAccessMode === "WHITELIST" || effectiveAccessMode === "BLACKLIST";

        let normalizedRolls: any = undefined;
        if (body.allowedRollNumbers !== undefined) {
            if (isRestrictedMode && Array.isArray(body.allowedRollNumbers)) {
                normalizedRolls = Array.from(
                    new Set(
                        body.allowedRollNumbers
                            .map((r: any) => String(r).trim().toUpperCase())
                            .filter(Boolean)
                    )
                );
            } else if (!isRestrictedMode) {
                normalizedRolls = Prisma.JsonNull;
            } else {
                normalizedRolls = body.allowedRollNumbers;
            }
        }

        const allowAlumniVal = body.allowAlumni !== undefined && body.allowAlumni !== null
            ? Boolean(body.allowAlumni)
            : existing.allowAlumni;

        const setting = await prisma.examApplicationSetting.update({
            where: { id },
            data: {
                name: body.name !== undefined ? (body.name || null) : existing.name,
                type: body.type !== undefined ? body.type : existing.type,
                year,
                semester,
                startDate,
                endDate,
                lateFeeEndDate,
                academicYearId: body.academicYearId !== undefined ? (body.academicYearId || null) : existing.academicYearId,
                regularFee: body.regularFee !== undefined ? (body.regularFee || null) : existing.regularFee,
                circularFileUrl: body.circularFileUrl !== undefined ? (body.circularFileUrl || null) : existing.circularFileUrl,
                accessMode: effectiveAccessMode,
                ...(normalizedRolls !== undefined ? { allowedRollNumbers: normalizedRolls } : {}),
                allowAlumni: allowAlumniVal,
                holdMessage: body.holdMessage !== undefined ? (body.holdMessage || "Your exam application is kept on hold, please contact the OFFICE.") : existing.holdMessage
            },
            include: { academicYear: true }
        });

        return NextResponse.json(setting);
    } catch (error) {
        console.error("Update setting error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
