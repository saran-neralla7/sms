import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAssignmentNotification } from "@/lib/notification-service";

// GET assignments for a class or filtered query
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const academicYearId = searchParams.get("academicYearId");
  const departmentId = searchParams.get("departmentId");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const sectionId = searchParams.get("sectionId");
  const subjectId = searchParams.get("subjectId");
  const id = searchParams.get("id");

  try {
    if (id) {
      const assignment = await prisma.assignment.findUnique({
        where: { id },
        include: {
          subject: { select: { id: true, name: true, code: true, shortName: true } },
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
      return NextResponse.json(assignment);
    }

    const whereClause: any = {};
    if (academicYearId) whereClause.academicYearId = academicYearId;
    if (departmentId) whereClause.departmentId = departmentId;
    if (year) whereClause.year = year;
    if (semester) whereClause.semester = semester;
    if (sectionId) whereClause.sectionId = sectionId;
    if (subjectId) whereClause.subjectId = subjectId;

    const assignments = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true, code: true, shortName: true } },
        section: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        _count: { select: { marks: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

// POST create or clone assignment
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FACULTY", "DIRECTOR", "HOD"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      questions,
      totalMarks = 10,
      dueDate,
      academicYearId,
      departmentId,
      year,
      semester,
      sectionId,
      subjectId,
      cloneToSectionIds // Optional array of other section IDs to clone to
    } = body;

    if (!title || !academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const parsedDueDate = dueDate ? new Date(dueDate) : null;

    // Create primary assignment
    const assignment = await prisma.assignment.create({
      data: {
        title,
        description: description || null,
        questions: questions || [],
        totalMarks: Number(totalMarks) || 10,
        dueDate: parsedDueDate,
        academicYearId,
        departmentId,
        year: String(year),
        semester: String(semester),
        sectionId,
        subjectId,
        createdById: session.user.id
      }
    });

    // Send instant notification to students of this section
    await createAssignmentNotification({
      title,
      dueDate: parsedDueDate,
      departmentId,
      year: String(year),
      semester: String(semester),
      sectionId,
      subjectId
    });

    // If cloning across sections was requested
    if (Array.isArray(cloneToSectionIds) && cloneToSectionIds.length > 0) {
      for (const targetSecId of cloneToSectionIds) {
        if (targetSecId === sectionId) continue;
        await prisma.assignment.create({
          data: {
            title,
            description: description || null,
            questions: questions || [],
            totalMarks: Number(totalMarks) || 10,
            dueDate: parsedDueDate,
            academicYearId,
            departmentId,
            year: String(year),
            semester: String(semester),
            sectionId: targetSecId,
            subjectId,
            createdById: session.user.id
          }
        });

        // Trigger notification for cloned section as well
        await createAssignmentNotification({
          title,
          dueDate: parsedDueDate,
          departmentId,
          year: String(year),
          semester: String(semester),
          sectionId: targetSecId,
          subjectId
        });
      }
    }

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}

// PUT update assignment (edit questions, due date, etc.)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FACULTY", "DIRECTOR", "HOD"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, title, description, questions, totalMarks, dueDate, isFrozen } = body;

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (description !== undefined) dataToUpdate.description = description;
    if (questions !== undefined) dataToUpdate.questions = questions;
    if (totalMarks !== undefined) dataToUpdate.totalMarks = Number(totalMarks);
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (isFrozen !== undefined) dataToUpdate.isFrozen = Boolean(isFrozen);

    const updated = await prisma.assignment.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json({ success: true, assignment: updated });
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}

// DELETE assignment
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (!["ADMIN", "FACULTY", "DIRECTOR", "HOD"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");
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
