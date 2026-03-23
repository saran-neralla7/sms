import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");

    if (!academicYearId || !departmentId || !year || !semester || !sectionId) {
        return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    try {
        // Fetch Students
        const students = await prisma.student.findMany({
            where: {
                departmentId,
                year,
                semester,
                sectionId
            },
            orderBy: { rollNumber: "asc" },
            select: { rollNumber: true, name: true, id: true }
        });

        if (students.length === 0) {
            return NextResponse.json({ error: "No students found for the selected criteria" }, { status: 404 });
        }

        // Fetch Subjects
        const subjects = await prisma.subject.findMany({
            where: {
                departmentId,
                year,
                semester
            },
            orderBy: { code: 'asc' }
        });

        if (subjects.length === 0) {
            return NextResponse.json({ error: "No subjects found for the selected semester" }, { status: 404 });
        }

        // Headers
        const headerRow1 = ["Roll Number", "Name"];
        const wscols = [{ wch: 15 }, { wch: 30 }]; // Roll Number, Name widths

        subjects.forEach(sub => {
            headerRow1.push(`${sub.code} - ${sub.name}`);
            wscols.push({ wch: 20 });
        });

        // Rows
        const dataRows = students.map(s => {
            const row = [s.rollNumber, s.name];
            // Empty columns for marks
            subjects.forEach(() => row.push(""));
            return row;
        });

        const worksheetData = [
            headerRow1,
            ...dataRows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        worksheet["!cols"] = wscols;

        // Note: We can add an instructions row or validate max 30 inside excel, but for now simple structure is best.
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Internal Marks");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Internal_Marks_Template_${year}_${semester}.xlsx"`,
            },
        });
    } catch (error) {
        console.error("Internal Marks Template Gen Error:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
