import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get("departmentId");
        const year = searchParams.get("year");
        const semester = searchParams.get("semester");

        const where: any = {};
        if (departmentId) where.departmentId = departmentId;
        if (year) where.year = year;
        if (semester) where.semester = semester;

        const subjects = await prisma.subject.findMany({
            where,
            orderBy: [{ department: { name: 'asc' } }, { year: 'asc' }, { semester: 'asc' }, { code: 'asc' }],
            include: {
                department: true,
                regulation: true,
                electiveSlotRelation: true
            }
        });

        const data = subjects.map(s => ({
            "Code": s.code,
            "Name": s.name,
            "Short Name": s.shortName || "",
            "Type": s.type,
            "Department": s.department.name,
            "Regulation": s.regulation?.name || "",
            "Year": s.year,
            "Semester": s.semester,
            "Elective Slot": s.electiveSlotRelation?.name || ""
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Adjust column widths
        const wscols = [
            { wch: 10 },
            { wch: 30 },
            { wch: 15 }, // Short Name
            { wch: 15 }, // Type
            { wch: 10 },
            { wch: 10 },
            { wch: 5 },
            { wch: 5 },
            { wch: 15 }
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Subjects");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=subjects_export.xlsx"
            }
        });

    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ error: "Failed to export subjects" }, { status: 500 });
    }
}
