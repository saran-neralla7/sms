import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
    try {
        const wb = XLSX.utils.book_new();

        // 1. All Departments sheet
        const allDeptHeaders = [
            "Student Department",
            "Roll Number",
            "Year",
            "Elective Category",
            "Subject Code",
            "Subject Name"
        ];
        const allDeptSample = [
            {
                "Student Department": "CIVIL",
                "Roll Number": "5231401001",
                "Year": "4",
                "Elective Category": "OPEN ELECTIVE IV",
                "Subject Code": "NCES",
                "Subject Name": "Non Conventional Energy Resources"
            },
            {
                "Student Department": "ECE",
                "Roll Number": "5201421039",
                "Year": "4",
                "Elective Category": "OPEN ELECTIVE IV",
                "Subject Code": "IDS",
                "Subject Name": "Introduction to Data Science"
            }
        ];
        const wsAll = XLSX.utils.json_to_sheet(allDeptSample, { header: allDeptHeaders });
        wsAll['!cols'] = [
            { wch: 18 }, // Student Department
            { wch: 15 }, // Roll Number
            { wch: 8 },  // Year
            { wch: 22 }, // Elective Category
            { wch: 15 }, // Subject Code
            { wch: 35 }  // Subject Name
        ];
        XLSX.utils.book_append_sheet(wb, wsAll, "All Departments");

        // 2. Department-specific sheets (e.g. CSE)
        const deptHeaders = [
            "Roll Number",
            "Year",
            "Elective Category",
            "Subject Code",
            "Subject Name",
            "Offering Department"
        ];
        const cseSample = [
            {
                "Roll Number": "5221411018",
                "Year": "4",
                "Elective Category": "OPEN ELECTIVE IV",
                "Subject Code": "NCES",
                "Subject Name": "Non Conventional Energy Resources",
                "Offering Department": "MECHANICAL"
            }
        ];
        const wsCse = XLSX.utils.json_to_sheet(cseSample, { header: deptHeaders });
        wsCse['!cols'] = [
            { wch: 15 }, // Roll Number
            { wch: 8 },  // Year
            { wch: 22 }, // Elective Category
            { wch: 15 }, // Subject Code
            { wch: 35 }, // Subject Name
            { wch: 18 }  // Offering Department
        ];
        XLSX.utils.book_append_sheet(wb, wsCse, "CSE");

        // Generate buffer
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=department_wise_selections_template.xlsx"
            }
        });
    } catch (error) {
        console.error("Error generating template:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
