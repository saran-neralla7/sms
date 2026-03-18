import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sectionId = searchParams.get("sectionId");
        const dateStr = searchParams.get("date");

        if (!sectionId) {
            return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
        }

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
    try {
        const body = await request.json();
        const { departmentId, year, semester, sectionId, entries } = body;

        if (!departmentId || !year || !semester || !sectionId || !entries) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
