import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStudentTotal, calculateInternalMarks } from "@/lib/mid-exam-calc";
import { sendMarksSMS } from "@/lib/sms";
import { isBSHHod } from "@/lib/permissions";

// POST — lock and/or publish marks (writes to InternalMark table)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role;
  if (!["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role)) {
    return NextResponse.json({ error: "Forbidden. Only admin/HOD can publish marks." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { paperId, action } = body; // action: "lock" | "unlock" | "publish"

    if (!paperId) return NextResponse.json({ error: "paperId required" }, { status: 400 });

    const paper = await prisma.midExamPaper.findUnique({
      where: { id: paperId },
      include: {
        subject: true,
        scheme: true,
        masterPaper: {
          include: {
            questions: {
              include: {
                subQuestions: true,
                choiceGroup: true,
              }
            }
          }
        },
        questions: {
          include: {
            subQuestions: true,
            choiceGroup: true,
          }
        },
        publishRecord: true,
      }
    });

    if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });

    const isBSH = isBSHHod(session.user);
    if (isBSH && paper.year !== "1") {
      return NextResponse.json({ error: "BSH HOD can only publish/lock marks for Year 1 papers." }, { status: 403 });
    }

    if (paper.masterPaperId && paper.masterPaper) {
      (paper as any).questions = paper.masterPaper.questions;
    }

    if (action === "lock" || action === "unlock") {
      await prisma.midExamPublish.upsert({
        where: { paperId },
        create: {
          paperId,
          isLocked: action === "lock",
          lockedAt: action === "lock" ? new Date() : null,
          lockedById: action === "lock" ? session.user.id : null,
        },
        update: {
          isLocked: action === "lock",
          lockedAt: action === "lock" ? new Date() : null,
          lockedById: action === "lock" ? session.user.id : null,
        }
      });
      return NextResponse.json({ success: true, action });
    }

    if (action === "publish" || action === "demo_publish") {
      const { sendSMS, facultyMobiles } = body;

      // Get all students for this academic class
      const students = await prisma.student.findMany({
        where: {
          year: paper.year,
          semester: paper.semester,
          sectionId: paper.sectionId,
          departmentId: paper.subject.departmentId,
          isAlumni: false,
        },
        select: {
          id: true,
          name: true,
          rollNumber: true,
          mobile: true,
          studentContactNumber: true,
          year: true,
          semester: true,
        }
      });

      // Get all marks entries
      const allEntries = await prisma.midExamMarksEntry.findMany({
        where: { paperId }
      });

      // Get choice groups
      const targetPaperId = paper.masterPaperId || paperId;
      const choiceGroups = await prisma.midExamChoiceGroup.findMany({
        where: { paperId: targetPaperId },
        include: {
          questions: {
            include: { subQuestions: true }
          }
        }
      });

      // Map questions to calc format
      const calcQuestions = paper.questions.map(q => ({
        id: q.id,
        questionNo: q.questionNo,
        isCompulsory: q.isCompulsory,
        choiceGroupId: q.choiceGroupId,
        subQuestions: q.subQuestions.map(sq => ({
          id: sq.id,
          subLabel: sq.subLabel,
          maxMarks: sq.maxMarks,
          questionId: q.id,
          coMapping: sq.coMapping,
        }))
      }));

      const calcChoiceGroups = choiceGroups.map(cg => ({
        id: cg.id,
        groupNo: cg.groupNo,
        questions: cg.questions.map(q => ({
          id: q.id,
          questionNo: q.questionNo,
          isCompulsory: q.isCompulsory,
          choiceGroupId: q.choiceGroupId,
          subQuestions: q.subQuestions.map(sq => ({
            id: sq.id,
            subLabel: sq.subLabel,
            maxMarks: sq.maxMarks,
            questionId: q.id,
            coMapping: sq.coMapping,
          }))
        }))
      }));

      const scheme = paper.scheme;
      let published = 0;
      let errors = 0;

      for (const student of students) {
        const studentEntries = allEntries.filter(e => e.studentId === student.id);
        const isAbsent = studentEntries.some(e => e.isAbsent);

        // Build marks map
        const marksMap: Record<string, number | null> = {};
        for (const e of studentEntries) {
          marksMap[e.subQuestionId] = e.marksObtained;
        }

        const { total } = calculateStudentTotal(calcQuestions, calcChoiceGroups, marksMap, isAbsent);

        try {
          // Upsert into InternalMark (the existing table that the rest of the ERP reads)
          await prisma.internalMark.upsert({
            where: {
              studentId_subjectId_academicYearId_examType: {
                studentId: student.id,
                subjectId: paper.subjectId,
                academicYearId: paper.academicYearId,
                examType: paper.examType,
              }
            },
            create: {
              studentId: student.id,
              subjectId: paper.subjectId,
              academicYearId: paper.academicYearId,
              examType: paper.examType,
              marksObtained: isAbsent ? 0 : total,
              maxMarks: paper.totalMarks,
              isAbsent: isAbsent,
              recordedById: session.user.id,
            },
            update: {
              marksObtained: isAbsent ? 0 : total,
              maxMarks: paper.totalMarks,
              isAbsent: isAbsent,
              recordedById: session.user.id,
              updatedAt: new Date(),
            }
          });

          // Mark entries as non-draft
          await prisma.midExamMarksEntry.updateMany({
            where: { paperId, studentId: student.id },
            data: { isDraft: false }
          });

          published++;
        } catch (err) {
          console.error(`Failed to publish/calculate for student ${student.id}:`, err);
          errors++;
        }
      }

      // Update publish record (Only for official publish action)
      if (action === "publish") {
        await prisma.midExamPublish.upsert({
          where: { paperId },
          create: {
            paperId,
            isLocked: true,
            lockedAt: new Date(),
            lockedById: session.user.id,
            isPublished: true,
            publishedAt: new Date(),
            publishedById: session.user.id,
          },
          update: {
            isLocked: true,
            isPublished: true,
            publishedAt: new Date(),
            publishedById: session.user.id,
          }
        });
      }
      return NextResponse.json({ success: true, published, errors, action });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to process publish" }, { status: 500 });
  }
}
