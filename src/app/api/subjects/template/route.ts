import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
    try {
        // Define Template Headers
        const headers = [
            "Code",
            "Name",
            "Short Name",
            "Type",
            "Department",
            "Regulation",
            "Year",
            "Semester",
            "Elective Slot"
        ];

        // Sample Data Row
        const sampleData = [
            {
                "Code": "CS101",
                "Name": "Programming for Problem Solving",
                "Short Name": "PPS",
                "Type": "THEORY",
                "Department": "CSE",
                "Regulation": "R22",
                "Year": "1",
                "Semester": "1",
                "Elective Slot": ""
            },
            {
                "Code": "CS102",
                "Name": "Data Structures Lab",
                "Short Name": "DS Lab",
                "Type": "LAB",
                "Department": "CSE",
                "Regulation": "R22",
                "Year": "1",
                "Semester": "2",
                "Elective Slot": ""
            },
            {
                "Code": "PE101",
                "Name": "Advanced Algorithms",
                "Short Name": "Adv Algo",
                "Type": "PROFESSIONAL_ELECTIVE",
                "Department": "CSE",
                "Regulation": "R22",
                "Year": "3",
                "Semester": "1",
                "Elective Slot": "PE-1"
            }
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

        // Set column widths
        ws['!cols'] = [
            { wch: 10 }, // Code
            { wch: 30 }, // Name
            { wch: 15 }, // Short Name
            { wch: 15 }, // Type
            { wch: 10 }, // Dept
            { wch: 10 }, // Reg
            { wch: 5 },  // Year
            { wch: 5 },  // Sem
            { wch: 15 }  // Slot
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Subjects");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=subjects_template.xlsx"
            }
        });
    } catch (error) {
        console.error("Error generating template:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
