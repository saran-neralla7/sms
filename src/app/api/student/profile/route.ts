import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentEffectivePermissions } from "@/lib/student-permissions";
import { logActivity } from "@/lib/logging";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "STUDENT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const username = session.user.username; // Student rollNumber
        const student = await prisma.student.findUnique({
            where: { rollNumber: username }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const permissions = await getStudentEffectivePermissions(student.rollNumber);
        const contentType = request.headers.get("content-type") || "";

        // 1. Photo Upload via multipart/form-data
        if (contentType.includes("multipart/form-data")) {
            if (!permissions.allowPhotoEdit) {
                return NextResponse.json({ error: "Photo upload is currently disabled by administrator." }, { status: 403 });
            }

            const formData = await request.formData();
            const file = formData.get("photo") as File | null;

            if (!file) {
                return NextResponse.json({ error: "No photo provided" }, { status: 400 });
            }

            // Check file type
            const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
            const ext = path.extname(file.name).toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                return NextResponse.json({ error: "Invalid photo format. Please upload JPG, PNG, or WebP." }, { status: 400 });
            }

            // Limit file size to 2MB
            if (file.size > 2 * 1024 * 1024) {
                return NextResponse.json({ error: "Photo file size exceeds 2MB limit." }, { status: 400 });
            }

            const uploadDir = path.join(process.cwd(), "public/student-photos");
            await mkdir(uploadDir, { recursive: true });

            // STRICT REQUIREMENT: Photo is named after student's roll number!
            const cleanFileName = `${student.rollNumber}${ext}`;
            const targetFilePath = path.join(uploadDir, cleanFileName);

            const buffer = Buffer.from(await file.arrayBuffer());
            await writeFile(targetFilePath, buffer);

            const photoUrl = `/api/student-photos/${cleanFileName}?v=${Date.now()}`;
            const updatedStudent = await prisma.student.update({
                where: { id: student.id },
                data: { photoUrl }
            });

            await logActivity(
                student.id,
                "UPDATE",
                "StudentPhoto",
                student.rollNumber,
                { photoUrl }
            );

            return NextResponse.json({
                message: "Photo uploaded successfully",
                photoUrl: updatedStudent.photoUrl
            });
        }

        // 2. Profile Details Update via JSON
        if (!permissions.allowProfileEdit) {
            return NextResponse.json({ error: "Profile details editing is currently disabled by administrator." }, { status: 403 });
        }

        const body = await request.json();

        // STRICT SECURITY:
        // NEVER allow student to edit: mobile (parent mobile), rollNumber, name, year, semester,
        // departmentId, sectionId, batchId, regulationId, isDetained, isLateralEntry, isLeftCollege, etc.
        const allowedUpdateData: any = {};

        if (body.studentContactNumber !== undefined) {
            allowedUpdateData.studentContactNumber = typeof body.studentContactNumber === "string" ? body.studentContactNumber.trim() : null;
        }
        if (body.emailId !== undefined) {
            allowedUpdateData.emailId = typeof body.emailId === "string" ? body.emailId.trim().toLowerCase() : null;
        }
        if (body.fatherName !== undefined) {
            allowedUpdateData.fatherName = typeof body.fatherName === "string" ? body.fatherName.trim() : null;
        }
        if (body.motherName !== undefined) {
            allowedUpdateData.motherName = typeof body.motherName === "string" ? body.motherName.trim() : null;
        }
        if (body.dateOfBirth !== undefined) {
            allowedUpdateData.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
        }
        if (body.gender !== undefined) {
            allowedUpdateData.gender = typeof body.gender === "string" ? body.gender.trim() : null;
        }
        if (body.caste !== undefined) {
            allowedUpdateData.caste = typeof body.caste === "string" ? body.caste.trim() : null;
        }
        if (body.casteName !== undefined) {
            allowedUpdateData.casteName = typeof body.casteName === "string" ? body.casteName.trim() : null;
        }
        if (body.aadharNumber !== undefined) {
            allowedUpdateData.aadharNumber = typeof body.aadharNumber === "string" ? body.aadharNumber.trim() : null;
        }
        if (body.abcId !== undefined) {
            allowedUpdateData.abcId = typeof body.abcId === "string" ? body.abcId.trim() : null;
        }
        if (body.address !== undefined) {
            allowedUpdateData.address = typeof body.address === "string" ? body.address.trim() : null;
        }

        const updatedStudent = await prisma.student.update({
            where: { id: student.id },
            data: allowedUpdateData
        });

        await logActivity(
            student.id,
            "UPDATE",
            "StudentProfileSelfEdit",
            student.rollNumber,
            allowedUpdateData
        );

        return NextResponse.json({
            message: "Profile updated successfully",
            student: updatedStudent
        });

    } catch (error: any) {
        console.error("Student Self-Edit Error:", error);
        return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
    }
}
