import { prisma } from "./prisma";

interface GetStudentsParams {
  academicYearId: string;
  departmentId?: string;
  year: string;
  semester: string;
  sectionId?: string | string[];
  subjectId?: string;
}

/**
 * Robustly retrieves students for a given class context, taking into account
 * past academic years (where students have since been promoted) and detentions/transfers.
 */
export async function getStudentsForClass({
  academicYearId,
  departmentId,
  year,
  semester,
  sectionId,
  subjectId,
  include,
}: GetStudentsParams & { include?: any }) {
  // 1. Resolve academic years to calculate difference
  const targetAY = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { name: true }
  });
  const currentAY = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    select: { name: true }
  });

  let yearDiff = 0;
  if (targetAY && currentAY) {
    const targetStart = parseInt(targetAY.name.split("-")[0]);
    const currentStart = parseInt(currentAY.name.split("-")[0]);
    if (!isNaN(targetStart) && !isNaN(currentStart)) {
      yearDiff = Math.max(0, currentStart - targetStart);
    }
  }

  // 1b. Fetch subject if provided to check if it's an elective
  const subject = subjectId ? await prisma.subject.findUnique({
    where: { id: subjectId }
  }) : null;
  const isElective = subject?.isElective || false;

  // 2. Fetch student IDs with historical marks/records in this class
  let historicalStudentIds: string[] = [];
  try {
    const sectionCondition = sectionId
      ? Array.isArray(sectionId)
        ? { in: sectionId }
        : sectionId
      : undefined;

    const studentFilter = {
      isLeftCollege: false,
      ...(departmentId && !isElective ? { departmentId } : {}),
      ...(sectionCondition ? { sectionId: sectionCondition } : {}),
    };

    const marksConditions: any = {
      academicYearId,
    };
    if (sectionCondition) {
      marksConditions.sectionId = sectionCondition;
    }
    if (subjectId) {
      marksConditions.subjectId = subjectId;
    }

    const [midMarks, assignMarks, internalMarks] = await Promise.all([
      prisma.midExamMarksEntry.findMany({
        where: {
          paper: {
            academicYearId,
            ...(sectionCondition ? { sectionId: sectionCondition } : {}),
            subjectId: subjectId || undefined,
          },
          student: studentFilter
        },
        select: { studentId: true }
      }),
      prisma.assignmentMark.findMany({
        where: {
          ...marksConditions,
          student: studentFilter
        },
        select: { studentId: true }
      }),
      prisma.internalMark.findMany({
        where: {
          academicYearId,
          ...(subjectId ? { subjectId } : {}),
          student: studentFilter
        },
        select: { studentId: true }
      })
    ]);

    historicalStudentIds = Array.from(new Set([
      ...midMarks.map(m => m.studentId),
      ...assignMarks.map(a => a.studentId),
      ...internalMarks.map(i => i.studentId)
    ]));
  } catch (err) {
    console.error("Error fetching historical student IDs:", err);
  }

  const sectionFilter = sectionId
    ? Array.isArray(sectionId)
      ? { in: sectionId }
      : sectionId
    : undefined;

  // 3. Build the OR query conditions
  const orConditions: any[] = [];

  // Condition A: Historical match
  if (historicalStudentIds.length > 0) {
    const expectedCurrentYear = parseInt(year) + yearDiff;
    const currentYearVal = String(Math.min(4, expectedCurrentYear));

    orConditions.push({
      id: { in: historicalStudentIds },
      ...(departmentId ? { departmentId } : {}),
      ...(sectionFilter ? { sectionId: sectionFilter } : {}),
      year: currentYearVal,
      isLeftCollege: false,
    });
  }

  // Resolve the target cohort batch start year
  let targetBatchStartYear: number | null = null;
  if (targetAY) {
    const match = targetAY.name.match(/^(\d{4})/);
    if (match) {
      const Y_academic = parseInt(match[1]);
      const Y_class = parseInt(year);
      if (!isNaN(Y_academic) && !isNaN(Y_class)) {
        targetBatchStartYear = Y_academic - Y_class + 1;
      }
    }
  }

  if (targetBatchStartYear !== null) {
    orConditions.push({
      ...(departmentId ? { departmentId } : {}),
      batch: {
        startYear: targetBatchStartYear
      },
      ...(sectionFilter ? { sectionId: sectionFilter } : {}),
      ...(isElective && subjectId ? { subjects: { some: { id: subjectId } } } : {}),
      isLeftCollege: false,
      // If it's the current academic year, exclude alumni and detained. If past, they might be alumni now, so include them.
      ...(yearDiff === 0 ? { isAlumni: false, isDetained: false } : {})
    });
  } else {
    // Fallback to original logic if we couldn't parse the batch start year
    if (yearDiff === 0) {
      orConditions.push({
        ...(departmentId ? { departmentId } : {}),
        year,
        semester,
        ...(sectionFilter ? { sectionId: sectionFilter } : {}),
        ...(isElective && subjectId ? { subjects: { some: { id: subjectId } } } : {}),
        isAlumni: false,
        isLeftCollege: false,
        isDetained: false,
      });
    } else {
      const expectedCurrentYear = parseInt(year) + yearDiff;
      orConditions.push({
        ...(departmentId ? { departmentId } : {}),
        year: String(expectedCurrentYear),
        ...(sectionFilter ? { sectionId: sectionFilter } : {}),
        ...(isElective && subjectId ? { subjects: { some: { id: subjectId } } } : {}),
        isLeftCollege: false,
      });
    }
  }

  // Fetch the students
  const students = await prisma.student.findMany({
    where: {
      OR: orConditions,
    },
    include,
    orderBy: { rollNumber: "asc" }
  });

  return students;
}
