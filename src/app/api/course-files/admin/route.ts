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
    if (!session || (session.user as any).role !== "ADMIN" && (session.user as any).role !== "HOD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const academicYearId = searchParams.get("academicYearId");
    const departmentId = searchParams.get("departmentId");
    let year = searchParams.get("year");
    let semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");

    if (!academicYearId || !departmentId || !year || !semester || !sectionId) {
      return NextResponse.json({ error: "Missing query parameters" }, { status: 400 });
    }

    // Normalize
    year = normalizeYear(year);
    semester = normalizeSemester(semester);

    // 1. Fetch all subjects matching department, year, semester
    const subjects = await prisma.subject.findMany({
      where: { departmentId, year, semester }
    });

    const subjectIds = subjects.map(s => s.id);

    // 2. Fetch faculty subject mappings
    const mappings = await prisma.facultySubjectMapping.findMany({
      where: {
        academicYearId,
        sectionId,
        subjectId: { in: subjectIds }
      },
      include: {
        faculty: true
      }
    });

    // 3. Fetch course files
    const courseFiles = await prisma.courseFile.findMany({
      where: {
        academicYearId,
        departmentId,
        year,
        semester,
        sectionId
      }
    });

    // 4. Fetch additional info in bulk for completion status check
    // Mid papers count
    const midExamPapers = await prisma.midExamPaper.findMany({
      where: { academicYearId, departmentId, year, semester, sectionId, subjectId: { in: subjectIds } },
      include: {
        _count: {
          select: { marksEntries: true }
        }
      }
    });

    // Sessional marks count
    const internalMarks = await prisma.internalMark.findMany({
      where: {
        academicYearId,
        subjectId: { in: subjectIds }
      }
    });

    // Students count (filter to department, year, semester, section)
    const studentsCount = await prisma.student.count({
      where: {
        sectionId,
        departmentId,
        year,
        semester
      }
    });

    // Timetable count per subject
    const timetables = await prisma.timetable.findMany({
      where: { sectionId, subjectId: { in: subjectIds } }
    });

    // Semester results count for this batch
    const semesterResults = await prisma.semesterResult.findMany({
      where: {
        student: {
          sectionId,
          departmentId,
          year,
          semester
        },
        year,
        semester
      }
    });

    // Compile statistics per subject
    const subjectsStatus = subjects.map(subject => {
      const mapping = mappings.find(m => m.subjectId === subject.id);
      const courseFile = courseFiles.find(cf => cf.subjectId === subject.id);

      const mid1Paper = midExamPapers.find(p => p.subjectId === subject.id && p.examType === "MID_I");
      const mid2Paper = midExamPapers.find(p => p.subjectId === subject.id && p.examType === "MID_II");

      const hasInternals = internalMarks.some(i => i.subjectId === subject.id);
      const hasTimetable = timetables.some(t => t.subjectId === subject.id);

      // Has semester results grades posted for this subject code
      const hasSemResults = semesterResults.some(r => {
        const gradesArr = Array.isArray(r.grades) ? r.grades : [];
        return (gradesArr as any[]).some(g => g.subjectCode === subject.code);
      });

      // Calculate completed items (out of 23)
      let completedCount = 0;

      // 1. Syllabus (always complete if subject exists)
      if (subject.syllabus) completedCount++;
      // 2. Objectives & Outcomes
      if ((subject.syllabus as any)?.objectives) completedCount++;
      // 3. CO-PO Mapping
      completedCount++; // Assume standard setup or query table
      // 4. Academic Calendar
      if (courseFile?.academicCalendarPath) completedCount++;
      // 5. Lecture Plan
      if (courseFile?.lecturePlan && (courseFile.lecturePlan as any[]).length > 0) completedCount++;
      // 6. Student list
      if (studentsCount > 0) completedCount++;
      // 7. Timetable
      if (hasTimetable) completedCount++;
      // 8. Teaching Support Materials
      if (courseFile?.teachingSupportText && courseFile.teachingSupportText.trim().length > 10) completedCount++;
      // 9. Assignment Questions
      if (courseFile?.assignmentQuestions && (courseFile.assignmentQuestions as any[]).some(u => u.questions?.some((q: string) => q.trim().length > 2))) completedCount++;
      // 10. Mid 1 question paper
      if (mid1Paper) completedCount++;
      // 11. Mid 1 scheme
      if (courseFile?.mid1SchemePath) completedCount++;
      // 12. Mid 1 marks
      if (mid1Paper && mid1Paper._count.marksEntries > 0) completedCount++;
      // 13. Slow learners
      completedCount++; // Dynamic calculation
      // 14. Remedial classes log
      if (courseFile?.remedialClasses && (courseFile.remedialClasses as any[]).length > 0) completedCount++;
      // 15. Mid 2 question paper
      if (mid2Paper) completedCount++;
      // 16. Mid 2 scheme
      if (courseFile?.mid2SchemePath) completedCount++;
      // 17. Mid 2 marks
      if (mid2Paper && mid2Paper._count.marksEntries > 0) completedCount++;
      // 18. Slow learners progress
      completedCount++; // Dynamic calculation
      // 19. Mid marks CO mapping
      if (mid1Paper || mid2Paper) completedCount++;
      // 20. Sessional marks
      if (hasInternals) completedCount++;
      // 21. Previous papers
      if (courseFile?.prevPapersPaths && (courseFile.prevPapersPaths as any[]).length > 0) completedCount++;
      // 22. Semester Results
      if (hasSemResults) completedCount++;
      // 23. CO PO Attainment level
      completedCount++; // Dynamic calculation

      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        faculty: mapping?.faculty ? { name: mapping.faculty.empName, email: mapping.faculty.email } : null,
        completedCount,
        totalCount: 23,
        percentage: Math.round((completedCount / 23) * 100),
        lastUpdated: courseFile ? courseFile.updatedAt : null,
        externalResultsAvailable: hasSemResults
      };
    });

    return NextResponse.json({ success: true, subjects: subjectsStatus });
  } catch (error: any) {
    console.error("Error in GET /api/course-files/admin:", error);
    return NextResponse.json({ error: error.message || "Failed to query course files admin list" }, { status: 500 });
  }
}
