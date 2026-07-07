import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get("departmentId");
        const year = searchParams.get("year");
        const semester = searchParams.get("semester");
        const sectionId = searchParams.get("sectionId");

        if (!departmentId || !year || !semester || !sectionId) {
            return NextResponse.json({ error: "Missing required filters" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const academicYearId = cookieStore.get("academic-year-id")?.value;

        // Fetch Metadata Details
        const [department, section, periods, subjects, batches, slots, activeAy] = await Promise.all([
            prisma.department.findUnique({ where: { id: departmentId } }),
            prisma.section.findUnique({ where: { id: sectionId } }),
            prisma.period.findMany({ orderBy: { order: "asc" } }),
            prisma.subject.findMany({
                where: {
                    departmentId,
                    year: String(year),
                    semester: String(semester)
                }
            }),
            prisma.labBatch.findMany({
                where: {
                    departmentId,
                    sectionId,
                    year: String(year),
                    semester: String(semester)
                }
            }),
            prisma.electiveSlot.findMany({ orderBy: { name: "asc" } }),
            academicYearId 
                ? prisma.academicYear.findUnique({ where: { id: academicYearId } })
                : prisma.academicYear.findFirst({ where: { isCurrent: true } })
        ]);

        if (!department || !section) {
            return NextResponse.json({ error: "Department or Section not found" }, { status: 404 });
        }

        const academicYearName = activeAy ? activeAy.name : "N/A";
        const data: any[][] = [];

        // 1. Metadata rows (Rows 1-6) - Human-readable only, no raw IDs
        data.push(["Metadata Key", "Metadata Value"]);
        data.push(["Department", department.name]);
        data.push(["Section", section.name]);
        data.push(["Year", String(year)]);
        data.push(["Semester", String(semester)]);
        data.push(["Academic Year", academicYearName]);
        data.push([]); // Row 7 empty

        // 2. Timetable Grid Header (Row 8)
        const gridHeader = ["Day / Period"];
        periods.forEach(p => {
            gridHeader.push(`${p.name} (${p.startTime}-${p.endTime})`);
        });
        data.push(gridHeader);

        // 3. Grid Days (Rows 9-14)
        const days = [
            { id: 1, name: "Monday" },
            { id: 2, name: "Tuesday" },
            { id: 3, name: "Wednesday" },
            { id: 4, name: "Thursday" },
            { id: 5, name: "Friday" },
            { id: 6, name: "Saturday" }
        ];

        days.forEach(day => {
            const row = [day.name];
            periods.forEach(() => {
                row.push(""); // Empty cell for editing
            });
            data.push(row);
        });

        // 4. Instructions & Legend Space
        data.push([]);
        data.push(["TIMETABLE BULK IMPORT INSTRUCTIONS & RULES"]);
        data.push(["- Regular Core Subjects: Enter the subject Short Name or Code exactly as listed in the legend below (e.g. DBMS, OS)"]);
        data.push(["- Empty / Free Periods: Leave the cell blank or write 'Empty'"]);
        data.push(["- Lunch Break: Write 'LUNCH' to map the period as a lunch break"]);
        data.push(["- Parallel Classes / Splits: Use the pipe '|' to run multiple subjects at the same time (e.g. 'DBMS | OS')"]);
        data.push(["- Lab Batches: Specify the batch name in parentheses next to the lab subject (e.g. 'CN Lab (Batch-1) | DBMS Lab (Batch-2)')"]);
        data.push(["- Open Electives: Write the elective slot code (e.g. 'OE-3') to map the period to the elective slot"]);
        data.push([]);

        data.push(["VALID SUBJECTS & CODES REFERENCE LEGEND"]);
        subjects.forEach(sub => {
            data.push([sub.shortName || sub.code, sub.name, sub.type]);
        });

        if (slots.length > 0) {
            data.push([]);
            data.push(["VALID ELECTIVE SLOTS"]);
            slots.forEach(slot => {
                data.push([slot.name, "Elective Slot Group", "ELECTIVE"]);
            });
        }

        if (batches.length > 0) {
            data.push([]);
            data.push(["VALID LAB BATCHES FOR THIS SECTION"]);
            batches.forEach(b => {
                data.push([b.name, "Lab Batch", "LAB"]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(data);

        // Column widths
        const colWidths = [{ wch: 20 }];
        periods.forEach(() => {
            colWidths.push({ wch: 24 });
        });
        ws["!cols"] = colWidths;

        // Workbook creation
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Timetable");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const safeSecName = section.name.replace(/[^a-zA-Z0-9]/g, "_");
        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=Timetable_Template_${safeSecName}.xlsx`
            }
        });

    } catch (error) {
        console.error("Error generating timetable template:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
