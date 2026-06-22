import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeSemester(sem: string | null): string {
  if (!sem) return "";
  const s = sem.trim().toUpperCase();
  if (s === "I" || s === "1" || s === "1ST" || s === "FIRST") return "1";
  if (s === "II" || s === "2" || s === "2ND" || s === "SECOND") return "2";
  return s;
}

function normalizeYear(yr: string | null): string {
  if (!yr) return "";
  const y = yr.trim().toUpperCase();
  if (y === "I" || y === "1" || y === "1ST" || y === "FIRST") return "1";
  if (y === "II" || y === "2" || y === "2ND" || y === "SECOND") return "2";
  if (y === "III" || y === "3" || y === "3RD" || y === "THIRD") return "3";
  if (y === "IV" || y === "4" || y === "4TH" || y === "FOURTH") return "4";
  return y;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const academicYearId = searchParams.get("academicYearId");
    const departmentId = searchParams.get("departmentId");
    let year = searchParams.get("year");
    let semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");
    const subjectId = searchParams.get("subjectId");

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId) {
      return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
    }

    // Normalize
    year = normalizeYear(year);
    semester = normalizeSemester(semester);

    // 1. Fetch CourseFile metadata
    const courseFile = await prisma.courseFile.findUnique({
      where: {
        academicYearId_departmentId_year_semester_sectionId_subjectId: {
          academicYearId,
          departmentId,
          year,
          semester,
          sectionId,
          subjectId
        }
      }
    });

    // 2. Fetch subject and its syllabus (Item 1 & 2)
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { department: true }
    });

    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId }
    });

    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    // 3. Fetch CO-PO/PSO mappings (Item 3)
    const coPoMappings = await prisma.subjectCoPoMapping.findMany({
      where: { subjectId },
      orderBy: [{ co: "asc" }, { po: "asc" }]
    });
    const coPsoMappings = await prisma.subjectCoPsoMapping.findMany({
      where: { subjectId },
      orderBy: [{ co: "asc" }, { pso: "asc" }]
    });

    // 4. Fetch registered students (Item 6)
    const students = await prisma.student.findMany({
      where: {
        sectionId,
        departmentId,
        year,
        semester
      },
      orderBy: { rollNumber: "asc" }
    });
    const studentIds = students.map(s => s.id);

    // 5. Fetch Faculty Timetable for this subject and section (Item 7)
    const timetable = await prisma.timetable.findMany({
      where: {
        sectionId,
        subjectId
      },
      include: {
        period: true
      },
      orderBy: [
        { dayOfWeek: "asc" },
        { period: { name: "asc" } }
      ]
    });

    // 6. Fetch Mid exam papers (Items 10, 15) and marks (Items 12, 17)
    const mid1PaperRaw = await prisma.midExamPaper.findFirst({
      where: { academicYearId, departmentId, year, semester, sectionId, subjectId, examType: "MID_I" },
      include: {
        questions: {
          include: {
            subQuestions: true
          }
        },
        publishRecord: true
      }
    });

    const mid2PaperRaw = await prisma.midExamPaper.findFirst({
      where: { academicYearId, departmentId, year, semester, sectionId, subjectId, examType: "MID_II" },
      include: {
        questions: {
          include: {
            subQuestions: true
          }
        },
        publishRecord: true
      }
    });

    // Fetch Choice Groups
    const choiceGroups1 = mid1PaperRaw ? await prisma.midExamChoiceGroup.findMany({
      where: { paperId: mid1PaperRaw.id },
      include: { questions: { include: { subQuestions: true } } }
    }) : [];

    const choiceGroups2 = mid2PaperRaw ? await prisma.midExamChoiceGroup.findMany({
      where: { paperId: mid2PaperRaw.id },
      include: { questions: { include: { subQuestions: true } } }
    }) : [];

    const mid1Paper = mid1PaperRaw ? { ...mid1PaperRaw, choiceGroups: choiceGroups1 } : null;
    const mid2Paper = mid2PaperRaw ? { ...mid2PaperRaw, choiceGroups: choiceGroups2 } : null;

    // Marks entry records for MID_I and MID_II
    const mid1Marks = mid1Paper ? await prisma.midExamMarksEntry.findMany({
      where: { paperId: mid1Paper.id }
    }) : [];

    const mid2Marks = mid2Paper ? await prisma.midExamMarksEntry.findMany({
      where: { paperId: mid2Paper.id }
    }) : [];

    // 7. Fetch final sessional marks (Item 20)
    const internalMarks = await prisma.internalMark.findMany({
      where: {
        academicYearId,
        subjectId,
        studentId: { in: studentIds }
      }
    });

    // 8. Fetch assignment marks (if any)
    const assignmentMarks = await prisma.assignmentMark.findMany({
      where: { academicYearId, departmentId, year, semester, sectionId, subjectId }
    });

    // 9. Fetch SemesterResult for students in this subject (Item 22)
    const semesterResults = await prisma.semesterResult.findMany({
      where: {
        studentId: { in: studentIds },
        year,
        semester
      }
    });

    return NextResponse.json({
      courseFile,
      academicYear,
      department,
      subject,
      coPoMappings,
      coPsoMappings,
      students,
      timetable,
      mid1Paper,
      mid2Paper,
      mid1Marks,
      mid2Marks,
      internalMarks,
      assignmentMarks,
      semesterResults
    });
  } catch (error: any) {
    console.error("Error in GET /api/course-files:", error);
    return NextResponse.json({ error: error.message || "Failed to load course file data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let {
      academicYearId,
      departmentId,
      year,
      semester,
      sectionId,
      subjectId,
      facultyId,
      teachingSupportText,
      assignmentQuestions,
      lecturePlan,
      remedialClasses,
      academicCalendarPath,
      mid1SchemePath,
      mid2SchemePath,
      prevPapersPaths
    } = body;

    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId || !facultyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize
    year = normalizeYear(year);
    semester = normalizeSemester(semester);

    const courseFile = await prisma.courseFile.upsert({
      where: {
        academicYearId_departmentId_year_semester_sectionId_subjectId: {
          academicYearId,
          departmentId,
          year,
          semester,
          sectionId,
          subjectId
        }
      },
      update: {
        facultyId,
        teachingSupportText,
        assignmentQuestions,
        lecturePlan,
        remedialClasses,
        academicCalendarPath,
        mid1SchemePath,
        mid2SchemePath,
        prevPapersPaths
      },
      create: {
        academicYearId,
        departmentId,
        year,
        semester,
        sectionId,
        subjectId,
        facultyId,
        teachingSupportText,
        assignmentQuestions,
        lecturePlan,
        remedialClasses,
        academicCalendarPath,
        mid1SchemePath,
        mid2SchemePath,
        prevPapersPaths
      }
    });

    return NextResponse.json({ success: true, courseFile });
  } catch (error: any) {
    console.error("Error in POST /api/course-files:", error);
    return NextResponse.json({ error: error.message || "Failed to save course file" }, { status: 500 });
  }
}
