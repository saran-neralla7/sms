import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal, calculateInternalMarks, scaleMidMarks } from "@/lib/mid-exam-calc";

/**
 * GET — generate Internal Marks Memo data for PDF rendering on client
 * Returns structured data; PDF is generated client-side with jsPDF
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const academicYearId = searchParams.get("academicYearId");
  const departmentId = searchParams.get("departmentId");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const sectionId = searchParams.get("sectionId");

  if (!academicYearId || !departmentId || !year || !semester || !sectionId) {
    return NextResponse.json({ error: "All filters required" }, { status: 400 });
  }

  try {
    const [students, academicYear, department, section, subjects] = await Promise.all([
      prisma.student.findMany({
        where: { departmentId, year, semester, sectionId, isAlumni: false },
        select: { id: true, rollNumber: true, name: true },
        orderBy: { rollNumber: "asc" }
      }),
      prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } }),
      prisma.department.findUnique({ where: { id: departmentId }, select: { name: true, code: true } }),
      prisma.section.findUnique({ where: { id: sectionId }, select: { name: true } }),
      prisma.subject.findMany({
        where: { departmentId, year, semester },
        select: { id: true, name: true, code: true, shortName: true, type: true },
        orderBy: { code: "asc" }
      })
    ]);

    const studentIds = students.map(s => s.id);
    const subjectIds = subjects.map(s => s.id);

    // Get internal marks (from existing InternalMark table — published values)
    const internalMarks = await prisma.internalMark.findMany({
      where: {
        academicYearId,
        studentId: { in: studentIds },
        subjectId: { in: subjectIds }
      }
    });

    // Get assignment marks
    const assignmentMarks = await prisma.assignmentMark.findMany({
      where: {
        academicYearId, departmentId, year, semester, sectionId,
        studentId: { in: studentIds }
      }
    });

    // Build data grid
    const rows = students.map(student => {
      const subjectData: Record<string, any> = {};

      for (const subject of subjects) {
        const mid1 = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === "MID_I");
        const mid2 = internalMarks.find(m => m.studentId === student.id && m.subjectId === subject.id && m.examType === "MID_II");
        const assign = assignmentMarks.find(m => m.studentId === student.id && m.subjectId === subject.id);

        const mid1Marks = mid1?.marksObtained ?? null;
        const mid2Marks = mid2?.marksObtained ?? null;
        const assignMarks = assign?.marksObtained ?? null;

        const mid1Scaled = mid1Marks !== null ? scaleMidMarks(mid1Marks, mid1?.maxMarks ?? 30, 20) : null;
        const mid2Scaled = mid2Marks !== null ? scaleMidMarks(mid2Marks, mid2?.maxMarks ?? 30, 20) : null;

        // Calculate internal using default theory scheme
        const internalTotal = calculateInternalMarks({
          mid1Total: mid1Marks,
          mid2Total: mid2Marks,
          mid1MaxMarks: mid1?.maxMarks ?? 30,
          mid2MaxMarks: mid2?.maxMarks ?? 30,
          mid1ScaledTo: 20,
          mid2ScaledTo: 20,
          assignmentMarks: assignMarks,
          assignmentMax: 10,
          internalMax: 30,
          subjectType: subject.type?.toUpperCase() === "LAB" ? "LAB" : "THEORY",
        });

        subjectData[subject.id] = {
          mid1: mid1Marks,
          mid2: mid2Marks,
          mid1Scaled,
          mid2Scaled,
          assignment: assignMarks,
          internal: internalTotal,
        };
      }

      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        subjects: subjectData,
      };
    });

    return NextResponse.json({
      meta: {
        academicYear: academicYear?.name,
        department: department?.name,
        departmentCode: department?.code,
        section: section?.name,
        year,
        semester,
        generatedAt: new Date().toISOString(),
      },
      subjects: subjects.map(s => ({
        id: s.id,
        name: s.name,
        code: s.code,
        shortName: s.shortName,
        type: s.type,
      })),
      rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to generate memo data" }, { status: 500 });
  }
}
