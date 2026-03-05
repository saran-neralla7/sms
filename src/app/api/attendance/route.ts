import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            date,
            year,
            semester,
            sectionId,      // Single section (Legacy/Fallback)
            sectionIds,     // NEW: Multi-section array
            departmentId,
            subjectId,
            periodId,
            periodIds,
            students
        } = body;

        console.log("Attendance Submission Payload:", {
            date, sectionIds, sectionId, studentCount: students?.length, periodIds
        });

        // Validation
        if (!date || !year || !semester || (!sectionId && (!sectionIds || sectionIds.length === 0)) || !departmentId || !students) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Department Enforcement
        const userRole = (session.user as any).role;
        const userDeptId = (session.user as any).departmentId;

        if (!["ADMIN", "DIRECTOR", "PRINCIPAL", "FACULTY", "HOD"].includes(userRole)) {
            if (userDeptId && userDeptId !== departmentId) {
                return NextResponse.json({ error: "You can only submit attendance for your own department" }, { status: 403 });
            }
        }

        // Normalize periods
        const finalPeriodIds: (string | null)[] = (periodIds && periodIds.length > 0)
            ? periodIds
            : (periodId ? [periodId] : [null]);

        // Normalize Sections: If sectionIds provided, use it. Else use [sectionId]
        const targetSectionIds: string[] = (sectionIds && sectionIds.length > 0) ? sectionIds : [sectionId];

        // Get Active Academic Year
        const activeYear = await prisma.academicYear.findFirst({
            where: { isCurrent: true }
        });

        // Group students by section
        // Map<SectionID, Student[]>
        const studentsBySection = new Map<string, any[]>();

        if (sectionIds && sectionIds.length > 0) {
            // Multi-section mode: Expect students to have contain 'sectionId'
            for (const s of students) {
                if (!s.sectionId) {
                    // Fallback: If for some reason missing, maybe assign to first? 
                    // Or error? Let's assign to 'sectionId' param if available as fallback
                    if (sectionId) {
                        const list = studentsBySection.get(sectionId) || [];
                        list.push(s);
                        studentsBySection.set(sectionId, list);
                    }
                    continue;
                }
                const list = studentsBySection.get(s.sectionId) || [];
                list.push(s);
                studentsBySection.set(s.sectionId, list);
            }
        } else {
            // Single section mode
            studentsBySection.set(sectionId, students);
        }

        const transactions: any[] = [];

        // For each section, for each period, create a record
        for (const sid of targetSectionIds) {
            const sectionStudents = studentsBySection.get(sid) || [];

            // Serialize details for this section only
            const details = JSON.stringify(sectionStudents.map((s: any) => ({
                "Roll Number": s.rollNumber,
                "Name": s.name,
                "Status": s.status,
                "Mobile": s.mobile
            })));

            // Create record for each period
            const userRole = (session.user as any).role;
            const recordType = userRole === "SMS_USER" ? "SMS" : "ACADEMIC";

            for (const pid of finalPeriodIds) {
                // Check if duplicate already exists based strictly on the DB unique constraint
                const existing = await prisma.attendanceHistory.findFirst({
                    where: {
                        date: new Date(date),
                        sectionId: sid,
                        periodId: pid
                    }
                });

                if (existing) {
                    // Pull existing details to support merging (e.g., merging Batch 1 and Batch 2 in the same class hour)
                    let currentDetails: any[] = [];
                    try {
                        if (existing.details) {
                            currentDetails = JSON.parse(existing.details);
                        }
                    } catch (e) {
                        // Fallback to empty if parse fails
                    }

                    // Create a map by Roll Number to merge the new payload seamlessly
                    const mergedMap = new Map();
                    currentDetails.forEach(student => {
                        mergedMap.set(student["Roll Number"], student);
                    });

                    // Overwrite/Append with the newly submitted students (this covers Batch 2 adding to Batch 1)
                    sectionStudents.forEach((s: any) => {
                        mergedMap.set(s.rollNumber, {
                            "Roll Number": s.rollNumber,
                            "Name": s.name,
                            "Status": s.status,
                            "Mobile": s.mobile
                        });
                    });

                    const mergedDetailsJson = JSON.stringify(Array.from(mergedMap.values()));

                    // Update the existing record instead of skipping or crashing
                    transactions.push(
                        prisma.attendanceHistory.update({
                            where: { id: existing.id },
                            data: {
                                status: "Completed",
                                type: recordType,
                                fileName: "Manual Entry Update",
                                downloadedBy: (session.user as any).id,
                                details: mergedDetailsJson,
                                ...(subjectId ? { subjectId } : {})
                            }
                        })
                    );
                    continue;
                }

                transactions.push(
                    prisma.attendanceHistory.create({
                        data: {
                            date: new Date(date),
                            year,
                            semester,
                            sectionId: sid,
                            departmentId,
                            academicYearId: activeYear?.id || null,
                            periodId: pid,
                            subjectId: subjectId || null,
                            status: "Completed",
                            type: recordType,
                            fileName: "Manual Entry",
                            downloadedBy: (session.user as any).id,
                            details
                        }
                    })
                );
            }
        }

        const records = await prisma.$transaction(transactions);

        return NextResponse.json({ success: true, count: records.length });

    } catch (error) {
        console.error("Attendance Submission Error:", error);
        return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
    }
}
