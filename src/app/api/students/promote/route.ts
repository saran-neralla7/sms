import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { studentIds, targetYear, targetSemester, targetBatchId, targetSectionId, targetDepartmentId, isAlumni, academicYearId, graduationDate } = body;

        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "No students selected" }, { status: 400 });
        }

        if (isAlumni) {
            // ============ GRADUATE TO ALUMNI ============
            if (!academicYearId) {
                return NextResponse.json({ error: "Academic year is required for graduation" }, { status: 400 });
            }

            const gradDate = graduationDate ? new Date(graduationDate) : new Date();
            const passingYear = gradDate.getFullYear().toString();

            await prisma.$transaction(async (tx) => {
                // 1. Fetch full student details
                const students = await tx.student.findMany({
                    where: { id: { in: studentIds } },
                    include: { department: true, batch: true }
                });

                for (const s of students) {
                    // 2. Upsert Alumni record with rich data
                    const alumni = await tx.alumni.upsert({
                        where: { rollNumber: s.rollNumber },
                        update: {
                            name: s.name,
                            mobile: s.mobile,
                            passingYear,
                            graduationDate: gradDate,
                            dateOfReporting: s.dateOfReporting,
                            dateOfBirth: s.dateOfBirth,
                            fatherName: s.fatherName,
                            nationality: s.nationality,
                            religion: s.religion,
                            category: s.category,
                            casteName: s.casteName,
                            departmentId: s.departmentId,
                            batchId: s.batchId,
                            academicYearId,
                        },
                        create: {
                            rollNumber: s.rollNumber,
                            name: s.name,
                            mobile: s.mobile,
                            passingYear,
                            graduationDate: gradDate,
                            dateOfReporting: s.dateOfReporting,
                            dateOfBirth: s.dateOfBirth,
                            fatherName: s.fatherName,
                            nationality: s.nationality,
                            religion: s.religion,
                            category: s.category,
                            casteName: s.casteName,
                            departmentId: s.departmentId,
                            batchId: s.batchId,
                            academicYearId,
                        }
                    });

                    // 3. Mark student as alumni (keep record for history)
                    await tx.student.update({
                        where: { id: s.id },
                        data: {
                            isAlumni: true,
                            alumniId: alumni.id,
                            year: "4",   // lock at 4th year
                            semester: "2"
                        }
                    });
                }
            });

            return NextResponse.json({ success: true, graduated: studentIds.length });

        } else {
            // ============ STANDARD PROMOTION ============
            if (!targetYear || !targetSemester) {
                return NextResponse.json({ error: "Target year and semester are required" }, { status: 400 });
            }

            const updateData: any = {
                year: String(targetYear),
                semester: String(targetSemester),
            };

            if (targetBatchId) {
                updateData.batchId = targetBatchId;
            }
            if (targetSectionId) {
                updateData.sectionId = targetSectionId;
            }
            if (targetDepartmentId) {
                updateData.departmentId = targetDepartmentId;
            }

            await prisma.student.updateMany({
                where: { id: { in: studentIds } },
                data: updateData,
            });

            return NextResponse.json({ success: true });
        }

    } catch (error: any) {
        console.error("Promotion Error:", error);
        return NextResponse.json({ error: error.message || "Promotion failed" }, { status: 500 });
    }
}
