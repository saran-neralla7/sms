import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const sectionId = searchParams.get("sectionId");
    const studentId = searchParams.get("studentId"); // Optional: Fetch for specific student

    try {
        const where: any = {};
        if (departmentId) where.student = { departmentId };
        if (year) where.year = year;
        if (semester) where.semester = semester;
        if (sectionId) where.student = { ...where.student, sectionId };
        if (studentId) where.studentId = studentId;

        const results = await prisma.semesterResult.findMany({
            where,
            include: {
                student: {
                    select: {
                        rollNumber: true,
                        name: true,
                        batch: true,
                        department: { select: { name: true } },
                        section: { select: { name: true } }
                    }
                }
            },
            orderBy: { student: { rollNumber: 'asc' } }
        });

        return NextResponse.json(results);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "USER") { // Only Admin/Faculty? 
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const body = await request.json(); // Expecting array of results OR single result
        const results = Array.isArray(body) ? body : [body];

        // Bulk upsert is ideal, but Prisma createMany doesn't support relation lookups easily if we only have rollNumber
        // We likely receive Roll Number from Excel. We need to find Student IDs.

        const processed = [];
        const errors = [];

        for (const res of results) {
            // 1. Find Student by Roll Number (if provided) or ID
            let studentId = res.studentId;
            let studentData = null;

            if (res.rollNumber) {
                studentData = await prisma.student.findUnique({
                    where: { rollNumber: String(res.rollNumber) },
                    include: {
                        subjects: { include: { electiveSlotRelation: true } }
                    }
                });
                if (studentData) studentId = studentData.id;
            } else if (studentId) {
                // Even if we have ID, we might need subjects if "ELECTIVE" is used
                studentData = await prisma.student.findUnique({
                    where: { id: studentId },
                    include: {
                        subjects: { include: { electiveSlotRelation: true } }
                    }
                });
            }

            if (!studentId || !studentData) {
                errors.push({ ...res, error: "Student not found" });
                continue;
            }

            // 1.5 Process Grades (Handle "ELECTIVE", "PE-1", etc., and "Code - Name" format)
            const processedGrades = (res.grades || []).map((g: any) => {
                let code = g.subjectCode;

                // Handle "Code - Name" format
                if (code.includes(" - ")) {
                    code = code.split(" - ")[0].trim();
                }

                // Handle Generic "ELECTIVE" placeholder
                if (code === "ELECTIVE") {
                    const actualSubject = studentData?.subjects.find(s =>
                        s.year === String(res.year) && s.semester === String(res.semester) && s.isElective && !s.electiveSlotRelation
                    );
                    if (actualSubject) code = actualSubject.code;
                }

                // Handle Slot Placeholders (e.g., "PE-1", "OE-1")
                // We check if the student has a subject with this electiveSlot
                if (studentData) {
                    const slotSubject = studentData.subjects.find(s =>
                        s.year === String(res.year) && s.semester === String(res.semester) && s.electiveSlotRelation?.name === code
                    );
                    if (slotSubject) {
                        code = slotSubject.code;
                    }
                }

                return { ...g, subjectCode: code };
            });

            // 2. Upsert Result
            try {
                const upserted = await prisma.semesterResult.upsert({
                    where: {
                        studentId_year_semester: {
                            studentId,
                            year: String(res.year),
                            semester: String(res.semester)
                        }
                    },
                    update: {
                        sgpa: String(res.sgpa),
                        cgpa: String(res.cgpa),
                        grades: res.grades // JSON
                    },
                    create: {
                        studentId,
                        year: String(res.year),
                        semester: String(res.semester),
                        sgpa: String(res.sgpa),
                        cgpa: String(res.cgpa),
                        grades: res.grades
                    }
                });
                processed.push(upserted);
            } catch (e) {
                errors.push({ ...res, error: "Database error" });
            }
        }

        return NextResponse.json({
            success: processed.length,
            failed: errors.length,
            errors
        });

    } catch (error) {
        console.error("Result Upload Error:", error);
        return NextResponse.json({ error: "Failed to upload results" }, { status: 500 });
    }
}
