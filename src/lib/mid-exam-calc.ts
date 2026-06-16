/**
 * MID Exam Calculation Engine
 * Handles: choice logic, scaling, internal marks formula
 */

export interface SubQuestion {
  id: string;
  subLabel: string;
  maxMarks: number;
  questionId: string;
  coMapping: string;
}

export interface Question {
  id: string;
  questionNo: number;
  isCompulsory: boolean;
  choiceGroupId: string | null;
  subQuestions: SubQuestion[];
}

export interface ChoiceGroup {
  id: string;
  groupNo: number;
  questions: Question[];
}

export interface MarksMap {
  [subQuestionId: string]: number | null; // null = absent
}

/**
 * Calculate total marks for a student, applying choice logic automatically.
 * Returns total and a map of which questions were selected in each choice group.
 */
export function calculateStudentTotal(
  questions: Question[],
  choiceGroups: ChoiceGroup[],
  marksMap: MarksMap,
  isAbsent: boolean
): { total: number; selectedChoices: Record<string, string> } {
  if (isAbsent) return { total: 0, selectedChoices: {} };

  let total = 0;
  const selectedChoices: Record<string, string> = {}; // choiceGroupId -> selected questionId

  // Process compulsory questions
  const compulsoryQuestions = questions.filter(q => q.isCompulsory && !q.choiceGroupId);
  for (const q of compulsoryQuestions) {
    for (const sq of q.subQuestions) {
      const marks = marksMap[sq.id];
      if (marks !== null && marks !== undefined) {
        total += marks;
      }
    }
  }

  // Process choice groups — pick best scoring question in each group
  for (const group of choiceGroups) {
    let bestScore = -1;
    let bestQuestionId = "";

    for (const q of group.questions) {
      let questionScore = 0;
      for (const sq of q.subQuestions) {
        const marks = marksMap[sq.id];
        if (marks !== null && marks !== undefined) {
          questionScore += marks;
        }
      }
      if (questionScore > bestScore) {
        bestScore = questionScore;
        bestQuestionId = q.id;
      }
    }

    if (bestScore > 0) {
      total += bestScore;
      selectedChoices[group.id] = bestQuestionId;
    }
  }

  return { total, selectedChoices };
}

/**
 * Scale MID marks using evaluation scheme.
 * e.g., 25/30 → scaled to /20 = 16.67
 */
export function scaleMidMarks(
  obtained: number,
  fromMax: number,
  toMax: number
): number {
  if (fromMax === 0) return 0;
  return Math.round((obtained / fromMax) * toMax);
}

/**
 * Calculate final internal marks.
 * Theory: avg(scaled MID1, scaled MID2) + assignment (capped at internalMax)
 * Lab: direct (no scaling needed, passed as-is)
 */
export function calculateInternalMarks(params: {
  mid1Total: number | null;
  mid2Total: number | null;
  mid1MaxMarks: number;
  mid2MaxMarks: number;
  mid1ScaledTo: number;
  mid2ScaledTo: number;
  assignmentMarks: number | null;
  assignmentMax: number;
  internalMax: number;
  subjectType: string;
}): number {
  const {
    mid1Total, mid2Total,
    mid1MaxMarks, mid2MaxMarks,
    mid1ScaledTo, mid2ScaledTo,
    assignmentMarks, assignmentMax,
    internalMax, subjectType
  } = params;

  if (subjectType === "LAB") {
    // For labs, internal is typically direct marks out of internalMax
    return Math.min(mid1Total ?? 0, internalMax);
  }

  // Scale both MIDs
  const scaled1 = mid1Total !== null
    ? scaleMidMarks(mid1Total, mid1MaxMarks, mid1ScaledTo)
    : 0;
  const scaled2 = mid2Total !== null
    ? scaleMidMarks(mid2Total, mid2MaxMarks, mid2ScaledTo)
    : 0;

  // Average of scaled MIDs (only include non-null)
  const available = [mid1Total !== null ? scaled1 : null, mid2Total !== null ? scaled2 : null].filter(v => v !== null) as number[];
  const avgMid = available.length > 0
    ? available.reduce((a, b) => a + b, 0) / available.length
    : 0;

  // Scale assignment
  const scaledAssignment = assignmentMarks !== null && assignmentMarks !== undefined
    ? Math.min(assignmentMarks, assignmentMax)
    : 0;

  const internal = avgMid + scaledAssignment;
  return Math.min(Math.round(internal), internalMax);
}

/**
 * Get CO-wise marks for OBE structure.
 */
export function aggregateCOMarks(
  questions: Question[],
  marksMap: MarksMap
): Record<string, { obtained: number; max: number }> {
  const coMap: Record<string, { obtained: number; max: number }> = {};

  for (const q of questions) {
    for (const sq of q.subQuestions) {
      const co = sq.coMapping || "CO1";
      if (!coMap[co]) coMap[co] = { obtained: 0, max: 0 };
      coMap[co].max += sq.maxMarks;
      const marks = marksMap[sq.id];
      if (marks !== null && marks !== undefined) {
        coMap[co].obtained += marks;
      }
    }
  }

  return coMap;
}
