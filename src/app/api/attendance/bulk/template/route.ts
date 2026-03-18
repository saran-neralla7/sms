import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { formatISTDate } from "@/lib/dateUtils";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const departmentId = searchParams.get("departmentId") || undefined;
    const year = searchParams.get("year") || undefined;
    const semester = searchParams.get("semester") || undefined;

    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    if (!sectionId) return NextResponse.json({ error: "Section ID required" }, { status: 400 });

    // RBAC Check
    const role = (session.user.role || "").toUpperCase();
    if (role === "HOD") {
        const userDept = (session.user as any).departmentId;
        if (departmentId && departmentId !== userDept) {
            return NextResponse.json({ error: "Access Denied" }, { status: 403 });
        }
    }

    try {
        const students = await prisma.student.findMany({
            where: {
                sectionId,
                departmentId,
                year,
                semester
            },
            orderBy: { rollNumber: "asc" },
            select: { rollNumber: true, name: true }
        });

        const periods = await prisma.period.findMany({
            orderBy: { order: 'asc' }
        });

        // Fetch Timetables for Subject lookup
        const timetables = await prisma.timetable.findMany({
            where: { sectionId },
            include: { subject: true, labBatch: true }
        });

        // Calculate Dates
        let dates: Date[] = [];
        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr);
            const end = new Date(endDateStr);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d));
            }
        } else {
            dates = [new Date()]; // Default to today
        }

        // Headers Construction
        const headerRow1 = ["Date (DD-MM-YYYY)", ""]; // Roll, Name placeholders
        const headerRow2 = ["Subject Name", ""];
        const headerRow3 = ["Roll Number", "Name"];
        const wscols = [{ wch: 15 }, { wch: 25 }]; // Initial widths

        const merges: any[] = [];
        let colIndex = 2; // Start after Roll, Name

        dates.forEach(date => {
            const dateStr = formatISTDate(date);

            // Add Date Header (First cell gets value, rest empty for merge)
            headerRow1.push(dateStr);
            for (let i = 1; i < periods.length; i++) headerRow1.push("");

            // Add Merge for Date
            if (periods.length > 0) {
                merges.push({
                    s: { r: 0, c: colIndex },
                    e: { r: 0, c: colIndex + periods.length - 1 }
                });
            }

            const jsDay = date.getDay();
            const dbDay = jsDay === 0 ? 7 : jsDay;

            // Add Subject Headers and Period Headers dynamically from Timetable
            periods.forEach(p => {
                headerRow3.push(p.name);
                wscols.push({ wch: 15 });

                const activeBlocks = timetables.filter(t => 
                    t.dayOfWeek === dbDay && 
                    t.periodId === p.id &&
                    new Date(t.validFrom) <= date &&
                    (!t.validTo || new Date(t.validTo) >= date)
                );

                if (activeBlocks.length > 0) {
                    const blockNames = activeBlocks.map(b => {
                        if (b.isLunch) return "LUNCH";
                        let name = b.subject?.shortName || b.subject?.name || "";
                        if (b.labBatch) name += `(${b.labBatch.name})`;
                        return name;
                    });
                    headerRow2.push(blockNames.join(" / "));
                } else {
                    headerRow2.push("");
                }
            });

            colIndex += periods.length;
        });

        const dataRows = students.map(s => {
            const row = [s.rollNumber, s.name];
            // Add empty cells for all periods across all dates
            for (let i = 0; i < dates.length * periods.length; i++) row.push("");
            return row;
        });

        const worksheetData = [
            headerRow1,
            headerRow2,
            headerRow3,
            ...dataRows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        worksheet["!merges"] = merges;
        worksheet["!cols"] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Attendance_Template.xlsx"`,
            },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
