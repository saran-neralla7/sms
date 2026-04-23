import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const { id } = params;

        // Fetch the faculty mappings to know their subjects and sections
        const mappings = await prisma.facultySubjectMapping.findMany({
            where: { facultyId: id },
            include: { academicYear: true }
        });

        if (!mappings.length) {
            return NextResponse.json([]);
        }

        // Get the timetable for these mappings
        // We only want the current academic year or simply all relevant ones.
        // For simplicity, we fetch timetables that match the subject and section from mappings
        
        // This could be multiple, so we construct an OR query
        const orConditions = mappings.map(mapping => ({
            subjectId: mapping.subjectId,
            sectionId: mapping.sectionId,
            // Could add year and semester if mapping has them, but mapping maps subject to section. 
            // Subject has year and semester.
        }));

        const timetables = await prisma.timetable.findMany({
            where: {
                OR: orConditions
            },
            include: {
                period: true,
                subject: true,
                section: true,
                department: true,
                labBatch: true
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { period: { order: 'asc' } }
            ]
        });

        return NextResponse.json(timetables);
    } catch (error) {
        console.error("Error fetching faculty timetable:", error);
        return NextResponse.json({ error: "Failed to fetch timetable" }, { status: 500 });
    }
}
