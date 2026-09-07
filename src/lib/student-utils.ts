import { prisma } from "./prisma";

interface GetStudentsParams {
  academicYearId: string;
  departmentId?: string;
  year: string;
  semester: string;
  sectionId?: string | string[];
  subjectId?: string;
}

export function getAdmissionStartYear(student: any): number | null {
  if (student.originalBatch?.startYear) return student.originalBatch.startYear;
  if (student.rollNumber) {
    const match = student.rollNumber.match(/^5(\d{2})/);
    if (match) {
      const yr = parseInt(match[1]);
      if (!isNaN(yr)) return 2000 + yr;
    }
  }
  return student.batch?.startYear || null;
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
          student: studentFilter,
          isDraft: false,
        },
        select: { studentId: true }
      }),
      prisma.assignmentMark.findMany({
        where: {
          ...marksConditions,
          student: studentFilter,
          isDraft: false,
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
      // If it's the current academic year, exclude alumni and detained and match year & semester strictly.
      ...(yearDiff === 0 ? { year, semester, isAlumni: false, isDetained: false } : {})
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
    include: {
      ...(include || {}),
      batch: true,
      originalBatch: true
    },
    orderBy: { rollNumber: "asc" }
  });

  // Post-filter to handle academic-year specific detention status strictly
  const filteredStudents = students.filter(s => {
    const studentObj = s as any;
    if (studentObj.isLeftCollege) return false;

    const admStartYear = getAdmissionStartYear(studentObj);
    const startYear = admStartYear || studentObj.batch?.startYear;
    if (!startYear || !targetAY) return true;

    const targetStart = parseInt(targetAY.name.split("-")[0]);
    if (isNaN(targetStart)) return true;

    // Check detention timing for targetAY
    if (studentObj.isDetained) {
      const detYearNum = parseInt(studentObj.detainedYear || "0");
      const detStartYear = startYear + (detYearNum > 0 ? detYearNum - 1 : 0);

      if (detYearNum > 0 && detStartYear > 0) {
        if (targetStart < detStartYear) {
          // Detained in a FUTURE academic year -> Student WAS ACTIVE in targetAY!
          return true;
        } else {
          // Detained in or before targetAY -> Student WAS DETAINED in targetAY!
          return false;
        }
      } else {
        // Currently detained and target is current AY (or no specific detainedYear set) -> exclude
        if (yearDiff === 0) return false;
      }
    }

    // If student is originally from an EARLIER batch than target class cohort (targetBatchStartYear),
    // and has NO marks entered for this academic year, exclude as inactive/detained from previous batch.
    if (targetBatchStartYear !== null && admStartYear && admStartYear < targetBatchStartYear) {
      if (!historicalStudentIds.includes(studentObj.id)) {
        return false;
      }
    }

    return true;
  });

  return filteredStudents;
}
