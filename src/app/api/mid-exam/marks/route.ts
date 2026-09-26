import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";
import { getElectiveBatches } from "@/lib/elective-batches";
import { getStudentsForClass } from "@/lib/student-utils";

// GET marks grid for a paper
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const paperId = req.nextUrl.searchParams.get("paperId");
  if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 });

  try {
    const paper = await prisma.midExamPaper.findUnique({
      where: { id: paperId },
      include: {
        subject: {
          include: {
            electiveSlotRelation: true
          }
        },
        section: true,
        masterPaper: {
          include: {
            questions: {
              orderBy: { questionNo: "asc" },
              include: {
                subQuestions: { orderBy: { order: "asc" } },
                choiceGroup: true,
              }
            }
          }
        },
        questions: {
          orderBy: { questionNo: "asc" },
          include: {
            subQuestions: { orderBy: { order: "asc" } },
            choiceGroup: true,
          }
        },
        publishRecord: true,
      }
    });
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

    const isOE = paper.subject.isElective && 
      (paper.subject.electiveSlotRelation?.name?.toUpperCase()?.startsWith("OE") || 
       paper.subject.electiveSlotRelation?.name?.toUpperCase()?.startsWith("OPEN"));

    if (paper.masterPaperId && paper.masterPaper) {
      (paper as any).questions = paper.masterPaper.questions;
    }

    // Get students for this academic class
    const students = await getStudentsForClass({
      academicYearId: paper.academicYearId,
      departmentId: isOE || paper.subject.isElective ? undefined : paper.subject.departmentId,
      year: paper.year,
      semester: paper.semester,
      sectionId: isOE ? undefined : paper.sectionId,
      subjectId: paper.subjectId,
      include: {
        department: { select: { code: true } },
        section: { select: { name: true } }
      }
    });

    // Get existing marks entries for this paper
    const entries = await prisma.midExamMarksEntry.findMany({
      where: { paperId },
      select: {
        studentId: true,
        subQuestionId: true,
        marksObtained: true,
        isAbsent: true,
        isDraft: true,
      }
    });

    // Build marks map per student
    const studentMarksMap: Record<string, {
      marks: Record<string, number | null>;
      isAbsent: boolean;
      isDraft: boolean;
    }> = {};

    for (const entry of entries) {
      if (!studentMarksMap[entry.studentId]) {
        studentMarksMap[entry.studentId] = { marks: {}, isAbsent: false, isDraft: true };
      }
      studentMarksMap[entry.studentId].marks[entry.subQuestionId] = entry.marksObtained;
      if (entry.isAbsent) studentMarksMap[entry.studentId].isAbsent = true;
      if (!entry.isDraft) studentMarksMap[entry.studentId].isDraft = false;
    }

    // Flatten subquestions for column headers
    const subQuestions = paper.questions.flatMap(q =>
      q.subQuestions.map(sq => ({
        id: sq.id,
        questionNo: q.questionNo,
        subLabel: sq.subLabel,
        maxMarks: sq.maxMarks,
        coMapping: sq.coMapping,
        isCompulsory: q.isCompulsory,
        choiceGroupId: q.choiceGroupId,
        choiceGroupNo: q.choiceGroup?.groupNo ?? null,
        label: `Q${q.questionNo}${sq.subLabel}`,
      }))
    );

    const allBatches = getElectiveBatches();

    // Determine if this paper is designated for a specific batch (e.g., Open Elective with multiple faculty/batches)
    let paperBatch: string | null = null;
    if (isOE && paper.createdById) {
      const creatorUser = await prisma.user.findUnique({
        where: { id: paper.createdById },
        include: { faculty: true }
      });
      if (creatorUser?.faculty?.id) {
        const creatorMappings = await prisma.facultySubjectMapping.findMany({
          where: {
            facultyId: creatorUser.faculty.id,
            subjectId: paper.subjectId,
            academicYearId: paper.academicYearId,
            batch: { not: null }
          }
        });
        const uniqueCreatorBatches = [...new Set(creatorMappings.map(m => m.batch).filter(Boolean))];
        if (uniqueCreatorBatches.length === 1) {
          paperBatch = uniqueCreatorBatches[0];
        }
      }
    }

    // Also check if the currently logged-in faculty has a specific batch mapped for this subject
    const userRole = (session.user as any).role;
    let facultyMappedBatch: string | null = null;
    if (userRole === "FACULTY" && isOE) {
      const loggedUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { faculty: true }
      });
      if (loggedUser?.faculty?.id) {
        const loggedMappings = await prisma.facultySubjectMapping.findMany({
          where: {
            facultyId: loggedUser.faculty.id,
            subjectId: paper.subjectId,
            academicYearId: paper.academicYearId,
            batch: { not: null }
          }
        });
        const uniqueLoggedBatches = [...new Set(loggedMappings.map(m => m.batch).filter(Boolean))];
        if (uniqueLoggedBatches.length === 1) {
          facultyMappedBatch = uniqueLoggedBatches[0];
        }
      }
    }

    const effectiveTargetBatch = paperBatch || facultyMappedBatch;

    // Filter students: if the paper or faculty is mapped to a specific batch, only include students of that batch
    const eligibleStudents = effectiveTargetBatch
      ? students.filter(student => {
          const batchKey = `${student.id}_${paper.subjectId}`;
          return allBatches[batchKey] === effectiveTargetBatch;
        })
      : students;

    // Build grid rows
    const rows = eligibleStudents.map(student => {
      const studentData = studentMarksMap[student.id] || { marks: {}, isAbsent: false, isDraft: true };
      const batchKey = `${student.id}_${paper.subjectId}`;
      const batchName = allBatches[batchKey] || null;
      return {
        studentId: student.id,
        rollNumber: student.rollNumber,
        name: student.name,
        department: student.department,
        section: student.section,
        isAbsent: studentData.isAbsent,
        isDraft: studentData.isDraft,
        marks: studentData.marks,
        batchName,
      };
    });

    return NextResponse.json({
      paper: {
        id: paper.id,
        examType: paper.examType,
        totalMarks: paper.totalMarks,
        isFrozen: paper.isFrozen,
        isLocked: paper.publishRecord?.isLocked ?? false,
        isPublished: paper.publishRecord?.isPublished ?? false,
        subjectName: paper.subject.name,
        subjectCode: paper.subject.code,
        year: paper.year,
        semester: paper.semester,
        sectionName: paper.section.name,
      },
      subQuestions,
      rows,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load marks grid" }, { status: 500 });
  }
}

// POST — save/update marks (draft or final)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { paperId, entries, isDraft = true } = body;

    if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 });

    const paper = await prisma.midExamPaper.findUnique({
      where: { id: paperId },
      include: { publishRecord: true }
    });
    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

    const role = (session.user as any).role;
    const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);

    if (paper.publishRecord?.isLocked && !isAdmin) {
      return NextResponse.json({ error: "Marks are locked" }, { status: 403 });
    }

    // Validate marks don't exceed max
    const targetPaperId = paper.masterPaperId || paperId;
    const subQMap = await prisma.midExamSubQuestion.findMany({
      where: { question: { paperId: targetPaperId } },
      select: { id: true, maxMarks: true }
    });
    const maxMap: Record<string, number> = {};
    for (const sq of subQMap) maxMap[sq.id] = sq.maxMarks;

    const errors: string[] = [];
    for (const entry of entries) {
      if (!entry.isAbsent && entry.marksObtained !== null && entry.marksObtained !== undefined) {
        const max = maxMap[entry.subQuestionId];
        if (max !== undefined && entry.marksObtained > max) {
          errors.push(`Marks ${entry.marksObtained} exceeds max ${max} for subQ ${entry.subQuestionId}`);
        }
        if (entry.marksObtained < 0) {
          errors.push(`Marks cannot be negative`);
        }
      }
    }
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    // Upsert all entries
    for (const entry of entries) {
      await prisma.midExamMarksEntry.upsert({
        where: {
          paperId_studentId_subQuestionId: {
            paperId,
            studentId: entry.studentId,
            subQuestionId: entry.subQuestionId,
          }
        },
        create: {
          paperId,
          studentId: entry.studentId,
          subQuestionId: entry.subQuestionId,
          marksObtained: entry.isAbsent ? null : (entry.marksObtained ?? null),
          isAbsent: entry.isAbsent ?? false,
          isDraft,
          enteredById: session.user.id,
        },
        update: {
          marksObtained: entry.isAbsent ? null : (entry.marksObtained ?? null),
          isAbsent: entry.isAbsent ?? false,
          isDraft,
          enteredById: session.user.id,
          updatedAt: new Date(),
        }
      });
    }

    return NextResponse.json({ success: true, saved: entries.length, isDraft });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save marks" }, { status: 500 });
  }
}
