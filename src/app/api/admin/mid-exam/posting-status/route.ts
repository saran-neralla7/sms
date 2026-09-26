import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user.role || "").toUpperCase();
  if (!["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(userRole)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const academicYearIdParam = searchParams.get("academicYearId");

    let currentAY: any = null;
    if (academicYearIdParam) {
      currentAY = await prisma.academicYear.findUnique({ where: { id: academicYearIdParam } });
    }
    if (!currentAY) {
      currentAY = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        faculty: { select: { empName: true, shortName: true } }
      }
    });
    const userMap = new Map(users.map(u => [u.id, u.faculty?.empName || u.faculty?.shortName || u.username]));

    const depts = await prisma.department.findMany({
      where: { code: { in: ["CIVIL", "CSE", "ECE", "CSM", "MECH"] } }
    });
    const deptMap = new Map(depts.map(d => [d.code, d]));

    const allSections = await prisma.section.findMany({ orderBy: { name: "asc" } });
    const sectionMap = new Map(allSections.map(s => [s.name, s.id]));

    async function getSectionReport(deptCode: string, sectionName: string, year: string, sem: string = "1") {
      const dept = deptMap.get(deptCode);
      if (!dept) return { postedList: [], notPostedList: [] };

      const secId = sectionMap.get(sectionName);

      const mappings = await prisma.facultySubjectMapping.findMany({
        where: {
          subject: {
            departmentId: dept.id,
            year: year,
            semester: sem,
            type: { not: "OPEN_ELECTIVE" }
          },
          sectionId: secId
        },
        include: {
          subject: {
            include: {
              electiveSlotRelation: true
            }
          },
          faculty: true,
          section: true
        },
        orderBy: { subject: { code: "asc" } }
      });

      const subjectMap = new Map<string, { subject: any; facultyNames: Set<string>; facultyMappings: any[] }>();
      for (const m of mappings) {
        if (m.subject.name.toUpperCase().includes("OPEN ELECTIVE")) continue;
        if (m.subject.code.startsWith("2295704O") || m.subject.code.startsWith("2295705O")) continue;

        if (!subjectMap.has(m.subject.id)) {
          subjectMap.set(m.subject.id, {
            subject: m.subject,
            facultyNames: new Set(),
            facultyMappings: []
          });
        }
        const facName = m.faculty?.empName || m.faculty?.shortName || "Unknown";
        subjectMap.get(m.subject.id)!.facultyNames.add(facName);
        subjectMap.get(m.subject.id)!.facultyMappings.push(m);
      }

      const postedList: any[] = [];
      const notPostedList: any[] = [];

      for (const [subId, item] of subjectMap.entries()) {
        const sub = item.subject;
        const facNames = Array.from(item.facultyNames).join(", ");

        const papers = await prisma.midExamPaper.findMany({
          where: {
            subjectId: sub.id,
            academicYearId: currentAY?.id,
            OR: [
              { sectionId: secId },
              { sectionId: { in: allSections.map(s => s.id) } }
            ]
          },
          include: {
            marksEntries: { select: { isDraft: true, marksObtained: true, isAbsent: true } },
            section: true
          }
        });

        let relevantPapers = papers.filter(p => p.sectionId === secId);
        if (relevantPapers.length === 0) {
          const mappedFacUserIds = await prisma.faculty.findMany({
            where: { id: { in: item.facultyMappings.map(m => m.facultyId) } },
            select: { id: true, user: { select: { id: true } } }
          });
          const userIds = mappedFacUserIds.map(f => f.user?.id).filter(Boolean);
          relevantPapers = papers.filter(p => userIds.includes(p.createdById));
        }
        if (relevantPapers.length === 0) {
          relevantPapers = papers;
        }

        const totalSubmitted = relevantPapers.reduce((sum, p) => sum + p.marksEntries.filter(e => !e.isDraft).length, 0);
        const totalDraft = relevantPapers.reduce((sum, p) => sum + p.marksEntries.filter(e => e.isDraft).length, 0);
        const totalValid = relevantPapers.reduce((sum, p) => sum + p.marksEntries.filter(e => e.marksObtained !== null || e.isAbsent).length, 0);
        const paperCreators = relevantPapers.map(p => userMap.get(p.createdById) || p.createdById).join(", ");

        const isOE = sub.type === "OPEN_ELECTIVE" ||
          (sub.electiveSlotRelation?.name && sub.electiveSlotRelation.name.toUpperCase().startsWith("OE")) ||
          (sub.electiveSlotRelation?.name && sub.electiveSlotRelation.name.toUpperCase().includes("OPEN ELECTIVE")) ||
          sub.name.toUpperCase().includes("OPEN ELECTIVE") ||
          ["IDS", "AI", "DC", "Surveying", "ESWM", "NCES", "AM", "GenAI", "BEE", "BME", "ICE", "C++", "IAI", "FCS"].includes(sub.code);

        if (totalSubmitted > 0) {
          postedList.push({
            code: sub.code,
            name: sub.name,
            type: sub.type,
            isOpenElective: Boolean(isOE),
            faculty: facNames || paperCreators || "Unknown",
            submittedCount: totalSubmitted
          });
        } else {
          let statusType = "NOT_STARTED";
          let reason = "Not started (No marks entered)";
          if (totalDraft > 0 && totalValid > 0) {
            statusType = "DRAFT_ONLY";
            reason = `Saved as draft only (${totalValid} marks entered, Submit Draft not clicked)`;
          } else if (relevantPapers.length > 0) {
            statusType = "PAPER_CREATED";
            reason = "Paper created, 0 marks entered";
          }
          notPostedList.push({
            code: sub.code,
            name: sub.name,
            type: sub.type,
            isOpenElective: Boolean(isOE),
            faculty: facNames || "Unknown",
            statusType,
            draftCount: totalValid,
            reason
          });
        }
      }

      return { postedList, notPostedList };
    }

    async function getOeReport(year: string, sem: string = "1") {
      const oeSubjects = await prisma.subject.findMany({
        where: {
          OR: [
            { type: "OPEN_ELECTIVE" },
            { electiveSlotRelation: { name: { startsWith: "OE" } } },
            { name: { contains: "OE", mode: "insensitive" } },
            { code: { contains: "OE", mode: "insensitive" } }
          ],
          year: year,
          semester: sem
        },
        include: {
          department: true,
          FacultySubjectMapping: { include: { faculty: true, section: true } }
        },
        orderBy: { code: "asc" }
      });

      const oePosted: any[] = [];
      const oeNotPosted: any[] = [];

      for (const s of oeSubjects) {
        if (s.name.toUpperCase().includes("OPEN ELECTIVE") && s.FacultySubjectMapping.length === 0) continue;
        if (s.code.startsWith("2295704O") || s.code.startsWith("2295705O")) continue;

        const papers = await prisma.midExamPaper.findMany({
          where: { subjectId: s.id, academicYearId: currentAY?.id },
          include: { marksEntries: { select: { isDraft: true, marksObtained: true, isAbsent: true } } }
        });

        const facNames = Array.from(new Set(s.FacultySubjectMapping.map(m => m.faculty?.empName || m.faculty?.shortName).filter(Boolean))).join(", ");

        const totalSubmitted = papers.reduce((sum, p) => sum + p.marksEntries.filter(e => !e.isDraft).length, 0);
        const totalDraft = papers.reduce((sum, p) => sum + p.marksEntries.filter(e => e.isDraft).length, 0);
        const totalValid = papers.reduce((sum, p) => sum + p.marksEntries.filter(e => e.marksObtained !== null || e.isAbsent).length, 0);

        if (totalSubmitted > 0) {
          oePosted.push({
            code: s.code,
            name: s.name,
            dept: s.department?.name || "All",
            deptCode: s.department?.code || "",
            isOpenElective: true,
            faculty: facNames || "Unknown",
            submittedCount: totalSubmitted
          });
        } else {
          let statusType = "NOT_STARTED";
          let reason = "Not started (No marks entered)";
          if (totalDraft > 0 && totalValid > 0) {
            statusType = "DRAFT_ONLY";
            reason = `Saved as draft only (${totalValid} marks entered, Submit Draft not clicked)`;
          } else if (papers.length > 0) {
            statusType = "PAPER_CREATED";
            reason = "Paper created, 0 marks entered";
          }
          oeNotPosted.push({
            code: s.code,
            name: s.name,
            dept: s.department?.name || "All",
            deptCode: s.department?.code || "",
            isOpenElective: true,
            faculty: facNames || "Unknown",
            statusType,
            draftCount: totalValid,
            reason
          });
        }
      }

      return { postedList: oePosted, notPostedList: oeNotPosted };
    }

    const yearData: Record<string, any[]> = {};

    for (const year of ["4", "3"]) {
      const sectionsList: any[] = [];

      // Civil
      const civilReport = await getSectionReport("CIVIL", "A", year);
      sectionsList.push({
        id: `civil-${year}`,
        title: `Civil ${year}th yr 1st sem`,
        dept: "CIVIL",
        section: "A",
        postedMarks: civilReport.postedList,
        notPostedMarks: civilReport.notPostedList
      });

      // CSE Sections
      for (const sec of ["A", "B", "C"]) {
        const cseReport = await getSectionReport("CSE", sec, year);
        sectionsList.push({
          id: `cse-${sec.toLowerCase()}-${year}`,
          title: `CSE-${sec} ${year}th year 1st sem`,
          dept: "CSE",
          section: sec,
          postedMarks: cseReport.postedList,
          notPostedMarks: cseReport.notPostedList
        });
      }

      // ECE Sections
      for (const sec of ["A", "B"]) {
        const eceReport = await getSectionReport("ECE", sec, year);
        sectionsList.push({
          id: `ece-${sec.toLowerCase()}-${year}`,
          title: `ECE-${sec} ${year}th year 1st sem`,
          dept: "ECE",
          section: sec,
          postedMarks: eceReport.postedList,
          notPostedMarks: eceReport.notPostedList
        });
      }

      // CSM Sections
      const csmReport = await getSectionReport("CSM", "A", year);
      sectionsList.push({
        id: `csm-a-${year}`,
        title: `CSM-A ${year}th year 1st sem`,
        dept: "CSM",
        section: "A",
        postedMarks: csmReport.postedList,
        notPostedMarks: csmReport.notPostedList
      });

      // MECH
      const mechReport = await getSectionReport("MECH", "A", year);
      sectionsList.push({
        id: `mech-${year}`,
        title: `MECH ${year}th year 1st sem`,
        dept: "MECH",
        section: "A",
        postedMarks: mechReport.postedList,
        notPostedMarks: mechReport.notPostedList
      });

      // Open Electives
      const oeReport = await getOeReport(year);
      sectionsList.push({
        id: `oe-${year}`,
        title: `Open Electives ${year}th year 1st sem`,
        dept: "OE",
        section: "All",
        postedMarks: oeReport.postedList,
        notPostedMarks: oeReport.notPostedList
      });

      yearData[year] = sectionsList;
    }

    return NextResponse.json({
      academicYear: currentAY?.name,
      academicYearId: currentAY?.id,
      generatedAt: new Date().toISOString(),
      data: yearData
    });
  } catch (error: any) {
    console.error("Error generating posting status report:", error);
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
