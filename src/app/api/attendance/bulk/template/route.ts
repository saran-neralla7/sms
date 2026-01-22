import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("sectionId");

    if (!sectionId) {
        return NextResponse.json({ error: "Section ID is required" }, { status: 400 });
    }

    try {
        // Fetch students in the section, sorted by roll number
        const students = await prisma.student.findMany({
            where: { sectionId },
            orderBy: { rollNumber: "asc" },
            select: { rollNumber: true, name: true }
        });

        if (students.length === 0) {
            return NextResponse.json({ error: "No students found in this section" }, { status: 404 });
        }

        // Prepare Data for Excel
        // Row 1: Headers
        const headerRow = ["Date", "Period", "Subject", ...students.map(s => s.rollNumber)];

        // Row 2: Instructions/Names
        const infoRow = ["(DD-MM-YYYY)", "(E.g. 1st Hour)", "(Subject Name)", ...students.map(s => s.name)];

        // Create Worksheet
        const worksheet = XLSX.utils.aoa_to_sheet([headerRow, infoRow]);

        // Set Column Widths
        const wscols = [
            { wch: 15 }, // Date
            { wch: 15 }, // Period
            { wch: 20 }, // Subject
            ...students.map(() => ({ wch: 12 })) // Roll Nums
        ];
        worksheet["!cols"] = wscols;

        // Create Workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

        // Generate Buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        // Return File
        return new NextResponse(buffer, {
            headers: {
                "Content-Disposition": `attachment; filename="attendance_template_${sectionId}.xlsx"`,
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
        });

    } catch (error) {
        console.error("Template Gen Error:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
