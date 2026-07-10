/**
 * CO-PO / CO-PSO Attainment Calculation Library
 * Pure TypeScript — no DB calls. All data passed in as arguments.
 *
 * Formula (from co-po-attainments-final.md):
 *  Step 1: benchmarkMark = maxMarks × (benchmarkPct / 100)
 *  Step 2: passPercent per subquestion = students ≥ benchmark / students attempted × 100
 *  Step 3: internalCOScore = avg(passPercents for CO) × 0.8 + (surveyRating/3 × 100) × 0.2
 *  Step 4: Level 0-3 from score threshold
 *  Step 5: finalCOAttainment = 0.7 × uniLevel + 0.3 × internalLevel
 *  Step 6: poAttainment per PO = avg over active cells of (weight/3 × coAttainment)
 */

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface SubQuestion {
  id: string;
  coMapping: string;  // "CO1", "CO2", ...
  maxMarks: number;
}

export interface MarkEntry {
  subQuestionId: string;
  marksObtained: number | null;
  isAbsent: boolean;
}

export interface COPoMapping {
  co: string;
  po: string;
  weight: number | null;
}

export interface COPsoMapping {
  co: string;
  pso: string;
  weight: number | null;
}

export interface COAttainmentResult {
  co: string;
  // Step 2
  subQuestions: {
    id: string;
    maxMarks: number;
    benchmarkMark: number;
    studentsAttempted: number;
    studentsAboveOrEqual: number;
    passPercent: number;
  }[];
  combinedPassPct: number;     // average pass% across all subquestions for this CO (both papers)
  // Step 3
  internalScore: number;       // 0–100 blended with survey
  // Step 4
  internalLevel: 0 | 1 | 2 | 3;
  // Step 5
  universityPassPct: number | null;  // null if no uni results
  universityLevel: 0 | 1 | 2 | 3 | null;
  finalAttainment: number;     // 0–3
}

export interface AttainmentSummary {
  coResults: COAttainmentResult[];
  poAttainments: Record<string, number>;   // { PO1: 2.33, PO2: 1.67, ... }
  psoAttainments: Record<string, number>;  // { PSO1: 2.00, ... }
}

// ------------------------------------------------------------------
// Utility: Grade → percentage
// ------------------------------------------------------------------

export function gradeToPercent(grade: string): number | null {
  const g = (grade || "").trim().toUpperCase();
  const map: Record<string, number> = {
    "A+": 100,
    "A":  90,
    "B":  80,
    "C":  70,
    "D":  60,
    "E":  50,
    "F":  39,
  };
  return map[g] ?? null;
}

// ------------------------------------------------------------------
// Utility: Score → Level 0–3
// ------------------------------------------------------------------

export function mapScoreToLevel(score: number): 0 | 1 | 2 | 3 {
  if (score >= 70) return 3;
  if (score >= 60) return 2;
  if (score >= 50) return 1;
  return 0;
}

// ------------------------------------------------------------------
// Step 1+2: Compute per-subquestion pass %
// ------------------------------------------------------------------

function computeSubQuestionPassPct(
  sq: SubQuestion,
  marks: MarkEntry[],
  benchmarkPct: number
): {
  benchmarkMark: number;
  studentsAttempted: number;
  studentsAboveOrEqual: number;
  passPercent: number;
} {
  const benchmarkMark = sq.maxMarks * (benchmarkPct / 100);
  const relevantMarks = marks.filter(
    (m) => m.subQuestionId === sq.id && !m.isAbsent
  );
  const studentsAttempted = relevantMarks.length;
  const studentsAboveOrEqual = relevantMarks.filter(
    (m) => (m.marksObtained ?? 0) >= benchmarkMark
  ).length;
  const passPercent =
    studentsAttempted > 0
      ? (studentsAboveOrEqual / studentsAttempted) * 100
      : 0;

  return { benchmarkMark, studentsAttempted, studentsAboveOrEqual, passPercent };
}

// ------------------------------------------------------------------
// Step 3: Internal CO Score (no longer blending pass % with survey rating at CO level)
// ------------------------------------------------------------------

export function computeInternalCOScore(
  combinedPassPct: number,
  surveyRating?: number  // ignored
): number {
  return combinedPassPct;
}

// ------------------------------------------------------------------
// Step 5: Final CO Attainment (blending internal + university level)
// ------------------------------------------------------------------

export function computeFinalCOAttainment(
  internalLevel: number,
  universityLevel: number | null
): number {
  if (universityLevel === null) {
    // No university results available — use internal only
    return internalLevel;
  }
  return 0.7 * universityLevel + 0.3 * internalLevel;
}

// ------------------------------------------------------------------
// Step 6: PO/PSO Attainment from CO-PO / CO-PSO mappings
// ------------------------------------------------------------------

export function computePOAttainment(
  coAttainments: Record<string, number>,
  coPoMappings: COPoMapping[],
  decimalPlaces: number
): Record<string, number> {
  const result: Record<string, { sum: number; count: number }> = {};

  for (const mapping of coPoMappings) {
    if (mapping.weight === null || mapping.weight === 0) continue;
    const coAtt = coAttainments[mapping.co] ?? 0;
    const cellAtt = (mapping.weight / 3) * coAtt;

    if (!result[mapping.po]) result[mapping.po] = { sum: 0, count: 0 };
    result[mapping.po].sum += cellAtt;
    result[mapping.po].count += 1;
  }

  const out: Record<string, number> = {};
  for (const [po, { sum, count }] of Object.entries(result)) {
    if (count === 0) continue;
    out[po] = parseFloat((sum / count).toFixed(decimalPlaces));
  }
  return out;
}

export function computePSOAttainment(
  coAttainments: Record<string, number>,
  coPsoMappings: COPsoMapping[],
  decimalPlaces: number
): Record<string, number> {
  const result: Record<string, { sum: number; count: number }> = {};

  for (const mapping of coPsoMappings) {
    if (mapping.weight === null || mapping.weight === 0) continue;
    const coAtt = coAttainments[mapping.co] ?? 0;
    const cellAtt = (mapping.weight / 3) * coAtt;

    if (!result[mapping.pso]) result[mapping.pso] = { sum: 0, count: 0 };
    result[mapping.pso].sum += cellAtt;
    result[mapping.pso].count += 1;
  }

  const out: Record<string, number> = {};
  for (const [pso, { sum, count }] of Object.entries(result)) {
    if (count === 0) continue;
    out[pso] = parseFloat((sum / count).toFixed(decimalPlaces));
  }
  return out;
}

// ------------------------------------------------------------------
// Main: Compute full attainment from raw data
// ------------------------------------------------------------------

export function computeAttainments(args: {
  coList: string[];                  // ["CO1","CO2","CO3","CO4","CO5"]
  mid1SubQuestions: SubQuestion[];   // from mid1Paper (may be empty if no paper)
  mid2SubQuestions: SubQuestion[];   // from mid2Paper
  allMarks: MarkEntry[];             // combined mid1Marks + mid2Marks
  benchmarkPct: number;              // e.g. 50
  surveyRating?: number;             // 1–3 (optional, ignored in CO calculations)
  coPoMappings: COPoMapping[];
  coPsoMappings: COPsoMapping[];
  decimalPlaces: number;
  // University: per student per subject grade
  students: { id: string }[];
  semesterResults: { studentId: string; grades: unknown }[];
  subjectCode: string;
}): AttainmentSummary {
  const {
    coList, mid1SubQuestions, mid2SubQuestions, allMarks,
    benchmarkPct, surveyRating, coPoMappings, coPsoMappings,
    decimalPlaces, students, semesterResults, subjectCode,
  } = args;

  // Combine all subquestions from both papers
  const allSubQuestions = [...mid1SubQuestions, ...mid2SubQuestions];

  // Build university grade map: studentId → percentage
  const uniPctMap: Record<string, number | null> = {};
  for (const student of students) {
    const result = semesterResults.find((r) => r.studentId === student.id);
    if (!result || !result.grades) {
      uniPctMap[student.id] = null;
      continue;
    }
    const gradesArr = Array.isArray(result.grades) ? result.grades : [];
    const entry = gradesArr.find((g: any) => {
      const dbCode = (g.subjectCode || "").trim().toUpperCase();
      const targetCode = subjectCode.trim().toUpperCase();
      return dbCode === targetCode || dbCode.split(" - ")[0].trim() === targetCode;
    });
    uniPctMap[student.id] = entry ? gradeToPercent(entry.grade) : null;
  }

  // Determine if we have any uni results
  const hasUniResults = Object.values(uniPctMap).some((v) => v !== null);

  const coResults: COAttainmentResult[] = [];
  const coAttainmentMap: Record<string, number> = {};

  for (const co of coList) {
    // Subquestions for this CO
    const coSubQuestions = allSubQuestions.filter((sq) => sq.coMapping === co);

    const subDetails = coSubQuestions.map((sq) => {
      const { benchmarkMark, studentsAttempted, studentsAboveOrEqual, passPercent } =
        computeSubQuestionPassPct(sq, allMarks, benchmarkPct);
      return {
        id: sq.id,
        maxMarks: sq.maxMarks,
        benchmarkMark,
        studentsAttempted,
        studentsAboveOrEqual,
        passPercent,
      };
    });

    // Combined pass % = average of all subquestion pass %s for this CO
    const combinedPassPct =
      subDetails.length > 0
        ? subDetails.reduce((s, d) => s + d.passPercent, 0) / subDetails.length
        : 0;

    // Step 3: Internal CO score
    const internalScore = computeInternalCOScore(combinedPassPct, surveyRating);

    // Step 4: Internal level
    const internalLevel = mapScoreToLevel(internalScore);

    // Step 5: University
    let universityPassPct: number | null = null;
    let universityLevel: 0 | 1 | 2 | 3 | null = null;

    if (hasUniResults) {
      const studentsWithGrades = students.filter((s) => uniPctMap[s.id] !== null);
      if (studentsWithGrades.length > 0) {
        const passCount = studentsWithGrades.filter(
          (s) => (uniPctMap[s.id] ?? 0) >= benchmarkPct
        ).length;
        universityPassPct = (passCount / studentsWithGrades.length) * 100;
        universityLevel = mapScoreToLevel(universityPassPct);
      }
    }

    const finalAttainment = computeFinalCOAttainment(internalLevel, universityLevel);
    coAttainmentMap[co] = finalAttainment;

    coResults.push({
      co,
      subQuestions: subDetails,
      combinedPassPct,
      internalScore,
      internalLevel,
      universityPassPct,
      universityLevel,
      finalAttainment,
    });
  }

  const poAttainments = computePOAttainment(coAttainmentMap, coPoMappings, decimalPlaces);
  const psoAttainments = computePSOAttainment(coAttainmentMap, coPsoMappings, decimalPlaces);

  return { coResults, poAttainments, psoAttainments };
}
