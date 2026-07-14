import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";
import { logActivity } from "@/lib/logging";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sectionId = searchParams.get("sectionId");
        const year = searchParams.get("year") || undefined;
        const semester = searchParams.get("semester") || undefined;
        const dateStr = searchParams.get("date");

        if (!sectionId) {
            return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        const isBSH = isBSHHod(session?.user as any);

        let dateCondition = {};
        if (dateStr) {
            const date = new Date(dateStr);
            dateCondition = {
                validFrom: { lte: date },
                OR: [
                    { validTo: null },
                    { validTo: { gt: date } }
                ]
            };
        } else {
            // Default to currently active (validTo is null)
            dateCondition = {
                validTo: null
            };
        }

        const timetables = await prisma.timetable.findMany({
            where: {
                sectionId,
                // Scope to exact year+semester when provided so different years don't bleed
                year: isBSH ? "1" : (year || undefined),
                semester: semester || undefined,
                ...dateCondition
            },
            include: {
                subject: true,
                period: true
            }
        });

        return NextResponse.json(timetables);
    } catch (error: any) {
        console.error("Timetable GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId: userDeptId } = session.user as any;
    const isBSH = isBSHHod(session.user);

    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { departmentId, year, semester, sectionId, entries, activationDate } = body;

        if (!departmentId || !year || !semester || !sectionId || !entries) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Enforce scoping
        if (role === "HOD") {
            if (isBSH) {
                if (year !== "1") {
                    return NextResponse.json({ error: "BSH HOD can only manage Year 1 timetables" }, { status: 403 });
                }
            } else {
                if (departmentId !== userDeptId) {
                    return NextResponse.json({ error: "You can only manage timetables for your own department" }, { status: 403 });
                }
            }
        }

        let activeDate = new Date();
        if (activationDate) {
            const [y, m, d] = activationDate.split("-").map(Number);
            activeDate = new Date(y, m - 1, d, 0, 0, 0, 0);
        }

        // Wrap in transaction to ensure consistency
        await prisma.$transaction(async (tx) => {
            // Mark existing active timetables for this EXACT section+year+semester as outdated
            // (Do NOT touch other years/semesters for the same section)
            await tx.timetable.updateMany({
                where: {
                    sectionId,
                    year,
                    semester,
                    validTo: null
                },
                data: {
                    validTo: activeDate
                }
            });

            // Insert new timetable entries
            const recordsToInsert: any[] = [];
            for (const entry of entries) {
                for (const block of entry.blocks) {
                    recordsToInsert.push({
                        departmentId,
                        year,
                        semester,
                        sectionId,
                        dayOfWeek: entry.dayOfWeek,
                        periodId: entry.periodId,
                        subjectId: block.subjectId || null,
                        labBatchId: block.labBatchId || null,
                        electiveSlotId: block.electiveSlotId || null,
                        isLab: block.isLab || false,
                        isLunch: block.isLunch || false,
                        validFrom: activeDate,
                        validTo: null
                    });
                }
            }

            if (recordsToInsert.length > 0) {
                await tx.timetable.createMany({
                    data: recordsToInsert
                });
            }
        });

        // Audit Log for Timetable Update
        await logActivity(
            (session.user as any).id,
            "UPDATE",
            "Timetable",
            sectionId,
            {
                departmentId,
                year,
                semester,
                entryCount: entries.length
            }
        );

        return NextResponse.json({ success: true, message: "Timetable updated successfully" });
    } catch (error: any) {
        console.error("Timetable POST Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
