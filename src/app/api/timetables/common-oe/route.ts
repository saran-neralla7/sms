import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/logging";

// GET /api/timetables/common-oe?year=4&semester=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");

    if (!year || !semester) {
      return NextResponse.json({ error: "Missing year or semester" }, { status: 400 });
    }

    // Fetch active common Open Elective timetable entries for this year/semester (OE slots only)
    const entries = await prisma.timetable.findMany({
      where: {
        year,
        semester,
        validTo: null,
        electiveSlot: {
          OR: [
            { name: { startsWith: "OE" } },
            { name: { contains: "OPEN ELECTIVE", mode: "insensitive" } }
          ]
        }
      },
      include: {
        electiveSlot: true,
        period: true,
        department: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } }
      }
    });

    // Fetch ONLY Open Elective slots for the common OE scheduler
    const electiveSlots = await prisma.electiveSlot.findMany({
      where: {
        OR: [
          { name: { startsWith: "OE" } },
          { name: { contains: "OPEN ELECTIVE", mode: "insensitive" } }
        ]
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({ entries, electiveSlots });
  } catch (error: any) {
    console.error("GET /api/timetables/common-oe error:", error);
    return NextResponse.json({ error: "Failed to fetch common OE timetables" }, { status: 500 });
  }
}

// POST /api/timetables/common-oe
// Publishes/updates common Open Elective slot schedules across ALL department sections for a given year & semester
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role } = session.user as any;
  if (role !== "ADMIN" && role !== "HOD" && role !== "DIRECTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { year, semester, entries, activationDate } = body;

    if (!year || !semester || !Array.isArray(entries)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let activeDate = new Date();
    if (activationDate) {
      const [y, m, d] = activationDate.split("-").map(Number);
      activeDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    // Fetch valid Open Elective slot IDs
    const oeSlots = await prisma.electiveSlot.findMany({
      where: {
        OR: [
          { name: { startsWith: "OE" } },
          { name: { contains: "OPEN ELECTIVE", mode: "insensitive" } }
        ]
      },
      select: { id: true }
    });
    const validOeSlotIds = new Set(oeSlots.map((s) => s.id));

    // Fetch ALL active sections across all departments for this year & semester
    const sections = await prisma.section.findMany({
      select: {
        id: true,
        departments: {
          select: { id: true }
        }
      }
    });

    if (sections.length === 0) {
      return NextResponse.json({ error: "No sections found" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Deactivate ONLY existing common OE entries for this year & semester
      await tx.timetable.updateMany({
        where: {
          year,
          semester,
          validTo: null,
          electiveSlot: {
            OR: [
              { name: { startsWith: "OE" } },
              { name: { contains: "OPEN ELECTIVE", mode: "insensitive" } }
            ]
          }
        },
        data: {
          validTo: activeDate
        }
      });

      // 2. Prepare new OE records for EVERY section (ignoring any non-OE slot IDs)
      const recordsToInsert: any[] = [];
      for (const section of sections) {
        const deptId = section.departments[0]?.id;
        if (!deptId) continue;

        for (const entry of entries) {
          if (!entry.dayOfWeek || !entry.periodId || !entry.electiveSlotId) continue;
          if (!validOeSlotIds.has(entry.electiveSlotId)) continue; // Skip non-OE slots strictly

          recordsToInsert.push({
            departmentId: deptId,
            year,
            semester,
            sectionId: section.id,
            dayOfWeek: entry.dayOfWeek,
            periodId: entry.periodId,
            electiveSlotId: entry.electiveSlotId,
            subjectId: null,
            labBatchId: null,
            isLab: false,
            isLunch: false,
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

    await logActivity(
      (session.user as any).id,
      "UPDATE",
      "Timetable (Common OE)",
      `Year-${year}-Sem-${semester}`,
      { year, semester, entryCount: entries.length, sectionsAffected: sections.length }
    );

    return NextResponse.json({
      success: true,
      message: `Common Open Elective schedule updated successfully across all department sections.`
    });
  } catch (error: any) {
    console.error("POST /api/timetables/common-oe error:", error);
    return NextResponse.json({ error: error.message || "Failed to publish common OE timetable" }, { status: 500 });
  }
}
