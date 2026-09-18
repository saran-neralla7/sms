import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsForClass } from "@/lib/student-utils";

// GET assignment marks for a section/subject
// Supports querying by specific assignmentId OR default aggregated view
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
  const assignmentId = searchParams.get("assignmentId");

  if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId) {
    return NextResponse.json({ error: "All filters required" }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { departmentId: true, isElective: true }
    });
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    // Get active assignments for this class
    const assignments = await prisma.assignment.findMany({
      where: {
        academicYearId,
        year,
        semester,
        sectionId,
        subjectId
      },
      orderBy: { createdAt: "asc" }
    });

    // Get students
    const students = await getStudentsForClass({
      academicYearId,
      departmentId: subject.isElective ? undefined : subject.departmentId,
      year,
      semester,
      sectionId,
      subjectId,
      include: {
        department: { select: { code: true } },
        section: { select: { name: true } }
      }
    });

    // Filter marks by assignmentId if specified
    const marksQuery: any = {
      academicYearId,
      year,
      semester,
      sectionId,
      subjectId
    };
    if (assignmentId && assignmentId !== "ALL") {
      marksQuery.assignmentId = assignmentId;
    }

    const marks = await prisma.assignmentMark.findMany({
      where: marksQuery
    });

    // Compute scaled marks if viewing ALL or compute single assignment mark
    const rows = students.map(s => {
      const studentMarks = marks.filter(m => m.studentId === s.id);

      if (assignmentId && assignmentId !== "ALL") {
        const m = studentMarks.find(mark => mark.assignmentId === assignmentId) || studentMarks[0];
        return {
          studentId: s.id,
          rollNumber: s.rollNumber,
          name: s.name,
          marksObtained: m?.marksObtained ?? null,
          maxMarks: m?.maxMarks ?? 10,
          status: m?.status || "NOT_SUBMITTED",
          isDraft: m?.isDraft ?? true,
          recordId: m?.id ?? null,
        };
      }

      // If viewing aggregated view across assignments:
      // Score_k = (marksObtained_k / totalMarks_k) * 10
      // Final = min(10, Math.ceil(Average of Score_k))
      let calculatedFinal: number | null = null;
      if (studentMarks.length > 0) {
        const validScores = studentMarks
          .filter(m => m.marksObtained !== null && m.marksObtained !== undefined)
          .map(m => (m.marksObtained! / (m.maxMarks || 10)) * 10);

        if (validScores.length > 0) {
          const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
          calculatedFinal = Math.min(10, Math.ceil(avg));
        }
      }

      const primary = studentMarks[0];
      return {
        studentId: s.id,
        rollNumber: s.rollNumber,
        name: s.name,
        marksObtained: primary?.marksObtained ?? null,
        calculatedFinal,
        maxMarks: primary?.maxMarks ?? 10,
        status: primary?.status || "NOT_SUBMITTED",
        isDraft: primary?.isDraft ?? true,
        recordId: primary?.id ?? null,
      };
    });

    return NextResponse.json({
      rows,
      assignments,
      subjectId,
      sectionId
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load assignment marks" }, { status: 500 });
  }
}

// POST — save/update assignment marks (bulk upsert)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      academicYearId,
      departmentId,
      year,
      semester,
      sectionId,
      subjectId,
      assignmentId,
      entries,
      isDraft = true
    } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId || !entries) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const errors: string[] = [];
    for (const entry of entries) {
      if (entry.marksObtained !== null && entry.marksObtained !== undefined) {
        const maxVal = entry.maxMarks ?? 10;
        if (entry.marksObtained < 0 || entry.marksObtained > maxVal) {
          errors.push(`Invalid marks ${entry.marksObtained} for student ${entry.rollNumber} (Max: ${maxVal})`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    let saved = 0;
    for (const entry of entries) {
      const student = await prisma.student.findUnique({
        where: { id: entry.studentId },
        select: { departmentId: true }
      });
      const resolvedDeptId = student?.departmentId || departmentId;
      const effectiveAssignmentId = assignmentId && assignmentId !== "ALL" ? assignmentId : null;

      const marksVal = entry.marksObtained !== null && entry.marksObtained !== undefined ? Number(entry.marksObtained) : null;
      const status = marksVal !== null ? "SUBMITTED" : "NOT_SUBMITTED";

      if (marksVal === null) {
        await prisma.assignmentMark.deleteMany({
          where: {
            academicYearId,
            departmentId: resolvedDeptId,
            year,
            semester,
            sectionId,
            subjectId,
            studentId: entry.studentId,
            assignmentId: effectiveAssignmentId
          }
        });
        saved++;
        continue;
      }

      await prisma.assignmentMark.upsert({
        where: {
          academicYearId_departmentId_year_semester_sectionId_subjectId_studentId_assignmentId: {
            academicYearId,
            departmentId: resolvedDeptId,
            year,
            semester,
            sectionId,
            subjectId,
            studentId: entry.studentId,
            assignmentId: effectiveAssignmentId as any
          }
        },
        create: {
          assignmentId: effectiveAssignmentId,
          academicYearId,
          departmentId: resolvedDeptId,
          year,
          semester,
          sectionId,
          subjectId,
          studentId: entry.studentId,
          marksObtained: marksVal,
          maxMarks: entry.maxMarks ?? 10,
          status,
          enteredById: session.user.id,
          isDraft,
        },
        update: {
          marksObtained: marksVal,
          maxMarks: entry.maxMarks ?? 10,
          status,
          enteredById: session.user.id,
          isDraft,
          updatedAt: new Date(),
        }
      });
      saved++;
    }

    return NextResponse.json({ success: true, saved });
  } catch (e) {
    console.error("Error saving assignment marks:", e);
    return NextResponse.json({ error: "Failed to save assignment marks" }, { status: 500 });
  }
}
