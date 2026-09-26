import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalAccess } from "@/lib/permissions";

// GET /api/admin/mentors
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    // HOD or Global roles allowed
    if (!isGlobal && user.role !== "HOD") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId") || (!isGlobal ? user.departmentId : null);
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");
    const filter = searchParams.get("filter"); // "ALL", "ASSIGNED", "UNASSIGNED"

    const whereClause: any = {
      isLeftCollege: false
    };

    if (departmentId && departmentId !== "ALL") {
      whereClause.departmentId = departmentId;
    }
    if (year && year !== "ALL") {
      whereClause.year = year;
    }
    if (semester && semester !== "ALL") {
      whereClause.semester = semester;
    }
    if (sectionId && sectionId !== "ALL") {
      whereClause.sectionId = sectionId;
    }

    if (filter === "ASSIGNED") {
      whereClause.mentorId = { not: null };
    } else if (filter === "UNASSIGNED") {
      whereClause.mentorId = null;
    }

    const [students, facultyList] = await Promise.all([
      prisma.student.findMany({
        where: whereClause,
        include: {
          department: { select: { id: true, name: true, code: true } },
          section: { select: { id: true, name: true } },
          mentor: {
            select: { id: true, empName: true, empCode: true, designation: true }
          }
        },
        orderBy: { rollNumber: "asc" }
      }),
      prisma.faculty.findMany({
        where: departmentId && departmentId !== "ALL" ? { departmentId } : {},
        select: {
          id: true,
          empCode: true,
          empName: true,
          designation: true,
          department: { select: { id: true, name: true, code: true } },
          _count: {
            select: { mentees: true }
          }
        },
        orderBy: { empName: "asc" }
      })
    ]);

    return NextResponse.json({
      success: true,
      students,
      facultyList
    });
  } catch (error: any) {
    console.error("Error fetching mentor allocation data:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch data" }, { status: 500 });
  }
}

// POST /api/admin/mentors (Assign mentors)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    if (!isGlobal && user.role !== "HOD") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { mode, mentorId, studentIds, fromRoll, toRoll, mentorIds, departmentId, sectionId, year } = body;

    // Mode 1: By Roll Number Range
    if (mode === "RANGE") {
      if (!mentorId) {
        return NextResponse.json({ error: "Mentor faculty is required" }, { status: 400 });
      }
      if (!fromRoll || !toRoll) {
        return NextResponse.json({ error: "From Roll and To Roll are required" }, { status: 400 });
      }

      const cleanFrom = fromRoll.trim().toUpperCase();
      const cleanTo = toRoll.trim().toUpperCase();

      const matchedStudents = await prisma.student.findMany({
        where: {
          rollNumber: {
            gte: cleanFrom,
            lte: cleanTo
          },
          ...(departmentId && departmentId !== "ALL" ? { departmentId } : {}),
          ...(sectionId && sectionId !== "ALL" ? { sectionId } : {}),
          ...(year && year !== "ALL" ? { year } : {}),
          isLeftCollege: false
        },
        select: { id: true, rollNumber: true }
      });

      if (matchedStudents.length === 0) {
        return NextResponse.json({ error: "No students found in the specified roll number range" }, { status: 404 });
      }

      const updateResult = await prisma.student.updateMany({
        where: {
          id: { in: matchedStudents.map(s => s.id) }
        },
        data: {
          mentorId
        }
      });

      return NextResponse.json({
        success: true,
        count: updateResult.count,
        message: `Successfully assigned ${updateResult.count} students to mentor.`
      });
    }

    // Mode 2: By Selected Student IDs
    if (mode === "SELECTION") {
      if (!mentorId) {
        return NextResponse.json({ error: "Mentor faculty is required" }, { status: 400 });
      }
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return NextResponse.json({ error: "Please select at least one student" }, { status: 400 });
      }

      const updateResult = await prisma.student.updateMany({
        where: {
          id: { in: studentIds }
        },
        data: {
          mentorId
        }
      });

      return NextResponse.json({
        success: true,
        count: updateResult.count,
        message: `Successfully assigned ${updateResult.count} students to mentor.`
      });
    }

    // Mode 3: Auto-Distribute equally across multiple mentors
    if (mode === "AUTO_DISTRIBUTE") {
      if (!Array.isArray(mentorIds) || mentorIds.length === 0) {
        return NextResponse.json({ error: "Please select at least one faculty mentor" }, { status: 400 });
      }
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return NextResponse.json({ error: "Please select students to distribute" }, { status: 400 });
      }

      // Sort student IDs consistently
      const studentsToDistribute = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, rollNumber: true },
        orderBy: { rollNumber: "asc" }
      });

      const numMentors = mentorIds.length;
      let totalAssigned = 0;

      // Group students round-robin or contiguous chunks
      const chunkSize = Math.ceil(studentsToDistribute.length / numMentors);

      for (let i = 0; i < numMentors; i++) {
        const mentor = mentorIds[i];
        const chunk = studentsToDistribute.slice(i * chunkSize, (i + 1) * chunkSize);
        if (chunk.length > 0) {
          const res = await prisma.student.updateMany({
            where: { id: { in: chunk.map(s => s.id) } },
            data: { mentorId: mentor }
          });
          totalAssigned += res.count;
        }
      }

      return NextResponse.json({
        success: true,
        count: totalAssigned,
        message: `Evenly distributed ${totalAssigned} students across ${numMentors} mentors.`
      });
    }

    return NextResponse.json({ error: "Invalid allocation mode" }, { status: 400 });
  } catch (error: any) {
    console.error("Error saving mentor allocation:", error);
    return NextResponse.json({ error: error.message || "Failed to assign mentors" }, { status: 500 });
  }
}

// DELETE /api/admin/mentors (Unassign mentors)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    if (!isGlobal && user.role !== "HOD") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { studentIds } = body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: "Please select students to unassign" }, { status: 400 });
    }

    const updateResult = await prisma.student.updateMany({
      where: { id: { in: studentIds } },
      data: { mentorId: null }
    });

    return NextResponse.json({
      success: true,
      count: updateResult.count,
      message: `Unassigned mentor from ${updateResult.count} students.`
    });
  } catch (error: any) {
    console.error("Error unassigning mentors:", error);
    return NextResponse.json({ error: error.message || "Failed to unassign" }, { status: 500 });
  }
}
