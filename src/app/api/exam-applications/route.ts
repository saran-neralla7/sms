import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET: List exam applications (filtered by role)
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const role = (session.user as any).role;
    const where: any = {};

    if (role === "STUDENT") {
        const username = (session.user as any).username;
        const student = await prisma.student.findUnique({ where: { rollNumber: username } });
        if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
        where.studentId = student.id;
    } else if (role === "OFFICE") {
        const deptId = (session.user as any).departmentId;
        if (deptId) {
            const dept = await prisma.department.findUnique({ where: { id: deptId } });
            if (dept) where.department = dept.name;
        } else if (searchParams.get("department")) {
            where.department = searchParams.get("department");
        }
        if (searchParams.get("year")) where.year = searchParams.get("year");
        if (searchParams.get("semester")) where.semester = searchParams.get("semester");
        if (searchParams.get("status")) where.status = searchParams.get("status");
        if (searchParams.get("duplicate") === "true") where.duplicateUtr = true;
        if (searchParams.get("editRequested") === "true") where.editRequested = true;
    } else if (["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
        if (searchParams.get("department")) where.department = searchParams.get("department");
        if (searchParams.get("year")) where.year = searchParams.get("year");
        if (searchParams.get("semester")) where.semester = searchParams.get("semester");
        if (searchParams.get("status")) where.status = searchParams.get("status");
        if (searchParams.get("duplicate") === "true") where.duplicateUtr = true;
        if (searchParams.get("editRequested") === "true") where.editRequested = true;
    } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const applications = await prisma.examApplication.findMany({
            where,
            include: {
                subjects: { include: { subject: { select: { id: true, name: true, code: true } } } },
                student: { select: { name: true, photoUrl: true } }
            },
        });

        const enrichedApplications = await Promise.all(applications.map(async (app) => {
            if (app.duplicateUtr) {
                const original = await prisma.examApplication.findFirst({
                    where: { utrNumber: app.utrNumber, id: { not: app.id } },
                    include: { student: { select: { name: true } } }
                });
                return {
                    ...app,
                    duplicateDetails: original ? {
                        rollNumber: original.rollNumber,
                        name: original.student?.name,
                        year: original.year,
                        semester: original.semester
                    } : null
                };
            }
            return app;
        }));

        return NextResponse.json(enrichedApplications);
    } catch (error) {
        console.error("Fetch exam applications error:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

// POST: Submit a new exam application (student only)
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "STUDENT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        // The new frontend will send a JSON string of multiple applications
        const applicationsData = JSON.parse(formData.get("applications") as string || "[]");

        if (!Array.isArray(applicationsData) || applicationsData.length === 0) {
            return NextResponse.json({ error: "No applications provided" }, { status: 400 });
        }

        const username = (session.user as any).username;
        const student = await prisma.student.findUnique({
            where: { rollNumber: username },
            include: { department: true }
        });

        if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

        const now = new Date();
        const applicationsToCreate = [];

        for (const app of applicationsData) {
            const { year, semester, subjectIds, utrNumber, amountPaid: amountPaidStr, paymentDate } = app;

            if (!year || !semester || !utrNumber || !paymentDate || !Array.isArray(subjectIds) || subjectIds.length === 0) {
                return NextResponse.json({ error: `Missing required fields (including Payment Date) for 0${year}-0${semester} application.` }, { status: 400 });
            }

            const amountPaid = amountPaidStr ? parseFloat(amountPaidStr) : null;
            if (amountPaidStr && (isNaN(amountPaid!) || amountPaid! <= 0)) {
                return NextResponse.json({ error: `Please enter a valid amount for 0${year}-0${semester}.` }, { status: 400 });
            }

            // Check freeze window for this specific semester
            const setting = await prisma.examApplicationSetting.findUnique({
                where: { year_semester: { year, semester } }
            });

            if (!setting || !setting.isActive) {
                return NextResponse.json({ error: `Exam application is not active for 0${year}-0${semester}.` }, { status: 400 });
            }

            const effectiveEndDate = new Date(setting.endDate);
            effectiveEndDate.setHours(23, 59, 59, 999);

            if (now < setting.startDate || now > effectiveEndDate) {
                return NextResponse.json({ error: `Exam application window is closed for 0${year}-0${semester}.` }, { status: 400 });
            }

            // Check for existing application for this specific semester
            const existing = await prisma.examApplication.findFirst({
                where: { studentId: student.id, year, semester }
            });
            if (existing) {
                return NextResponse.json({ error: `You have already submitted an application for 0${year}-0${semester}.` }, { status: 400 });
            }

            // Check duplicate UTR across the whole system
            const duplicateUtrRecord = await prisma.examApplication.findFirst({
                where: { utrNumber },
                select: { rollNumber: true }
            });

            applicationsToCreate.push({
                studentId: student.id,
                rollNumber: student.rollNumber,
                department: student.department.name,
                year,
                semester,
                utrNumber,
                amountPaid,
                paymentDate: new Date(paymentDate),
                duplicateUtr: !!duplicateUtrRecord,
                duplicateUtrRollNo: duplicateUtrRecord ? duplicateUtrRecord.rollNumber : null,
                subjects: {
                    create: subjectIds.map((sid: string) => ({ subjectId: sid }))
                }
            });
        }

        // Save all applications in a transaction
        const savedApplications = await prisma.$transaction(
            applicationsToCreate.map(appData =>
                prisma.examApplication.create({
                    data: appData,
                    include: {
                        subjects: { include: { subject: { select: { name: true, code: true } } } }
                    }
                })
            )
        );

        return NextResponse.json(savedApplications);
    } catch (error) {
        console.error("Exam application submission error:", error);
        return NextResponse.json({ error: "Failed to submit applications" }, { status: 500 });
    }
}
