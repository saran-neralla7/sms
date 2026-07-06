import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET assignment marks for a section/subject
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

    // Get students
    const students = await prisma.student.findMany({
      where: {
        year,
        semester,
        sectionId,
        departmentId: subject.departmentId,
        isAlumni: false,
        isLeftCollege: false,
        isDetained: false,
      },
      select: { id: true, rollNumber: true, name: true },
      orderBy: { rollNumber: "asc" }
    });

    // Get existing assignment marks
    const marks = await prisma.assignmentMark.findMany({
      where: { academicYearId, year, semester, sectionId, subjectId }
    });

    const marksMap: Record<string, any> = {};
    for (const m of marks) marksMap[m.studentId] = m;

    const rows = students.map(s => ({
      studentId: s.id,
      rollNumber: s.rollNumber,
      name: s.name,
      marksObtained: marksMap[s.id]?.marksObtained ?? null,
      maxMarks: marksMap[s.id]?.maxMarks ?? 10,
      isDraft: marksMap[s.id]?.isDraft ?? true,
      recordId: marksMap[s.id]?.id ?? null,
    }));

    return NextResponse.json({ rows, subjectId, sectionId });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load assignment marks" }, { status: 500 });
  }
}

// POST — save/update assignment marks (bulk upsert)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { academicYearId, departmentId, year, semester, sectionId, subjectId, entries, isDraft = true } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId || !entries) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const maxAllowed = 10;
    const errors: string[] = [];

    for (const entry of entries) {
      if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
        if (entry.marksObtained < 0 || entry.marksObtained > (entry.maxMarks ?? maxAllowed)) {
          errors.push(`Invalid marks ${entry.marksObtained} for student ${entry.rollNumber}`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    let saved = 0;
    for (const entry of entries) {
      if (entry.marksObtained === null || entry.marksObtained === undefined) continue;

      // Resolve individual student's departmentId to satisfy the compound key constraint
      const student = await prisma.student.findUnique({
        where: { id: entry.studentId },
        select: { departmentId: true }
      });
      const resolvedDeptId = student?.departmentId || departmentId;

      await prisma.assignmentMark.upsert({
        where: {
          academicYearId_departmentId_year_semester_sectionId_subjectId_studentId: {
            academicYearId,
            departmentId: resolvedDeptId,
            year,
            semester,
            sectionId,
            subjectId,
            studentId: entry.studentId,
          }
        },
        create: {
          academicYearId,
          departmentId: resolvedDeptId,
          year,
          semester,
          sectionId,
          subjectId,
          studentId: entry.studentId,
          marksObtained: entry.marksObtained,
          maxMarks: entry.maxMarks ?? 10,
          enteredById: session.user.id,
          isDraft,
        },
        update: {
          marksObtained: entry.marksObtained,
          maxMarks: entry.maxMarks ?? 10,
          enteredById: session.user.id,
          isDraft,
          updatedAt: new Date(),
        }
      });
      saved++;
    }

    return NextResponse.json({ success: true, saved });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save assignment marks" }, { status: 500 });
  }
}
