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
    if (searchParams.get("settingId")) {
        where.settingId = searchParams.get("settingId");
    } else if (searchParams.get("history") === "true") {
        where.settingId = null;
    }

    try {
        const applications = await prisma.examApplication.findMany({
            where,
            include: {
                subjects: { include: { subject: { select: { name: true, code: true } } } },
                student: { select: { name: true } }
            },
            orderBy: { submittedAt: "asc" }
        });

        const rows: any[] = [];
        let sno = 1;
        const merges: any[] = [];

        applications.forEach((app: any) => {
            const currentSno = sno++;
            
            const payments = Array.isArray(app.payments) && app.payments.length > 0 
                ? app.payments 
                : [{ utrNumber: app.utrNumber, amountPaid: app.amountPaid, paymentDate: app.paymentDate }];

            const totalAmount = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amountPaid) || 0), 0);

            const startRow = rows.length + 1; // +1 because the header is at row 0

            payments.forEach((p: any) => {
                rows.push({
                    "S.No": currentSno,
                    "Roll Number": app.rollNumber,
                    "Student Name": app.student?.name || "",
                    "Department": app.department,
                    "Year": app.year,
                    "Semester": app.semester,
                    "Subjects": app.subjects.map((s: any) => `${s.subject.code} - ${s.subject.name}`).join(", "),
                    "Status": app.status,
                    "Submitted On": new Date(app.submittedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                    "Approved By": app.approvedBy || "",
                    "Remarks": app.remarks || "",
                    "UTR Number": p.utrNumber || "",
                    "Amount Paid": p.amountPaid || "",
                    "Total Amount": totalAmount,
                    "Duplicate UTR": app.duplicateUtr ? "YES" : "NO",
                    "Payment Date": p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—",
                });
            });

            const endRow = rows.length; // The last pushed row will be at this 0-indexed excel row

            if (payments.length > 1) {
                // Merge columns 0 to 10 (S.No through Remarks) 
                for (let c = 0; c <= 10; c++) {
                    merges.push({ s: { r: startRow, c: c }, e: { r: endRow, c: c } });
                }
                // Merge col 13 (Total Amount) and col 14 (Duplicate UTR)
                merges.push({ s: { r: startRow, c: 13 }, e: { r: endRow, c: 13 } });
                merges.push({ s: { r: startRow, c: 14 }, e: { r: endRow, c: 14 } });
            }
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        // Apply merges if any exist
        if (merges.length > 0) {
            if (!ws["!merges"]) ws["!merges"] = [];
            ws["!merges"].push(...merges);
        }

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
