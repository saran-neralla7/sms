import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAttainments } from "@/lib/attainments";
import { getStudentsForClass } from "@/lib/student-utils";

// ──────────────────────────────────────────────────────────────
// Helpers shared with main course-files route
// ──────────────────────────────────────────────────────────────
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

function gradeToPercent(grade: string): number | null {
  const map: Record<string, number> = {
    "A+": 100, "A": 90, "B": 80, "C": 70, "D": 60, "E": 50, "F": 39,
  };
  return map[(grade || "").trim().toUpperCase()] ?? null;
}

function flattenSubQuestions(paper: any): { id: string; coMapping: string; maxMarks: number }[] {
  if (!paper) return [];
  const out: { id: string; coMapping: string; maxMarks: number }[] = [];
  const questions = paper.masterPaper?.questions ?? paper.questions ?? [];
  for (const q of questions) {
    for (const sq of q.subQuestions ?? []) {
      out.push({ id: sq.id, coMapping: sq.coMapping, maxMarks: sq.maxMarks });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// GET  /api/course-files/rollup
// Params: academicYearId, departmentId, year, semester, sectionId
// Returns batch-level attainment data for every subject + saved survey
// ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sp = req.nextUrl.searchParams;
    const academicYearId = sp.get("academicYearId");
    const departmentId   = sp.get("departmentId");
    let year             = sp.get("year");
    let semester         = sp.get("semester");
    const sectionId      = sp.get("sectionId");

    if (!academicYearId || !departmentId || !year || !semester || !sectionId) {
      return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
    }

    year     = normalizeYear(year);
    semester = normalizeSemester(semester);

    // 1. All subjects for this section
    const subjects = await prisma.subject.findMany({
      where: { departmentId, year, semester },
    });

    // 2. Students in batch
    const students = await getStudentsForClass({
      academicYearId,
      departmentId,
      year,
      semester,
      sectionId,
    });
    const studentIds = students.map((s) => s.id);

    // 3. Semester results
    const semesterResults = await prisma.semesterResult.findMany({
      where: { studentId: { in: studentIds }, year, semester },
    });

    // 4. Saved ProgramSurvey
    const programSurvey = await prisma.programSurvey.findUnique({
      where: { academicYearId_departmentId_year_semester: { academicYearId, departmentId, year, semester } },
    });

    // 5. Faculty mappings (to know who teaches what)
    const facultyMappings = await prisma.facultySubjectMapping.findMany({
      where: { academicYearId, sectionId, subjectId: { in: subjects.map((s) => s.id) } },
      include: { faculty: { select: { empName: true } } },
    });

    // 6. Per-subject attainment computation
    const subjectRollups: any[] = [];

    for (const subject of subjects) {
      // Course file settings
      const courseFile = await prisma.courseFile.findUnique({
        where: {
          academicYearId_departmentId_year_semester_sectionId_subjectId: {
            academicYearId, departmentId, year, semester, sectionId, subjectId: subject.id,
          },
        },
      });

      const benchmarkPct    = (courseFile as any)?.benchmarkPct ?? 50;
      const decimalPlaces   = (courseFile as any)?.attainmentDecimal ?? 2;

      // CO list from syllabus
      const syllabus = subject.syllabus as any;
      const coList: string[] =
        syllabus && Array.isArray(syllabus?.outcomes) && syllabus.outcomes.length > 0
          ? syllabus.outcomes.map((o: any) => o.code)
          : ["CO1", "CO2", "CO3", "CO4", "CO5"];

      // Mid papers
      const mid1Paper = await prisma.midExamPaper.findFirst({
        where: { academicYearId, departmentId, year, semester, sectionId, subjectId: subject.id, examType: "MID_I" },
        include: { questions: { include: { subQuestions: true } }, masterPaper: { include: { questions: { include: { subQuestions: true } } } } },
      });
      const mid2Paper = await prisma.midExamPaper.findFirst({
        where: { academicYearId, departmentId, year, semester, sectionId, subjectId: subject.id, examType: "MID_II" },
        include: { questions: { include: { subQuestions: true } }, masterPaper: { include: { questions: { include: { subQuestions: true } } } } },
      });

      // Marks
      const mid1Marks = mid1Paper
        ? await prisma.midExamMarksEntry.findMany({ where: { paperId: mid1Paper.id } })
        : [];
      const mid2Marks = mid2Paper
        ? await prisma.midExamMarksEntry.findMany({ where: { paperId: mid2Paper.id } })
        : [];

      // CO-PO / CO-PSO mappings
      const coPoMappings = await prisma.subjectCoPoMapping.findMany({
        where: { subjectId: subject.id },
        orderBy: [{ co: "asc" }, { po: "asc" }],
      });
      const coPsoMappings = await prisma.subjectCoPsoMapping.findMany({
        where: { subjectId: subject.id },
        orderBy: [{ co: "asc" }, { pso: "asc" }],
      });

      const allMarks = [...(mid1Marks as any[]), ...(mid2Marks as any[])];

      const attainment = computeAttainments({
        coList,
        mid1SubQuestions: flattenSubQuestions(mid1Paper),
        mid2SubQuestions: flattenSubQuestions(mid2Paper),
        allMarks,
        benchmarkPct,
        coPoMappings: coPoMappings as any[],
        coPsoMappings: coPsoMappings as any[],
        decimalPlaces,
        students: students as any[],
        semesterResults: semesterResults as any[],
        subjectCode: subject.code,
      });

      // Average mapping weight per PO (for target = avgMapping * 0.85)
      const avgMappingPO: Record<string, number> = {};
      const PO_LIST = ["PO1","PO2","PO3","PO4","PO5","PO6","PO7","PO8","PO9","PO10","PO11","PO12"];
      for (const po of PO_LIST) {
        const cells = coPoMappings.filter((m) => m.po === po && m.weight != null && (m.weight ?? 0) > 0);
        if (cells.length > 0) {
          avgMappingPO[po] = cells.reduce((s, m) => s + (m.weight ?? 0), 0) / cells.length;
        }
      }

      const PSO_LIST = ["PSO1","PSO2","PSO3"];
      const avgMappingPSO: Record<string, number> = {};
      for (const pso of PSO_LIST) {
        const cells = coPsoMappings.filter((m) => m.pso === pso && m.weight != null && (m.weight ?? 0) > 0);
        if (cells.length > 0) {
          avgMappingPSO[pso] = cells.reduce((s, m) => s + (m.weight ?? 0), 0) / cells.length;
        }
      }

      const fm = facultyMappings.find((m) => m.subjectId === subject.id);

      subjectRollups.push({
        subjectId:       subject.id,
        subjectCode:     subject.code,
        subjectName:     subject.name,
        facultyName:     fm?.faculty?.empName ?? "—",
        benchmarkPct,
        decimalPlaces,
        poAttainments:   attainment.poAttainments,
        psoAttainments:  attainment.psoAttainments,
        coResults:       attainment.coResults,
        avgMappingPO,
        avgMappingPSO,
        coPoMappings,
        coPsoMappings,
      });
    }

    return NextResponse.json({
      subjects: subjectRollups,
      programSurvey: programSurvey
        ? { poRatings: programSurvey.poRatings, psoRatings: programSurvey.psoRatings }
        : { poRatings: {}, psoRatings: {} },
      meta: { academicYearId, departmentId, year, semester, sectionId },
    });
  } catch (err: any) {
    console.error("GET /api/course-files/rollup error:", err);
    return NextResponse.json({ error: err.message || "Failed to load rollup data" }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────
// POST  /api/course-files/rollup
// Body: { academicYearId, departmentId, year, semester, poRatings, psoRatings }
// Saves or updates ProgramSurvey
// ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    let { academicYearId, departmentId, year, semester, poRatings, psoRatings } = body;

    if (!academicYearId || !departmentId || !year || !semester) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    year     = normalizeYear(year);
    semester = normalizeSemester(semester);

    const survey = await prisma.programSurvey.upsert({
      where: { academicYearId_departmentId_year_semester: { academicYearId, departmentId, year, semester } },
      update: { poRatings: poRatings ?? {}, psoRatings: psoRatings ?? {} },
      create: { academicYearId, departmentId, year, semester, poRatings: poRatings ?? {}, psoRatings: psoRatings ?? {} },
    });

    return NextResponse.json({ success: true, survey });
  } catch (err: any) {
    console.error("POST /api/course-files/rollup error:", err);
    return NextResponse.json({ error: err.message || "Failed to save survey" }, { status: 500 });
  }
}
