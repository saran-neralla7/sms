import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCertificatePDF } from "@/lib/docx-pdf";

function formatDateString(dateStr: string | Date | null | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).trim();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function stripNewlines(str: string | null | undefined): string {
    if (!str) return "";
    return String(str).replace(/[\r\n]+/g, ' ').trim();
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || !["ADMIN", "OFFICE"].includes((session.user as any).role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { studentId, certificateType = "TC" } = body;

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

        const today = new Date();

        // ===== BRANCH BY CERTIFICATE TYPE =====
        if (certificateType === "SC") {
            return await handleStudyCertificate(body, student, session, today);
        } else {
            return await handleTransferCertificate(body, student, session, today);
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ===== TRANSFER CERTIFICATE =====
async function handleTransferCertificate(body: any, student: any, session: any, today: Date) {
    const {
        left_date, promotion, reason_remarks, isDuplicate,
        nationality, religion, subcaste_name,
        father_name, date_of_birth, caste_category, join_date
    } = body;

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

    // Get next TC number
    const counter = await prisma.certificateCounter.findUnique({
        where: { certificateType: "TC" },
    });
    const assignedNumber = (counter?.currentNumber || 0) + 1;

    const docData = {
        certificate_no: String(assignedNumber),
        roll_number: stripNewlines(student.rollNumber),
        student_name: stripNewlines(student.name),
        parent_name: stripNewlines(father_name || student.fatherName),
        date_of_birth: formatDateString(date_of_birth || student.dateOfBirth),
        nationality: stripNewlines(nationality || student.nationality),
        religion: stripNewlines(religion || student.religion),
        caste_name: stripNewlines(caste_category || student.category || student.caste),
        subcaste_name: stripNewlines(subcaste_name || student.casteName),
        join_date: formatDateString(join_date || student.dateOfReporting || student.createdAt),
        left_date: formatDateString(left_date),
        class_name: stripNewlines(`${student.department?.name || ""} - ${student.section?.name || ""} (${student.year || ""} Year)`),
        promotion: stripNewlines(promotion),
        reason_remarks: stripNewlines(reason_remarks),
        issue_date: formatDateString(today),
        duplicate_text: isDuplicate ? "DUPLICATE" : ""
    };

    const fileName = `tc_${assignedNumber}_${student.id}${isDuplicate ? '_dup' : ''}.pdf`;
    
    // Generate PDF FIRST
    const finalUrl = await generateCertificatePDF("tc_template.docx", docData, fileName);

    // Commit to DB only after PDF success
    await prisma.$transaction(async (tx) => {
        await tx.certificateCounter.upsert({
            where: { certificateType: "TC" },
            update: { currentNumber: assignedNumber },
            create: { certificateType: "TC", currentNumber: assignedNumber }
        });

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

    const pdfFilename = finalUrl.split('/').pop();
    const downloadUrl = `/api/certificates/download?file=${encodeURIComponent(pdfFilename || '')}`;
    return NextResponse.json({ success: true, url: downloadUrl, certificateNo: assignedNumber });
}

// ===== STUDY CUM CONDUCT CERTIFICATE =====
async function handleStudyCertificate(body: any, student: any, session: any, today: Date) {
    const { father_name, date_of_birth, academic_year, purpose, batch_year } = body;

    // Must have a TC first
    const existingTC = await prisma.certificate.findFirst({
        where: { studentId: student.id, certificateType: "TC" },
        orderBy: { certificateNo: 'desc' }
    });

    if (!existingTC) {
        return NextResponse.json({ 
            error: "Please issue a Transfer Certificate (TC) first to generate a Study cum Conduct Certificate."
        }, { status: 400 });
    }

    // Get next SC number
    const counter = await prisma.certificateCounter.findUnique({
        where: { certificateType: "SC" },
    });
    const assignedNumber = (counter?.currentNumber || 0) + 1;

    const docData = {
        certificate_no: String(assignedNumber), // Keeping this just in case
        tc_number: String(existingTC.certificateNo),
        issue_date: formatDateString(today),
        student_name: stripNewlines(student.name),
        parent_name: stripNewlines(father_name || student.fatherName),
        year_name: stripNewlines(student.year),
        dept_name: stripNewlines(student.department?.name),
        roll_number: stripNewlines(student.rollNumber),
        batch_year: stripNewlines(batch_year || student.batch?.name || student.batchString),
        
        // Retaining some older ones just in case the template uses them
        date_of_birth: formatDateString(date_of_birth || student.dateOfBirth),
        academic_year: stripNewlines(academic_year),
        purpose: stripNewlines(purpose)
    };

    const fileName = `sc_${assignedNumber}_${student.id}.pdf`;
    
    // Generate PDF FIRST
    const finalUrl = await generateCertificatePDF("sc_template.docx", docData, fileName);

    // Commit to DB only after PDF success
    await prisma.$transaction(async (tx) => {
        await tx.certificateCounter.upsert({
            where: { certificateType: "SC" },
            update: { currentNumber: assignedNumber },
            create: { certificateType: "SC", currentNumber: assignedNumber }
        });

        // Update student demographics if provided
        await tx.student.update({
            where: { id: student.id },
            data: {
                fatherName: father_name || student.fatherName,
                dateOfBirth: date_of_birth ? new Date(date_of_birth) : student.dateOfBirth,
            }
        });

        await tx.certificate.create({
            data: {
                studentId: student.id!,
                certificateNo: assignedNumber,
                certificateType: "SC",
                isDuplicate: false,
                issuedById: session.user.id,
                fileUrl: finalUrl
            }
        });
    });

    const pdfFilename = finalUrl.split('/').pop();
    const downloadUrl = `/api/certificates/download?file=${encodeURIComponent(pdfFilename || '')}`;
    return NextResponse.json({ success: true, url: downloadUrl, certificateNo: assignedNumber });
}
