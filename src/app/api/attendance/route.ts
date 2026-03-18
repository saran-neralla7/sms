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
            labBatchId,
            students
        } = body;

        console.log("Attendance Submission Payload:", {
            date, sectionIds, sectionId, studentCount: students?.length, periodIds
        });

        // Validation
        if (!date || !year || !semester || (!sectionId && (!sectionIds || sectionIds.length === 0)) || !departmentId || !students) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Block future dates
        const submittedDate = new Date(date);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // Allow the full current day
        if (submittedDate > today) {
            return NextResponse.json({ error: "Cannot post attendance for future dates." }, { status: 400 });
        }

        // Department Enforcement
        // Fetch LIVE User DB context to ensure stale cookies don't bypass security
        const dbUser = await prisma.user.findUnique({
            where: { id: (session.user as any).id },
            select: { role: true, departmentId: true }
        });

        if (!dbUser) {
            return NextResponse.json({ error: "User profile not found in database." }, { status: 403 });
        }

        const userRole = dbUser.role;
        const userDeptId = dbUser.departmentId;

        if (["SMS_USER", "USER"].includes(userRole)) {
            if (userDeptId && userDeptId !== departmentId) {
                return NextResponse.json({ error: "Access Denied: You cannot submit attendance for a different department. Please refresh to lock your assigned department." }, { status: 403 });
            }
        }

        // Prevent SMS_USER from ever attaching a Subject
        let finalSubjectId = subjectId;
        if (userRole === "SMS_USER" || userRole === "USER") {
            finalSubjectId = null;
        }

        // Verify Subject matches the provided Year and Semester
        if (finalSubjectId && year && semester) {
            const subject = await prisma.subject.findUnique({ where: { id: finalSubjectId } });
            if (!subject) {
                return NextResponse.json({ error: "Invalid Subject selected" }, { status: 400 });
            }
            if (subject.year !== String(year) || subject.semester !== String(semester)) {
                return NextResponse.json({
                    error: `Subject '${subject.name}' belongs to Year ${subject.year} - Sem ${subject.semester}, but you are trying to post for Year ${year} - Sem ${semester}. Please refresh the page and select the correct subject.`
                }, { status: 400 });
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

        // Pre-fetch valid students for all target sections to prevent UI stale-state mixing
        // CRITICAL: Filter by departmentId + year + semester to prevent cross-department mixing
        // (Sections like "A" can be shared across multiple departments)
        const validStudents = await prisma.student.findMany({
            where: {
                sectionId: { in: targetSectionIds },
                departmentId,
                year: String(year),
                semester: String(semester)
            },
            select: { rollNumber: true, sectionId: true, name: true, mobile: true, studentContactNumber: true }
        });

        // Create a fast lookup Map of rollNumber -> student
        const validStudentMap = new Map();
        for (const vs of validStudents) {
            validStudentMap.set(vs.rollNumber.toLowerCase(), vs);
        }

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
            const sectionStudentsRaw = studentsBySection.get(sid) || [];
            const sectionStudents = [];

            // Strict Validation: Only accept students natively enrolled in this section
            for (const s of sectionStudentsRaw) {
                const roll = String(s.rollNumber).toLowerCase();
                const dbStudent = validStudentMap.get(roll);

                // If student exists and their DB sectionId matches the target sid, accept them
                if (dbStudent && dbStudent.sectionId === sid) {
                    sectionStudents.push({
                        "Roll Number": dbStudent.rollNumber,
                        "Name": dbStudent.name,
                        "Status": s.status || "Absent",
                        "Mobile": dbStudent.mobile || dbStudent.studentContactNumber || s.mobile,
                        "Subject ID": finalSubjectId || null,
                        "Lab Batch ID": labBatchId || null
                    });
                }
            }

            // If the filtered list is empty, skip this section to prevent blank records
            if (sectionStudents.length === 0) continue;

            // Serialize details for this section only
            const details = JSON.stringify(sectionStudents);

            // Create record for each period
            const userRole = (session.user as any).role;
            const recordType = userRole === "SMS_USER" ? "SMS" : "ACADEMIC";

            for (const pid of finalPeriodIds) {
                // Check if duplicate already exists based strictly on the DB unique constraint
                const existing = await prisma.attendanceHistory.findFirst({
                    where: {
                        date: new Date(date),
                        sectionId: sid,
                        periodId: pid,
                        year: String(year),
                        departmentId
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
                        mergedMap.set(s["Roll Number"], {
                            "Roll Number": s["Roll Number"],
                            "Name": s["Name"],
                            "Status": s["Status"],
                            "Mobile": s["Mobile"],
                            "Subject ID": s["Subject ID"],
                            "Lab Batch ID": s["Lab Batch ID"]
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
                                details: mergedDetailsJson
                                // We purposefully do NOT overwrite the parent subjectId for mixed classes.
                                // The individual student JSON "Subject ID" governs their attended subject.
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
                            subjectId: finalSubjectId || null,
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
