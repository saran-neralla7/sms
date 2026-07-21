import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/logging";
import { cookies } from "next/headers";

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
            sectionId,
            sectionIds,
            departmentId,
            subjectId,
            periodId,
            periodIds,
            labBatchId,
            students,
            academicYearId, // NEW: passed from frontend cookie
            topicsTaught // NEW: rich text teaching diary
        } = body;

        console.log("Attendance Submission Payload:", {
            date, sectionIds, sectionId, studentCount: students?.length, periodIds, hasTopics: !!topicsTaught
        });

        // Determine if open elective first for validation purposes
        let isElective = false;
        if (subjectId) {
            const subject = await prisma.subject.findUnique({
                where: { id: subjectId },
                select: { isElective: true, type: true }
            });
            if (subject && (subject.isElective || (subject.type && subject.type.toUpperCase().includes("ELECTIVE")))) {
                isElective = true;
            }
        }

        // Validation
        const isValidationOk = date && year && semester && students && 
            (isElective || ((sectionId || (sectionIds && sectionIds.length > 0)) && departmentId));
        if (!isValidationOk) {
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
            isElective = false;
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

        // Get Academic Year: use passed academicYearId (from cookie) or fall back to isCurrent
        let resolvedAcademicYearId: string | null = academicYearId || null;
        if (!resolvedAcademicYearId) {
            const cookieStore = await cookies();
            const cookieYearId = cookieStore.get("academic-year-id")?.value;
            resolvedAcademicYearId = cookieYearId || null;
        }
        if (!resolvedAcademicYearId) {
            const activeYear = await prisma.academicYear.findFirst({
                where: { isCurrent: true }
            });
            resolvedAcademicYearId = activeYear?.id || null;
        }

        const acadYearObj = resolvedAcademicYearId
            ? await prisma.academicYear.findUnique({ where: { id: resolvedAcademicYearId } })
            : await prisma.academicYear.findFirst({ where: { isCurrent: true } });

        const isCurrentYear = !acadYearObj || acadYearObj.isCurrent;

        const studentWhereClause: any = {};
        if (isCurrentYear) {
            studentWhereClause.year = String(year);
            studentWhereClause.semester = String(semester);
            studentWhereClause.isAlumni = false;
            studentWhereClause.isLeftCollege = false;
            studentWhereClause.isDetained = false;
        } else {
            const match = acadYearObj.name.match(/^(\d{4})/);
            if (match && year) {
                const acadStartYear = parseInt(match[1]);
                const targetBatchStartYear = acadStartYear - (parseInt(year) - 1);
                studentWhereClause.batch = {
                    startYear: targetBatchStartYear
                };
            } else {
                studentWhereClause.year = String(year);
                studentWhereClause.semester = String(semester);
                studentWhereClause.isAlumni = false;
                studentWhereClause.isLeftCollege = false;
                studentWhereClause.isDetained = false;
            }
        }

        let tempTargetSectionIds: string[] = [];
        if (isElective) {
            studentWhereClause.subjects = { some: { id: finalSubjectId } };
        } else {
            tempTargetSectionIds = (sectionIds && sectionIds.length > 0) ? sectionIds : [sectionId];
            studentWhereClause.sectionId = { in: tempTargetSectionIds };
            studentWhereClause.departmentId = departmentId;
        }

        const validStudents = await prisma.student.findMany({
            where: studentWhereClause,
            select: { rollNumber: true, sectionId: true, name: true, mobile: true, studentContactNumber: true, departmentId: true }
        });

        // Create a fast lookup Map of rollNumber -> student
        const validStudentMap = new Map();
        for (const vs of validStudents) {
            validStudentMap.set(vs.rollNumber.toLowerCase(), vs);
        }

        // Group students by section
        const studentsBySection = new Map<string, any[]>();

        if (isElective) {
            // Group elective students by their actual database sectionId!
            for (const s of students) {
                const roll = String(s.rollNumber).toLowerCase();
                const dbStudent = validStudentMap.get(roll);
                const sId = dbStudent?.sectionId;
                if (sId) {
                    const list = studentsBySection.get(sId) || [];
                    list.push(s);
                    studentsBySection.set(sId, list);
                }
            }
        } else if (sectionIds && sectionIds.length > 0) {
            // Multi-section mode: Expect students to contain 'sectionId'
            for (const s of students) {
                if (!s.sectionId) {
                    // Fallback: If for some reason missing, assign to first
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

        const targetSectionIds: string[] = isElective
            ? Array.from(studentsBySection.keys())
            : tempTargetSectionIds;

        const recordType = userRole === "SMS_USER" ? "SMS" : "ACADEMIC";

        const records = await prisma.$transaction(async (tx) => {
            const results = [];

            // For each section, for each period, create a record
            for (const sid of targetSectionIds) {
                const sectionStudentsRaw = studentsBySection.get(sid) || [];
                const sectionStudents = [];

                // Strict Validation: Only accept students natively enrolled in this section (unless elective)
                for (const s of sectionStudentsRaw) {
                    const roll = String(s.rollNumber).toLowerCase();
                    const dbStudent = validStudentMap.get(roll);

                    // If student exists and their DB sectionId matches the target sid (or is elective), accept them
                    if (dbStudent && (isElective || dbStudent.sectionId === sid)) {
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

                // Resolve departmentId for this section's students if elective
                let sectionDeptId = departmentId;
                if (isElective && sectionStudents.length > 0) {
                    const firstRoll = String(sectionStudents[0]["Roll Number"]).toLowerCase();
                    const dbStudent = validStudentMap.get(firstRoll);
                    if (dbStudent?.departmentId) {
                        sectionDeptId = dbStudent.departmentId;
                    }
                }

                // Serialize details for this section only
                const details = JSON.stringify(sectionStudents);

                for (const pid of finalPeriodIds) {
                    // Check if duplicate already exists based strictly on the DB unique constraint
                    const existing = await tx.attendanceHistory.findFirst({
                        where: {
                            date: new Date(date),
                            sectionId: sid,
                            periodId: pid,
                            year: String(year),
                            departmentId: sectionDeptId
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

                        // Update data object
                        const updateData: any = {
                            status: "Completed",
                            type: recordType,
                            fileName: "Manual Entry Update",
                            downloadedBy: (session.user as any).id,
                            details: mergedDetailsJson
                        };

                        if (topicsTaught !== undefined) {
                            updateData.topicsTaught = topicsTaught;
                        }

                        // Update the existing record instead of skipping or crashing
                        const updated = await tx.attendanceHistory.update({
                            where: { id: existing.id },
                            data: updateData
                        });
                        results.push(updated);
                        continue;
                    }

                    const created = await tx.attendanceHistory.create({
                        data: {
                            date: new Date(date),
                            year,
                            semester,
                            sectionId: sid,
                            departmentId: sectionDeptId,
                            academicYearId: resolvedAcademicYearId,
                            periodId: pid,
                            subjectId: finalSubjectId || null,
                            status: "Completed",
                            type: recordType,
                            fileName: "Manual Entry",
                            downloadedBy: (session.user as any).id,
                            details,
                            topicsTaught: topicsTaught || null
                        }
                    });
                    results.push(created);
                }
            }
            return results;
        });

        // Sync topicsTaught to other sections mapped to the same faculty for the same subject, date, and periods
        if (topicsTaught && finalSubjectId) {
            try {
                const recordType = userRole === "SMS_USER" ? "SMS" : "ACADEMIC";
                // 1. Resolve facultyId for the logged-in user
                let resolvedFacultyId: string | null = null;
                const userObj = await prisma.user.findUnique({
                    where: { id: (session.user as any).id },
                    select: { facultyId: true }
                });
                resolvedFacultyId = userObj?.facultyId || null;

                if (resolvedFacultyId) {
                    // 2. Find other sections mapped to this subject for this faculty
                    const mappings = await prisma.facultySubjectMapping.findMany({
                        where: {
                            academicYearId: resolvedAcademicYearId || undefined,
                            subjectId: finalSubjectId,
                            facultyId: resolvedFacultyId
                        },
                        select: { sectionId: true }
                    });

                    const allMappedSectionIds = Array.from(new Set(mappings.map(m => m.sectionId)));
                    const otherSectionIds = allMappedSectionIds.filter(sid => !targetSectionIds.includes(sid));

                    if (otherSectionIds.length > 0) {
                        const subject = await prisma.subject.findUnique({
                            where: { id: finalSubjectId }
                        });

                        if (subject) {
                            for (const sid of otherSectionIds) {
                                for (const pid of finalPeriodIds) {
                                    // Check if existing record exists
                                    const existingOther = await prisma.attendanceHistory.findFirst({
                                        where: {
                                            date: new Date(date),
                                            sectionId: sid,
                                            periodId: pid,
                                            year: String(year),
                                            departmentId: subject.departmentId
                                        }
                                    });

                                    if (existingOther) {
                                        await prisma.attendanceHistory.update({
                                            where: { id: existingOther.id },
                                            data: {
                                                topicsTaught,
                                                subjectId: finalSubjectId,
                                                downloadedBy: (session.user as any).id
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to sync teaching diary in attendance route:", err);
            }
        }

        // Audit Log for Attendance Submission
        await logActivity(
            (session.user as any).id,
            records.some(r => r.fileName === "Manual Entry Update") ? "UPDATE" : "CREATE",
            "Attendance",
            targetSectionIds.join(", "),
            {
                date,
                year,
                semester,
                departmentId,
                subjectId: finalSubjectId,
                periodIds: finalPeriodIds,
                recordCount: records.length
            }
        );

        return NextResponse.json({ success: true, count: records.length });

    } catch (error) {
        console.error("Attendance Submission Error:", error);
        return NextResponse.json({ error: "Failed to submit attendance" }, { status: 500 });
    }
}
