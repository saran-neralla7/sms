import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET pending papers (mappings where no question paper has been created yet)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const academicYearId = searchParams.get("academicYearId");
  const departmentId = searchParams.get("departmentId");
  const year = searchParams.get("year");
  const semester = searchParams.get("semester");
  const sectionId = searchParams.get("sectionId");

  if (!academicYearId || !departmentId) {
    return NextResponse.json({ error: "academicYearId and departmentId are required" }, { status: 400 });
  }

  try {
    // 1. Get all mappings for this academic year and department/year/semester
    const mappings = await prisma.facultySubjectMapping.findMany({
      where: {
        academicYearId,
        ...(sectionId && { sectionId }),
        OR: [
          { subject: { departmentId } },
          { faculty: { departmentId } }
        ],
        subject: {
          type: { not: "LAB" },
          ...(year && { year }),
          ...(semester && { semester })
        }
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            department: { select: { code: true } }
          }
        },
        section: { select: { id: true, name: true } },
        faculty: { select: { empName: true } }
      }
    });

    // 2. Get all papers created for this academic year and department
    const papers = await prisma.midExamPaper.findMany({
      where: {
        academicYearId,
        ...(sectionId && { sectionId }),
        OR: [
          { departmentId },
          { subject: { departmentId } }
        ],
        ...(year && { year }),
        ...(semester && { semester })
      },
      select: {
        subjectId: true,
        sectionId: true,
        examType: true
      }
    });

    // 3. Group mappings by subjectId and sectionId to handle co-teaching
    const groupedMappings = new Map<string, {
      subject: any;
      section: any;
      faculties: string[];
    }>();

    for (const m of mappings) {
      const key = `${m.subjectId}_${m.sectionId}`;
      if (!groupedMappings.has(key)) {
        groupedMappings.set(key, {
          subject: m.subject,
          section: m.section,
          faculties: []
        });
      }
      const group = groupedMappings.get(key)!;
      if (m.faculty?.empName && !group.faculties.includes(m.faculty.empName)) {
        group.faculties.push(m.faculty.empName);
      }
    }

    // 4. Check if MID_I and MID_II papers exist for each grouped subject-section. If not, add to pending list
    const pendingList: any[] = [];
    for (const [key, val] of groupedMappings.entries()) {
      const [subjectId, sectionId] = key.split("_");
      const hasMid1 = papers.some(p => p.subjectId === subjectId && p.sectionId === sectionId && p.examType === "MID_I");
      const hasMid2 = papers.some(p => p.subjectId === subjectId && p.sectionId === sectionId && p.examType === "MID_II");

      const facultyNamesStr = val.faculties.join(", ");

      if (!hasMid1) {
        pendingList.push({
          id: `${key}-MID_I`,
          subject: val.subject,
          section: val.section,
          facultyName: facultyNamesStr || "Not Assigned",
          examType: "MID_I"
        });
      }
      if (!hasMid2) {
        pendingList.push({
          id: `${key}-MID_II`,
          subject: val.subject,
          section: val.section,
          facultyName: facultyNamesStr || "Not Assigned",
          examType: "MID_II"
        });
      }
    }

    return NextResponse.json(pendingList);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch pending papers" }, { status: 500 });
  }
}
