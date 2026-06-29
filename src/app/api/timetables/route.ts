import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sectionId = searchParams.get("sectionId");
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
                year: isBSH ? "1" : undefined,
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
        const { departmentId, year, semester, sectionId, entries } = body;

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

        const now = new Date();

        // Wrap in transaction to ensure consistency
        await prisma.$transaction(async (tx) => {
            // Mark existing active timetables for this section as outdated
            await tx.timetable.updateMany({
                where: {
                    sectionId,
                    validTo: null
                },
                data: {
                    validTo: now
                }
            });

            // Insert new timetable entries
            // The frontend now sends entries as an array of structured mappings per period block
            const recordsToInsert: any[] = [];
            for (const entry of entries) {
                // entry contains dayOfWeek, periodId, and an array of 'blocks'
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
                        validFrom: now,
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

        return NextResponse.json({ success: true, message: "Timetable updated successfully" });
    } catch (error: any) {
        console.error("Timetable POST Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
