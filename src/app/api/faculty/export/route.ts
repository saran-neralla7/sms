import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get("departmentId");

        const where: any = {};
        if (departmentId) where.departmentId = departmentId;

        const faculty = await prisma.faculty.findMany({
            where,
            orderBy: [{ department: { name: 'asc' } }, { empName: 'asc' }],
            include: {
                department: true
            }
        });

        const data = faculty.map(f => ({
            "Emp Code": f.empCode,
            "Emp Name": f.empName,
            "Short Name": f.shortName || "",
            "Gender": f.gender,
            "DOB": f.dob ? new Date(f.dob).toISOString().split('T')[0] : "",
            "Join Date": f.joinDate ? new Date(f.joinDate).toISOString().split('T')[0] : "",
            "Department": f.department?.name || "",
            "Designation": f.designation,
            "Mobile": f.mobile,
            "Email": f.email || "",
            "Blood Group": f.bloodGroup || "",
            "Basic Salary": f.basicSalary || "",
            "Father Name": f.fatherName || "",
            "Mother Name": f.motherName || "",
            "Address": f.address || "",
            "Qualification": f.qualification || "",
            "Aadhar No": f.aadharNo || "",
            "PAN No": f.panNo || ""
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Adjust column widths
        const wscols = [
            { wch: 15 }, // Emp Code
            { wch: 30 }, // Emp Name
            { wch: 15 }, // Short Name
            { wch: 10 }, // Gender
            { wch: 15 }, // DOB
            { wch: 15 }, // Join Date
            { wch: 20 }, // Department
            { wch: 25 }, // Designation
            { wch: 15 }, // Mobile
            { wch: 30 }, // Email
            { wch: 10 }, // Blood Group
            { wch: 15 }, // Basic Salary
            { wch: 30 }, // Father Name
            { wch: 30 }, // Mother Name
            { wch: 50 }, // Address
            { wch: 20 }, // Qualification
            { wch: 20 }, // Aadhar No
            { wch: 15 }  // PAN No
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Faculty");
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buf, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": "attachment; filename=faculty_export.xlsx"
            }
        });

    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ error: "Failed to export faculty" }, { status: 500 });
    }
}
