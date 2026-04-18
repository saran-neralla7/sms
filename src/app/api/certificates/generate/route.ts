import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCertificatePDF } from "@/lib/docx-pdf";

function formatDateString(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { 
            studentId, 
            left_date, 
            promotion, 
            reason_remarks, 
            isDuplicate, 
            nationality, 
            religion, 
            subcaste_name,
            father_name,
            date_of_birth,
            caste_category,
            join_date
        } = body;

        if (!studentId) {
            return NextResponse.json({ error: "Student ID missing" }, { status: 400 });
        }

        // Fetch student
        let student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { department: true, section: true, batch: true }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Check for existing TC
        const existingTC = await prisma.certificate.findFirst({
            where: { studentId: student.id, certificateType: "TC" },
            orderBy: { certificateNo: 'desc' }
        });

        if (existingTC && !isDuplicate) {
            return NextResponse.json({ 
                error: "TC already issued for this student. Process as Duplicate?", 
                requiresDuplicateApproval: true 
            }, { status: 400 });
        }

        // Determine the next certificate number — duplicates also get a NEW number
        let assignedNumber = 0;
        
        const counter = await prisma.certificateCounter.findUnique({
            where: { certificateType: "TC" },
        });
        assignedNumber = (counter?.currentNumber || 0) + 1;

        const today = new Date();
        const docData = {
            certificate_no: String(assignedNumber),
            roll_number: student.rollNumber || "",
            student_name: student.name || "",
            parent_name: father_name || student.fatherName || "",
            date_of_birth: formatDateString(date_of_birth || student.dateOfBirth),
            nationality: nationality || student.nationality || "",
            religion: religion || student.religion || "",
            caste_name: caste_category || student.category || student.caste || "",
            subcaste_name: subcaste_name || student.casteName || "",
            join_date: formatDateString(join_date || student.dateOfReporting || student.createdAt),
            left_date: formatDateString(left_date),
            class_name: `${student.department?.name || ""} - ${student.section?.name || ""} (${student.year || ""} Year)`,
            promotion: promotion || "",
            reason_remarks: reason_remarks || "",
            issue_date: formatDateString(today),
            duplicate_text: isDuplicate ? "DUPLICATE" : ""
        };

        const fileName = `tc_${assignedNumber}_${student.id}${isDuplicate ? '_dup' : ''}.pdf`;
        
        // Generate PDF FIRST — if this fails, nothing is saved to DB
        const finalUrl = await generateCertificatePDF("tc_template.docx", docData, fileName);

        // ONLY after PDF success: commit everything atomically
        await prisma.$transaction(async (tx) => {
            // Always update counter since duplicates also get new numbers
            await tx.certificateCounter.upsert({
                where: { certificateType: "TC" },
                update: { currentNumber: assignedNumber },
                create: { certificateType: "TC", currentNumber: assignedNumber }
            });

            // Update student demographics
            await tx.student.update({
                where: { id: student.id },
                data: {
                    nationality: nationality || student.nationality,
                    religion: religion || student.religion,
                    casteName: subcaste_name || student.casteName,
                    fatherName: father_name || student.fatherName,
                    dateOfBirth: date_of_birth ? new Date(date_of_birth) : student.dateOfBirth,
                    category: caste_category || student.category,
                    dateOfReporting: join_date ? new Date(join_date) : student.dateOfReporting
                }
            });

            // Always create a new certificate record (duplicates get new numbers)
            await tx.certificate.create({
                data: {
                    studentId: student.id!,
                    certificateNo: assignedNumber,
                    certificateType: "TC",
                    isDuplicate: Boolean(isDuplicate),
                    issuedById: session.user.id,
                    fileUrl: finalUrl
                }
            });
        });

        // Build API download URL from the static path
        const pdfFilename = finalUrl.split('/').pop();
        const downloadUrl = `/api/certificates/download?file=${encodeURIComponent(pdfFilename || '')}`;

        return NextResponse.json({ success: true, url: downloadUrl, certificateNo: assignedNumber });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
