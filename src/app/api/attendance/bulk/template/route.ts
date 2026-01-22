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
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");

    if (!sectionId || !departmentId || !year || !semester) {
        return NextResponse.json({ error: "Missing filters (section, dept, year, sem)" }, { status: 400 });
    }

    // RBAC Check
    const role = (session.user.role || "").toUpperCase();
    if (role === "HOD") {
        const userDept = (session.user as any).departmentId;
        if (departmentId !== userDept) {
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

        const headerDate = ["Date (DD-MM-YYYY)", "", "", "", "", "", "", ""];
        const headerPeriod = ["Period (e.g. 1st Hour)", "", "", "", "", "", "", ""];
        const headerSubject = ["Subject Name", "", "", "", "", "", "", ""];
        const headerColumns = ["Roll Number", "Name", "Session 1", "Session 2", "Session 3", "Session 4", "Session 5", "Session 6"];

        const dataRows = students.map(s => [s.rollNumber, s.name, "", "", "", "", "", ""]);

        const worksheetData = [
            headerDate,
            headerPeriod,
            headerSubject,
            headerColumns,
            ...dataRows
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Styling hints (Col widths)
        worksheet["!cols"] = [
            { wch: 15 }, // Roll
            { wch: 25 }, // Name
            { wch: 15 }, // S1
            { wch: 15 }, // S2
            { wch: 15 }, // S3
            { wch: 15 }, // S4
            { wch: 15 }, // S5
            { wch: 15 }, // S6
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Attendance_Template_Matrix.xlsx"`,
            },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
