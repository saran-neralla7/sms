import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET assignments for the currently logged-in student
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rollNumber = session.user.username;
    const student = await prisma.student.findUnique({
      where: { rollNumber },
      include: {
        department: true,
        section: true,
        subjects: true
      }
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Find all active assignments for student's department, year, semester, section
    const assignments = await prisma.assignment.findMany({
      where: {
        departmentId: student.departmentId,
        year: student.year,
        semester: student.semester,
        sectionId: student.sectionId
      },
      include: {
        subject: { select: { id: true, name: true, code: true, shortName: true } },
        section: { select: { id: true, name: true } },
        marks: {
          where: { studentId: student.id }
        }
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" }
      ]
    });

    const formatted = assignments.map(a => {
      const myMark = a.marks[0] || null;
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        questions: a.questions,
        totalMarks: a.totalMarks,
        dueDate: a.dueDate,
        subject: a.subject,
        section: a.section,
        myMarksObtained: myMark?.marksObtained ?? null,
        myStatus: myMark ? (myMark.marksObtained !== null ? "SUBMITTED" : "NOT_SUBMITTED") : "NOT_SUBMITTED",
        createdAt: a.createdAt
      };
    });

    return NextResponse.json({
      student: {
        name: student.name,
        rollNumber: student.rollNumber,
        department: student.department.code,
        section: student.section.name,
        year: student.year,
        semester: student.semester
      },
      assignments: formatted
    });
  } catch (error) {
    console.error("Error fetching student assignments:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}
