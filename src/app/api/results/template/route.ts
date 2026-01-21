import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "USER") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const studentYear = searchParams.get("studentYear");
    const targetSectionIds = searchParams.get("sectionIds")?.split(",") || [];
    const regulationParam = searchParams.get("regulation") || "R22"; // Default to R22

    if (!departmentId || !year || !semester) {
        return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    try {
        // Resolve Regulation ID
        const regRecord = await prisma.regulation.findUnique({ where: { name: regulationParam } });
        if (!regRecord) {
            return NextResponse.json({ error: `Regulation '${regulationParam}' not found` }, { status: 404 });
        }
        const regulationId = regRecord.id;

        // 1. Fetch Subjects for the EXAM Context (Result Year/Sem) AND Regulation
        const allSubjects = await prisma.subject.findMany({
            where: { departmentId, year, semester, regulationId },
            select: { code: true, name: true, isElective: true, electiveSlot: true },
            orderBy: { code: 'asc' }
        });

        // Categorize Subjects
        const coreSubjects = allSubjects.filter(s => !s.isElective && !s.electiveSlot);

        // Identify unique elective slots (e.g., "PE-1", "OE-1") present in this semester
        const electiveSlots = Array.from(new Set(
            allSubjects
                .filter(s => s.electiveSlot)
                .map(s => s.electiveSlot!)
        )).sort();

        // Check if there are any "Generic" electives (isElective=true but NO slot)
        // These fall back to the single "ELECTIVE" column
        const hasGenericElectives = allSubjects.some(s => s.isElective && !s.electiveSlot);

        // 2. Fetch Students
        const whereStudent: any = {
            departmentId,
            year: studentYear || year,
            regulationId // Only fetch students of this regulation ID
        };
        if (targetSectionIds.length > 0) {
            whereStudent.sectionId = { in: targetSectionIds };
        }

        const students = await prisma.student.findMany({
            where: whereStudent,
            include: {
                subjects: true, // Fetch allocated subjects (for identifying their elective)
                results: {
                    where: { year, semester } // Results for the specific EXAM year/sem
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        // 3. Construct Data Rows
        const rows = students.map(student => {
            const result = student.results[0];
            const grades = (result?.grades as any[]) || [];

            const row: any = {
                "Roll Number": student.rollNumber,
                "Name": student.name,
                "SGPA": result?.sgpa || "",
                "CGPA": result?.cgpa || ""
            };

            // Process Core Subjects
            coreSubjects.forEach(sub => {
                const gradeEntry = grades.find(g => g.subjectCode === sub.code);
                row[`${sub.code} - ${sub.name}`] = gradeEntry ? gradeEntry.grade : "";
            });

            // Process Slot Electives (PE-1, OE-1, etc)
            electiveSlots.forEach(slot => {
                // Find which subject this student is taking for this SLOT
                // The student's allocated subject must match one of the exam's subjects in this slot
                const studentElective = student.subjects.find(s =>
                    s.electiveSlot === slot &&
                    // Verify it's not just same slot, but also same year/sem context? 
                    // Usually allocated subjects are distinct. But safer to check code is in allSubjects?
                    allSubjects.some(asm => asm.code === s.code)
                );

                if (studentElective) {
                    const gradeEntry = grades.find(g => g.subjectCode === studentElective.code);
                    row[slot] = gradeEntry ? gradeEntry.grade : "";
                } else {
                    row[slot] = ""; // Not allocated
                }
            });

            // Process Generic Elective Column (Fallback)
            if (hasGenericElectives) {
                const studentElective = student.subjects.find(s =>
                    s.isElective && !s.electiveSlot &&
                    allSubjects.some(asm => asm.code === s.code)
                );

                if (studentElective) {
                    const gradeEntry = grades.find(g => g.subjectCode === studentElective.code);
                    row["ELECTIVE"] = gradeEntry ? gradeEntry.grade : "";
                } else {
                    row["ELECTIVE"] = "";
                }
            }

            return row;
        });

        // Construct Headers
        const subjectHeaders = [
            ...coreSubjects.map(s => `${s.code} - ${s.name}`),
            ...electiveSlots,
            ...(hasGenericElectives ? ["ELECTIVE"] : [])
        ];

        return NextResponse.json({
            subjects: subjectHeaders,
            rows
        });

    } catch (error) {
        console.error("Template Generation Error:", error);
        return NextResponse.json({ error: "Failed to generate template data" }, { status: 500 });
    }
}
