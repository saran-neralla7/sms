import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "STUDENT") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const type = searchParams.get("type"); // "REGULAR" or "SUPPLY"

    if (!year || !semester || !type) {
        return NextResponse.json({ error: "Missing year, semester, or type" }, { status: 400 });
    }

    try {
        const username = (session.user as any).username;
        const student = await prisma.student.findUnique({
            where: { rollNumber: username }
        });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Helper function to filter and merge department subjects with student assigned subjects
        const getEligibleSubjectsForSemester = async (y: string, s: string, codeFilter?: string[]) => {
            // 1. Fetch subjects explicitly assigned to this student (e.g., specific Open Electives from other depts, or specific Professional Electives)
            const assignedSubjects = await prisma.subject.findMany({
                where: {
                    year: y,
                    semester: s,
                    students: { some: { id: student.id } },
                    ...(codeFilter ? { code: { in: codeFilter } } : {})
                },
                include: { electiveSlotRelation: true }
            });

            // Check if the student has any assigned OE subjects for this semester
            const hasAssignedOE = assignedSubjects.some(sub => 
                sub.electiveSlotRelation?.name?.toUpperCase().startsWith("OE") ||
                sub.name.toLowerCase().includes("open elective")
            );

            // 2. Fetch department subjects
            const deptSubjects = await prisma.subject.findMany({
                where: {
                    year: y,
                    semester: s,
                    departmentId: student.departmentId,
                    ...(codeFilter ? { code: { in: codeFilter } } : {})
                },
                include: { electiveSlotRelation: true }
            });

            // 3. Filter department subjects:
            // - Exclude subjects with slot "OE-..." offered by this dept (unless student is explicitly assigned, handled by assignedSubjects)
            // - Exclude generic placeholder subjects ("Open Elective-I/II/III/IV") if student already has assigned OE subjects
            const filteredDeptSubjects = deptSubjects.filter(sub => {
                const isSlotOE = sub.electiveSlotRelation?.name?.toUpperCase().startsWith("OE");
                const isNameOE = sub.name.toLowerCase().includes("open elective");

                // Never show own department OE subjects that belong to an OE slot
                if (isSlotOE) {
                    return assignedSubjects.some(as => as.id === sub.id);
                }

                // If it is a generic placeholder like "Open Elective-III"
                if (isNameOE) {
                    if (hasAssignedOE) {
                        return false; // Suppress placeholder since specific OE is assigned
                    }
                    return true;
                }

                return true;
            });

            // 4. Combine and deduplicate
            const combinedMap = new Map<string, typeof deptSubjects[0]>();
            for (const sub of filteredDeptSubjects) combinedMap.set(sub.id, sub);
            for (const sub of assignedSubjects) combinedMap.set(sub.id, sub);

            return Array.from(combinedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        };

        if (type === "REGULAR") {
            const subjects = await getEligibleSubjectsForSemester(year, semester);
            return NextResponse.json(subjects);
        } else if (type === "SUPPLY") {
            // Fetch the result for this year and semester
            const result = await prisma.semesterResult.findUnique({
                where: {
                    studentId_year_semester: {
                        studentId: student.id,
                        year: year,
                        semester: semester
                    }
                }
            });

            if (!result || !result.grades) {
                // No result uploaded yet, so student can select backlogs from all valid subjects of this semester
                const allSubjects = await getEligibleSubjectsForSemester(year, semester);
                return NextResponse.json(allSubjects);
            }

            // grades is an ARRAY of { grade: string, subjectCode: string }
            // subjectCode format: "2209106 - Engineering Graphics" — we need only the code prefix before " - "
            const gradesArr: { grade: string; subjectCode: string }[] = Array.isArray(result.grades)
                ? result.grades as any[]
                : Object.entries(result.grades as Record<string, string>).map(([subjectCode, grade]) => ({ subjectCode, grade }));

            const failingGrades = ["F", "AB", "ABSENT", "FAIL"];
            const failedSubjectCodes: string[] = [];

            for (const entry of gradesArr) {
                const gradeStr = String(entry.grade).toUpperCase().trim();
                if (failingGrades.includes(gradeStr)) {
                    // Extract only the code part: "2209106 - Engineering Graphics" → "2209106"
                    const codeOnly = entry.subjectCode.includes(" - ")
                        ? entry.subjectCode.split(" - ")[0].trim()
                        : entry.subjectCode.trim();
                    failedSubjectCodes.push(codeOnly);
                }
            }

            console.log(`SUPPLY: student=${student.id} y=${year} s=${semester} failedCodes=${JSON.stringify(failedSubjectCodes)}`);

            if (failedSubjectCodes.length === 0) {
                return NextResponse.json([]); // No failed subjects
            }

            // Fetch the subject details for the failed codes
            const failedSubjects = await getEligibleSubjectsForSemester(year, semester, failedSubjectCodes);
            return NextResponse.json(failedSubjects);
        } else {
            return NextResponse.json({ error: "Invalid type" }, { status: 400 });
        }
    } catch (error) {
        console.error("Eligible subjects error:", error);
        return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
    }
}
