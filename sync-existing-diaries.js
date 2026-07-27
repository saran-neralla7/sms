const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COMPILER_DESIGN_SUBJ = "2c1ebbf4-3574-49cf-8fba-b5566727bd8d";
const SECTION_B = "e4356b8c-041f-4613-b79c-7cefbb219e72";
const SECTION_C = "20af1901-a756-48ef-a78f-d1070dfd431f";

// Helper to format date as YYYY-MM-DD
function toDateStr(date) {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

async function main() {
  console.log("Starting data synchronization between Section B and Section C...");

  // Fetch all history for B & C for Compiler Design
  const entries = await prisma.attendanceHistory.findMany({
    where: {
      subjectId: COMPILER_DESIGN_SUBJ,
      sectionId: { in: [SECTION_B, SECTION_C] }
    },
    include: {
      period: true
    }
  });

  console.log(`Found ${entries.length} attendance history records total for Compiler Design in B and C.`);

  // Group by date string
  const groupedByDate = {};
  for (const entry of entries) {
    const dStr = toDateStr(entry.date);
    if (!groupedByDate[dStr]) {
      groupedByDate[dStr] = { B: [], C: [] };
    }
    if (entry.sectionId === SECTION_B) {
      groupedByDate[dStr].B.push(entry);
    } else if (entry.sectionId === SECTION_C) {
      groupedByDate[dStr].C.push(entry);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const [dateStr, sections] of Object.entries(groupedByDate)) {
    const bEntries = sections.B;
    const cEntries = sections.C;

    // Helper to get topics from list of entries
    const getTopics = (list) => {
      const active = list.filter(e => e.topicsTaught);
      if (active.length === 0) return null;
      // Join if multiple, but usually one per day
      return active.map(e => e.topicsTaught).join("; ");
    };

    const bTopics = getTopics(bEntries);
    const cTopics = getTopics(cEntries);

    const parsedDate = new Date(dateStr + "T12:00:00Z"); // middle of day to avoid tz shift

    // Case 1: B has topics, C does not
    if (bTopics && !cTopics) {
      if (cEntries.length > 0) {
        // C has attendance record but no topicsTaught. Update first record.
        const target = cEntries[0];
        await prisma.attendanceHistory.update({
          where: { id: target.id },
          data: { topicsTaught: bTopics }
        });
        console.log(`[UPDATE] Updated Section C on ${dateStr} with topics from B: "${bTopics}"`);
        updatedCount++;
      } else {
        // C has no record. Create manual record.
        const refEntry = bEntries.find(e => e.topicsTaught) || bEntries[0];
        const dayOfWeek = parsedDate.getDay();
        const timetableEntry = await prisma.timetable.findFirst({
          where: {
            subjectId: COMPILER_DESIGN_SUBJ,
            sectionId: SECTION_C,
            dayOfWeek: dayOfWeek
          }
        });
        const periodId = timetableEntry?.periodId || refEntry.periodId;

        await prisma.attendanceHistory.create({
          data: {
            date: parsedDate,
            year: refEntry.year,
            semester: refEntry.semester,
            sectionId: SECTION_C,
            departmentId: refEntry.departmentId,
            academicYearId: refEntry.academicYearId,
            subjectId: COMPILER_DESIGN_SUBJ,
            periodId,
            status: "Completed",
            type: "ACADEMIC",
            fileName: "Manual Entry (Synced)",
            downloadedBy: refEntry.downloadedBy,
            details: "[]",
            topicsTaught: bTopics
          }
        });
        console.log(`[CREATE] Created Section C record on ${dateStr} with topics from B: "${bTopics}"`);
        createdCount++;
      }
    }

    // Case 2: C has topics, B does not
    if (cTopics && !bTopics) {
      if (bEntries.length > 0) {
        // B has attendance record but no topicsTaught. Update first record.
        const target = bEntries[0];
        await prisma.attendanceHistory.update({
          where: { id: target.id },
          data: { topicsTaught: cTopics }
        });
        console.log(`[UPDATE] Updated Section B on ${dateStr} with topics from C: "${cTopics}"`);
        updatedCount++;
      } else {
        // B has no record. Create manual record.
        const refEntry = cEntries.find(e => e.topicsTaught) || cEntries[0];
        const dayOfWeek = parsedDate.getDay();
        const timetableEntry = await prisma.timetable.findFirst({
          where: {
            subjectId: COMPILER_DESIGN_SUBJ,
            sectionId: SECTION_B,
            dayOfWeek: dayOfWeek
          }
        });
        const periodId = timetableEntry?.periodId || refEntry.periodId;

        await prisma.attendanceHistory.create({
          data: {
            date: parsedDate,
            year: refEntry.year,
            semester: refEntry.semester,
            sectionId: SECTION_B,
            departmentId: refEntry.departmentId,
            academicYearId: refEntry.academicYearId,
            subjectId: COMPILER_DESIGN_SUBJ,
            periodId,
            status: "Completed",
            type: "ACADEMIC",
            fileName: "Manual Entry (Synced)",
            downloadedBy: refEntry.downloadedBy,
            details: "[]",
            topicsTaught: cTopics
          }
        });
        console.log(`[CREATE] Created Section B record on ${dateStr} with topics from C: "${cTopics}"`);
        createdCount++;
      }
    }

    // Case 3: Both have topics, check if they differ and merge them
    if (bTopics && cTopics && bTopics !== cTopics) {
      // Merge unique topics
      const mergedTopics = Array.from(new Set([bTopics, cTopics])).join("; ");
      
      // Update B
      const bTarget = bEntries.find(e => e.topicsTaught) || bEntries[0];
      await prisma.attendanceHistory.update({
        where: { id: bTarget.id },
        data: { topicsTaught: mergedTopics }
      });

      // Update C
      const cTarget = cEntries.find(e => e.topicsTaught) || cEntries[0];
      await prisma.attendanceHistory.update({
        where: { id: cTarget.id },
        data: { topicsTaught: mergedTopics }
      });

      console.log(`[MERGE] Merged differing topics on ${dateStr}: "${mergedTopics}"`);
      updatedCount += 2;
    }
  }

  console.log(`Synchronization finished. Created: ${createdCount}, Updated/Merged: ${updatedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
