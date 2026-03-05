
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const { date, sectionId, departmentId, year, semester, periodIds, subjectId, labBatchId } = await request.json();

        if (!date || !sectionId || !departmentId || !year || !semester || !periodIds || !Array.isArray(periodIds) || periodIds.length === 0) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        // Fetch lab batch students if a labBatchId was provided
        let labBatchStudentRolls: string[] = [];
        if (labBatchId) {
            const batchStudents = await prisma.student.findMany({
                where: { labBatchId },
                select: { rollNumber: true }
            });
            labBatchStudentRolls = batchStudents.map(s => s.rollNumber);
        }

        // Find existing records for this specific class configuration on this date in the requested periods
        const existingRecords = await prisma.attendanceHistory.findMany({
            where: {
                date: new Date(date),
                sectionId: sectionId,
                departmentId: departmentId,
                year: year,
                semester: semester,
                periodId: { in: periodIds },
                status: "Completed",
                type: "ACADEMIC" // Only care about Academic conflicts
            },
            include: {
                subject: true,
                user: { select: { username: true } },
                period: true
            }
        });

        if (existingRecords.length > 0) {
            const conflict = existingRecords.find((r: any) => {
                // Universal Rule 1: If a specific lab batch is being submitted, check for student overlap.
                // If the students in this lab batch DO NOT overlap with the students already marked in the existing record,
                // then they are completely separate groups of students. In this case, there is NO conflict whatsoever, 
                // regardless of whether they match the subject or not.
                if (labBatchId && labBatchStudentRolls.length > 0) {
                    try {
                        const details = JSON.parse(r.details || "[]");
                        const existingRolls = new Set(details.map((d: any) => d["Roll Number"]));
                        const overlap = labBatchStudentRolls.some(roll => existingRolls.has(roll));

                        if (!overlap) {
                            return false; // distinct batches, parallel marking allowed.
                        }
                    } catch (e) {
                        // Fallback to strict checking if parsing fails
                    }
                }

                // If we reach here, either:
                // a) No labBatchId was provided (it's a whole class submission)
                // b) A labBatchId was provided, but there IS an overlap (meaning someone already posted attendance for these exact students)

                // Rule 2: If the existing record is for the EXACT SAME subject, it's a conflict.
                // We warn the user to prevent accidental double-posting/overwriting.
                if (subjectId && r.subjectId === subjectId) {
                    return true;
                }

                // Rule 3: Allow parallel electives for the whole class or partial class (assuming distinct subjects).
                // If the existing subject is purely an elective or a lab elective, we allow it.
                if (!r.subject) return false;
                if (r.subject.isElective) return false;

                const isElectiveLab = r.subject.type === "LAB" && /elective/i.test(r.subject.name);
                if (isElectiveLab) return false;

                // Rule 4: If the existing subject is a CORE subject (not an elective, not a lab elective),
                // and there was student overlap (or a whole class submission), it's a hard conflict.
                return true;
            });

            if (conflict) {
                const subjectName = (conflict as any).subject?.name || "Unknown Subject";
                const userName = (conflict as any).user?.username || "Unknown User";
                const periodName = (conflict as any).period?.name || "Unknown Period";

                return NextResponse.json({
                    conflict: true,
                    message: `Attendance already posted by ${userName} for ${subjectName} in ${periodName}.`
                });
            }
        }

        return NextResponse.json({ conflict: false });

    } catch (error) {
        console.error("Conflict check error:", error);
        return NextResponse.json({ error: "Failed to check conflicts" }, { status: 500 });
    }
}
