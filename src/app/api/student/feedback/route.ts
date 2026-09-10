import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getBatchForStudentSubject } from "@/lib/elective-batches";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== "STUDENT") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const student = await prisma.student.findUnique({
            where: { rollNumber: session.user.username as string },
            include: { section: true, batch: true, labBatch: true, subjects: { select: { id: true } } }
        });

        if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

        const registeredSubjectIds = (student.subjects || []).map((s: any) => s.id);

        const now = new Date();

        // Find active academic year
        const activeAcademicYear = await prisma.academicYear.findFirst({
            where: { isCurrent: true }
        });

        if (!activeAcademicYear) {
            return NextResponse.json({ forms: [] });
        }

        // Find active forms for this academic year, targeted at this student's section, year, and semester
        const activeForms = await prisma.feedbackForm.findMany({
            where: {
                academicYearId: activeAcademicYear.id,
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
                targetSections: {
                    some: {
                        id: student.sectionId
                    }
                },
                // Filter by student's department if set on the form
                OR: [
                    { targetDepartmentId: null },
                    { targetDepartmentId: student.departmentId }
                ],
                // AND filter by student's batch if set on the form
                AND: [
                    {
                        OR: [
                            { targetBatchId: null },
                            { targetBatchId: student.batchId }
                        ]
                    }
                ]
            },
            include: {
                template: {
                    include: {
                        questions: { orderBy: { order: "asc" }, where: { isActive: true } }
                    }
                }
            }
        });

        // Further filter: if targetYear or targetSemester is set on form, student must match
        const filteredForms = activeForms.filter((f: any) =>
            (f.targetYear === null || f.targetYear === parseInt(String(student.year))) &&
            (f.targetSemester === null || f.targetSemester === parseInt(String(student.semester)))
        );

        if (filteredForms.length === 0) {
            return NextResponse.json({ forms: [] });
        }

        // Check if student has already submitted
        const formsWithStatus = await Promise.all(filteredForms.map(async (form: any) => {
            const submission = await prisma.feedbackSubmission.findUnique({
                where: { unique_student_submission: { formId: form.id, studentId: student.id } }
            });

            if (submission) {
                return { ...form, submitted: true };
            }

            let mappings: any[] = [];
            
            if (form.template?.type === "FACULTY_MAPPED") {
                // 1. Fetch Core (Non-Elective) Subjects for Student's EXACT Department, Section, Year & Semester
                const coreMappings = await prisma.facultySubjectMapping.findMany({
                    where: {
                        sectionId: student.sectionId,
                        academicYearId: activeAcademicYear.id,
                        subject: {
                            departmentId: student.departmentId, // MUST match student's department! (Fixes ECE subjects showing in CSE)
                            year: String(student.year),
                            semester: String(student.semester),
                            isElective: false
                        }
                    },
                    include: {
                        faculty: { select: { id: true, empName: true, photoUrl: true, department: { select: { code: true } } } },
                        subject: { select: { id: true, name: true, code: true, isElective: true } }
                    }
                });

                // 2. Fetch Elective (Open Elective / Professional Elective) Subjects ONLY for Registered Elective IDs
                let electiveMappings: any[] = [];
                if (registeredSubjectIds.length > 0) {
                    const rawElectiveMappings = await prisma.facultySubjectMapping.findMany({
                        where: {
                            academicYearId: activeAcademicYear.id,
                            subjectId: { in: registeredSubjectIds }, // MUST match student's registered electives! (Fixes IAI showing for BEE student)
                            sectionId: student.sectionId
                        },
                        include: {
                            faculty: { select: { id: true, empName: true, photoUrl: true, department: { select: { code: true } } } },
                            subject: { select: { id: true, name: true, code: true, isElective: true } }
                        }
                    });

                    // Group raw elective mappings by subjectId to handle multi-faculty / batch splitting
                    const electiveBySubject = new Map<string, any[]>();
                    for (const m of rawElectiveMappings) {
                        if (m.faculty && m.subject) {
                            if (!electiveBySubject.has(m.subjectId)) {
                                electiveBySubject.set(m.subjectId, []);
                            }
                            electiveBySubject.get(m.subjectId)!.push(m);
                        }
                    }

                    // Get section student list for index-based batch matching if needed
                    const sectionStudents = await prisma.student.findMany({
                        where: { sectionId: student.sectionId, isLeftCollege: false },
                        select: { id: true },
                        orderBy: { rollNumber: "asc" }
                    });
                    const studentIdx = Math.max(0, sectionStudents.findIndex(s => s.id === student.id));

                    // For each registered elective, pick the EXACT faculty assigned to this student
                    for (const [subjId, facList] of electiveBySubject.entries()) {
                        if (facList.length === 1) {
                            electiveMappings.push(facList[0]);
                        } else if (facList.length > 1) {
                            // 1. Check OE batch assignment from elective-batches.json (Admin OE Batch Allocation)
                            const allocatedOeBatch = getBatchForStudentSubject(student.id, subjId);
                            let matchedFaculty = null;
                            if (allocatedOeBatch) {
                                matchedFaculty = facList.find(m => m.batch && m.batch.trim().toLowerCase() === allocatedOeBatch.trim().toLowerCase());
                            }

                            // 2. Fallback to student's labBatch or batchString if not found in OE batch allocation
                            if (!matchedFaculty) {
                                const studentBatchName = ((student as any).labBatch?.name || (student as any).batchString || "").toLowerCase();
                                matchedFaculty = facList.find(m => m.batch && studentBatchName.includes(m.batch.toLowerCase()));
                            }

                            if (matchedFaculty) {
                                electiveMappings.push(matchedFaculty);
                            } else {
                                // If batch is null or unassigned, split students evenly among the mapped faculty
                                const chunkIndex = Math.floor((studentIdx / Math.max(1, sectionStudents.length)) * facList.length);
                                const assignedFaculty = facList[Math.min(chunkIndex, facList.length - 1)];
                                electiveMappings.push(assignedFaculty);
                            }
                        }
                    }
                }

                // Combine Core + Elective mappings
                const allMappings = [...coreMappings, ...electiveMappings];

                // Final deduplication by facultyId + subjectId
                const uniqueMap = new Map();
                for (const m of allMappings) {
                    if (m.faculty && m.subject) {
                        const key = `${m.facultyId}_${m.subjectId}`;
                        if (!uniqueMap.has(key)) {
                            uniqueMap.set(key, m);
                        }
                    }
                }
                mappings = Array.from(uniqueMap.values());

                // Sort subjects by subject code in alphanumeric ascending order (e.g. CS3101, CS3102, CS3103...)
                mappings.sort((a: any, b: any) => {
                    const codeA = (a.subject?.code || "").trim();
                    const codeB = (b.subject?.code || "").trim();
                    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                });
            }

            return { ...form, submitted: false, mappings, questions: form.template?.questions || [] };
        }));

        return NextResponse.json({ 
            forms: formsWithStatus,
            studentInfo: { 
                year: student.year, 
                semester: student.semester,
                batch: student.batchString || student.batch?.name || "N/A"
            },
            academicYear: activeAcademicYear.name
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
