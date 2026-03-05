
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: List all Lab Batches for a Section (with student counts)
export async function GET(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const sectionId = params.id;
        const { searchParams } = new URL(req.url);
        const departmentId = searchParams.get("departmentId");
        const year = searchParams.get("year");
        const semester = searchParams.get("semester");

        if (!departmentId || !year || !semester) {
            return NextResponse.json({ error: "Context (Dept/Year/Sem) required" }, { status: 400 });
        }

        const batches = await prisma.labBatch.findMany({
            where: {
                sectionId,
                departmentId,
                year,
                semester
            },
            include: {
                _count: {
                    select: { students: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Get unassigned students count
        const unassignedCount = await prisma.student.count({
            where: {
                sectionId,
                departmentId,
                year,
                semester,
                labBatchId: null
            }
        });

        return NextResponse.json({ batches, unassignedCount });
    } catch (error) {
        console.error("Error fetching lab batches:", error);
        return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
    }
}

// POST: Create a new Lab Batch
export async function POST(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const sectionId = params.id;
        const { name, departmentId, year, semester } = await req.json();

        if (!name || !departmentId || !year || !semester) {
            return NextResponse.json({ error: "Name, Dept, Year, Sem are required" }, { status: 400 });
        }

        // Check limit (optional, e.g. max 5)
        const count = await prisma.labBatch.count({
            where: {
                sectionId,
                departmentId,
                year,
                semester
            }
        });

        if (count >= 5) {
            return NextResponse.json({ error: "Maximum 5 lab batches allowed per section." }, { status: 400 });
        }

        const batch = await prisma.labBatch.create({
            data: {
                name,
                sectionId,
                departmentId,
                year,
                semester
            }
        });

        return NextResponse.json(batch);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Batch name already exists in this section context." }, { status: 400 });
        }
        console.error("Error creating lab batch:", error);
        return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
    }
}
