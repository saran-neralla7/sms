import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// GET: Export exam applications to Excel
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any).role;
    if (!["OFFICE", "ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const where: any = {};

    if (role === "OFFICE") {
        const deptId = (session.user as any).departmentId;
        if (deptId) {
            const dept = await prisma.department.findUnique({ where: { id: deptId } });
            if (dept) where.department = dept.name;
        }
    }

    if (searchParams.get("department")) where.department = searchParams.get("department");
    if (searchParams.get("year")) where.year = searchParams.get("year");
    if (searchParams.get("semester")) where.semester = searchParams.get("semester");
    if (searchParams.get("status")) where.status = searchParams.get("status");

    try {
        const applications = await prisma.examApplication.findMany({
            where,
            include: {
                subjects: { include: { subject: { select: { name: true, code: true } } } },
                student: { select: { name: true } }
            },
            orderBy: { submittedAt: "asc" }
        });

        const rows = applications.map((app: any, i: any) => ({
            "S.No": i + 1,
            "Roll Number": app.rollNumber,
            "Student Name": app.student?.name || "",
            "Department": app.department,
            "Year": app.year,
            "Semester": app.semester,
            "Subjects": app.subjects.map((s: any) => `${s.subject.code} - ${s.subject.name}`).join(", "),
            "UTR Number": app.utrNumber,
            "Amount Paid": app.amountPaid || "",
            "Duplicate UTR": app.duplicateUtr ? "YES" : "NO",
            "Payment Date": app.paymentDate ? new Date(app.paymentDate).toLocaleDateString("en-IN") : "—",
            "Status": app.status,
            "Submitted On": new Date(app.submittedAt).toLocaleDateString("en-IN"),
            "Approved By": app.approvedBy || "",
            "Remarks": app.remarks || ""
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Exam Applications");
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="exam_applications_${Date.now()}.xlsx"`
            }
        });
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }
}
