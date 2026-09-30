import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAssignmentNotification } from "@/lib/notification-service";

// GET single assignment by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            syllabus: true,
            department: { select: { id: true, name: true, code: true } }
          }
        },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        marks: {
          include: {
            student: { select: { id: true, rollNumber: true, name: true } }
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error fetching assignment:", error);
    return NextResponse.json({ error: "Failed to fetch assignment" }, { status: 500 });
  }
}

// PUT update assignment (title, description, questions, totalMarks, dueDate, isFrozen)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["ADMIN", "FACULTY", "DIRECTOR", "HOD"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const body = await req.json();
    const {
      title,
      description,
      questions,
      totalMarks,
      dueDate,
      isFrozen,
      notifyStudents,
      cloneToSectionIds
    } = body;

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;
    if (questions !== undefined) dataToUpdate.questions = questions;
    if (totalMarks !== undefined) dataToUpdate.totalMarks = Number(totalMarks);
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (isFrozen !== undefined) dataToUpdate.isFrozen = Boolean(isFrozen);

    const updated = await prisma.assignment.update({
      where: { id },
      data: dataToUpdate,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } }
      }
    });

    // Notify students if requested
    if (notifyStudents) {
      await createAssignmentNotification({
        title: updated.title,
        dueDate: updated.dueDate,
        departmentId: updated.departmentId,
        year: updated.year,
        semester: updated.semester,
        sectionId: updated.sectionId,
        subjectId: updated.subjectId
      });
    }

    // Clone to additional sections if requested
    if (Array.isArray(cloneToSectionIds) && cloneToSectionIds.length > 0) {
      for (const targetSecId of cloneToSectionIds) {
        if (targetSecId === updated.sectionId) continue;
        await prisma.assignment.create({
          data: {
            title: updated.title,
            description: updated.description,
            questions: updated.questions as any,
            totalMarks: updated.totalMarks,
            dueDate: updated.dueDate,
            academicYearId: updated.academicYearId,
            departmentId: updated.departmentId,
            year: updated.year,
            semester: updated.semester,
            sectionId: targetSecId,
            subjectId: updated.subjectId,
            createdById: session.user.id
          }
        });

        if (notifyStudents) {
          await createAssignmentNotification({
            title: updated.title,
            dueDate: updated.dueDate,
            departmentId: updated.departmentId,
            year: updated.year,
            semester: updated.semester,
            sectionId: targetSecId,
            subjectId: updated.subjectId
          });
        }
      }
    }

    return NextResponse.json({ success: true, assignment: updated });
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

// DELETE assignment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["ADMIN", "FACULTY", "DIRECTOR", "HOD"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.assignment.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
