import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET existing lab marks for a given section & subject (examType === "LAB")
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const academicYearId = searchParams.get("academicYearId");
  const departmentId = searchParams.get("departmentId");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const sectionId = searchParams.get("sectionId");
  const subjectId = searchParams.get("subjectId");

  if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId) {
    return NextResponse.json({ error: "All filters required" }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { departmentId: true }
    });
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    // Get active students mapped to this section & subject department
    const students = await prisma.student.findMany({
      where: {
        year,
        semester,
        sectionId,
        departmentId: subject.departmentId,
        isAlumni: false,
      },
      select: { id: true, rollNumber: true, name: true },
      orderBy: { rollNumber: "asc" }
    });

    // Get existing internal marks with examType = "LAB"
    const marks = await prisma.internalMark.findMany({
      where: {
        academicYearId,
        subjectId,
        examType: "LAB",
        studentId: { in: students.map(s => s.id) }
      }
    });

    const marksMap: Record<string, any> = {};
    for (const m of marks) marksMap[m.studentId] = m;

    const rows = students.map(s => ({
      studentId: s.id,
      rollNumber: s.rollNumber,
      name: s.name,
      marksObtained: marksMap[s.id]?.marksObtained ?? null,
      maxMarks: 50,
      recordId: marksMap[s.id]?.id ?? null,
    }));

    return NextResponse.json({ rows, subjectId, sectionId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load lab marks" }, { status: 500 });
  }
}

// POST — batch upsert lab marks into InternalMark model directly
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { academicYearId, departmentId, year, semester, sectionId, subjectId, entries } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId || !entries) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const errors: string[] = [];
    for (const entry of entries) {
      if (entry.marksObtained !== null && entry.marksObtained !== undefined && entry.marksObtained !== "") {
        const val = Number(entry.marksObtained);
        if (isNaN(val) || val < 0 || val > 50) {
          errors.push(`Invalid marks ${entry.marksObtained} for student ${entry.rollNumber}. Must be between 0 and 50.`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    let saved = 0;
    for (const entry of entries) {
      if (entry.marksObtained === null || entry.marksObtained === undefined || entry.marksObtained === "") {
        // If empty, we can skip or delete if exists. Let's skip to prevent deleting partial drafts
        continue;
      }

      await prisma.internalMark.upsert({
        where: {
          studentId_subjectId_academicYearId_examType: {
            studentId: entry.studentId,
            subjectId,
            academicYearId,
            examType: "LAB",
          }
        },
        create: {
          studentId: entry.studentId,
          subjectId,
          academicYearId,
          examType: "LAB",
          marksObtained: Number(entry.marksObtained),
          maxMarks: 50,
          recordedById: session.user.id,
        },
        update: {
          marksObtained: Number(entry.marksObtained),
          maxMarks: 50,
          recordedById: session.user.id,
          updatedAt: new Date(),
        }
      });
      saved++;
    }

    return NextResponse.json({ success: true, saved });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save lab marks" }, { status: 500 });
  }
}
