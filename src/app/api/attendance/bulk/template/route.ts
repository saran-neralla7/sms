import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");
    const departmentId = searchParams.get("departmentId") || undefined;
    const year = searchParams.get("year") || undefined;
    const semester = searchParams.get("semester") || undefined;

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
            orderBy: { startTime: 'asc' } // Or name if numeric sort needed
        });

        // Sort periods naturally if names represent numbers (1st, 2nd)
        periods.sort((a, b) => {
            const numA = parseInt(a.name.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.name.match(/\d+/)?.[0] || "0");
            return numA - numB;
        });

        // Row 1: Date (Merged)
        // Row 2: Subject (Empty)
        // Row 3: Headers (Roll, Name, Period names)

        // We generate 5 days (Columns) worth of headers as a sample?
        // User requested: "next date will be added beside it".
        // We will just generate ONE day (Date Placeholder) + All Periods.
        // The user can copy-paste columns to add more days.

        // Headers
        const dateValue = new Date().toLocaleDateString("en-IN").replace(/\//g, "-"); // Current Date as placeholder
        const headerRow1 = ["Date (DD-MM-YYYY)", "", dateValue, ...periods.slice(1).map(() => "")]; // Only first cell has date
        const headerRow2 = ["Subject Name", "", ...periods.map(() => "")]; // Empty for inputs
        const headerRow3 = ["Roll Number", "Name", ...periods.map(p => p.name)];

        const dataRows = students.map(s => [s.rollNumber, s.name, ...periods.map(() => "")]);

        const worksheetData = [
            headerRow1,
            headerRow2,
            headerRow3,
            ...dataRows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Merge Cells Logic
        // Merge Date Row (C1 -> Last Period Col)
        // Cell references are A1, B1, C1... 
        // Col 0=A, 1=B, 2=C.
        // Merge from Col 2 to Col (2 + periods.length - 1)
        if (periods.length > 0) {
            if (!worksheet["!merges"]) worksheet["!merges"] = [];
            worksheet["!merges"].push({
                s: { r: 0, c: 2 }, // Start Row 0, Col C
                e: { r: 0, c: 2 + periods.length - 1 } // End Row 0, Last Period Col
            });
        }

        // Styling hints (Col widths)
        const wscols = [
            { wch: 15 }, // Roll
            { wch: 25 }, // Name
            ...periods.map(() => ({ wch: 15 })) // Periods
        ];
        worksheet["!cols"] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Attendance_Template_Grouped.xlsx"`,
            },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
