import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isBSHHod } from "@/lib/permissions";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const semester = searchParams.get("semester");
    const section = searchParams.get("section"); // This is actually sectionId now? Or name? Let's check params.
    // Ideally frontend sends ID. But if it sends "A", we need to find Section ID.
    // Let's assume frontend sends IDs for robust code or we join tables.
    // For now, let's assume sectionId is passed as 'section' param or we look it up.
    // Given the major UI refactor, let's switch to 'sectionId'.

    const sectionId = searchParams.get("sectionId");
    const sectionIds = searchParams.get("sectionIds"); // Comma separated
    const subjectId = searchParams.get("subjectId"); // Filter by enrolled subject

    const page = parseInt(searchParams.get("page") || "1");
    const limitParam = searchParams.get("limit");
    // If limit is not provided, default to 20. If provided, parse it.
    // If limit is -1, it means "All", so we set effectively infinite or handle logic.
    const limit = limitParam ? parseInt(limitParam) : 20;

    // Pagination Logic
    const isAll = limit === -1;
    const skip = isAll ? 0 : (page - 1) * limit;
    const take = isAll ? undefined : limit;

    const showAlumni = searchParams.get("showAlumni") === "true";
    const showLeftCollege = searchParams.get("showLeftCollege") === "true";
    const showDetained = searchParams.get("showDetained") === "true";

    // Check if subject is elective
    let isElective = false;
    if (subjectId) {
        const subjectInfo = await prisma.subject.findUnique({
            where: { id: subjectId },
            select: { isElective: true, type: true }
        });
        if (subjectInfo && (subjectInfo.isElective || (subjectInfo.type && subjectInfo.type.toUpperCase().includes("ELECTIVE")))) {
            isElective = true;
        }
    }

    const where: any = {
        isAlumni: showAlumni,
        isLeftCollege: showLeftCollege,
        isDetained: showDetained
    };

    if (year) where.year = year;
    if (semester) where.semester = semester;

    if (!isElective) {
        if (sectionIds) {
            where.sectionId = { in: sectionIds.split(",") };
        } else if (sectionId) {
            where.sectionId = sectionId;
        }
    }

    const batchId = searchParams.get("batchId");
    if (batchId) {
        where.batchId = batchId;
    }

    if (isElective && subjectId) {
        where.subjects = {
            some: {
                id: subjectId
            }
        };
    }

    // Search Query Support (Server-Side)
    const searchQuery = searchParams.get("q");
    if (searchQuery) {
        where.OR = [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { rollNumber: { contains: searchQuery, mode: "insensitive" } }
        ];
    }

    // Scoping
    const userRole = (session.user as any).role;
    const userDeptId = (session.user as any).departmentId;
    const isGlobalAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL", "OFFICE"].includes(userRole);
    const isBSH = isBSHHod(session.user);

    if (isBSH) {
        if (year && year !== "1") {
            return NextResponse.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
        }
        where.year = "1";
    }

    if (!isElective) {
        const queryDeptId = searchParams.get("departmentId");

        if (queryDeptId) {
            where.departmentId = queryDeptId;
        } else {
            if (isGlobalAdmin || isBSH) {
                // Admin and BSH HOD see all if no filter
            } else {
                if (userDeptId) {
                    where.departmentId = userDeptId;
                } else {
                    return NextResponse.json({ error: "User has no department assigned" }, { status: 403 });
                }
            }
        }
    }

    const includeSubjects = searchParams.get("includeSubjects") === "true";

    // DEBUG: Log filters
    console.log("FETCH STUDENTS DEBUG:", {
        year,
        semester,
        sectionId,
        departmentId: where.departmentId,
        batchId,
        searchQuery
    });

    try {
        console.log("FINAL WHERE:", JSON.stringify(where, null, 2));

        const [total, students] = await prisma.$transaction([
            prisma.student.count({ where }),
            prisma.student.findMany({
                where,
                include: {
                    section: true,
                    department: true,
                    batch: true,
                    subjects: includeSubjects ? { select: { id: true, name: true, code: true, electiveSlotId: true } } : false
                },
                orderBy: { rollNumber: "asc" },
                skip,
                take,
            })
        ]);

        console.log(`FOUND ${total} STUDENTS`);

        // Map batch names to students if isElective is true
        let responseStudents: any[] = students;
        let facultyMappedBatch: string | null = null;
        let facultyHasBatchConstraint = false;

        if (isElective && subjectId) {
            const { getElectiveBatches } = require("@/lib/elective-batches");
            const electiveBatches = getElectiveBatches();
            responseStudents = students.map((s: any) => {
                const batchKey = `${s.id}_${subjectId}`;
                return {
                    ...s,
                    electiveBatch: electiveBatches[batchKey] || null
                };
            });

            // Check if current user is a FACULTY and has a mapped batch
            if (session.user.role === "FACULTY") {
                const { cookies } = require("next/headers");
                const cookieStore = await cookies();
                let academicYearId = cookieStore.get("academic-year-id")?.value;
                if (!academicYearId) {
                    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
                    if (currentYear) academicYearId = currentYear.id;
                }

                let facultyId = (session.user as any).facultyId;
                if (!facultyId) {
                    const faculty = await prisma.faculty.findFirst({
                        where: { user: { username: (session.user as any).username } }
                    });
                    if (faculty) facultyId = faculty.id;
                }

                if (facultyId && academicYearId) {
                    const mapping = await prisma.facultySubjectMapping.findFirst({
                        where: {
                            facultyId,
                            subjectId,
                            academicYearId
                        }
                    });
                    if (mapping) {
                        facultyMappedBatch = mapping.batch || null;
                        facultyHasBatchConstraint = !!mapping.batch;
                    }
                }
            }

            if (facultyHasBatchConstraint && facultyMappedBatch) {
                responseStudents = responseStudents.filter(s => s.electiveBatch === facultyMappedBatch);
            }
        }

        return NextResponse.json({
            data: responseStudents,
            facultyMappedBatch,
            facultyHasBatchConstraint,
            meta: {
                total,
                page,
                limit,
                totalPages: isAll ? 1 : Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, departmentId: userDeptId } = session.user as any;
    const isGlobalAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
    const isBSH = isBSHHod(session.user);

    if (!isGlobalAdmin && role !== "HOD") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        // Body should contain rollout, name, mobile, year, sem, sectionId, departmentId

        // Basic validation
        if (!body.departmentId || !body.sectionId) {
            return NextResponse.json({ error: "Department and Section are required" }, { status: 400 });
        }

        // HOD Scoping Enforcement
        if (isBSH) {
            if (body.year !== "1") {
                return NextResponse.json({ error: "BSH HOD can only add students to Year 1" }, { status: 403 });
            }
        } else if (role === "HOD" && body.departmentId !== userDeptId) {
            return NextResponse.json({ error: "You can only add/update students in your own department" }, { status: 403 });
        }

        // Check if exists
        const existingStudent = await prisma.student.findUnique({
            where: { rollNumber: body.rollNumber }
        });

        // Resolve Regulation
        let regulationId = null;
        const regName = body.regulation || "R22";

        const regulationRecord = await prisma.regulation.findUnique({ where: { name: regName } });
        if (regulationRecord) {
            regulationId = regulationRecord.id;
        } else {
            // Lazy create if needed, or error? Let's lazy create for now to support bulk uploads easily or old fallback
            const newReg = await prisma.regulation.create({ data: { name: regName } });
            regulationId = newReg.id;
        }

        let result;
        let action = "created";

        if (existingStudent) {
            // Update
            result = await prisma.student.update({
                where: { rollNumber: body.rollNumber },
                data: {
                    name: body.name,
                    mobile: body.mobile,
                    year: body.year,
                    semester: body.semester,
                    sectionId: body.sectionId,
                    departmentId: body.departmentId,
                    regulationId: regulationId,
                    batchId: body.batchId || null,
                    isDetained: body.isDetained || false,
                    isLeftCollege: body.isLeftCollege || false,
                    originalBatchId: body.originalBatchId || null,
                    detainedYear: body.detainedYear || null,
                    detainedSemester: body.detainedSemester || null,
                    rejoinedYear: body.rejoinedYear || null,
                    rejoinedSemester: body.rejoinedSemester || null,
                    isLateralEntry: body.isLateralEntry || false,
                    // Extended Fields
                    hallTicketNumber: body.hallTicketNumber || null,
                    eamcetRank: body.eamcetRank || null,
                    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
                    dateOfReporting: body.dateOfReporting ? new Date(body.dateOfReporting) : null,
                    gender: body.gender || null,
                    caste: body.caste || null,
                    casteName: body.casteName || null,
                    category: body.category || null,
                    admissionType: body.admissionType || null,
                    fatherName: body.fatherName || null,
                    motherName: body.motherName || null,
                    address: body.address || null,
                    studentContactNumber: body.studentContactNumber || null,
                    emailId: body.emailId || null,
                    aadharNumber: body.aadharNumber || null,
                    abcId: body.abcId || null,
                    reimbursement: body.reimbursement === true || body.reimbursement === "true",
                    certificatesSubmitted: body.certificatesSubmitted === true || body.certificatesSubmitted === "true",
                    domainMailId: body.rollNumber ? `${body.rollNumber.toUpperCase()}@gvpcdpgc.edu.in` : null
                }
            });
            action = "updated";
        } else {
            // Create
            result = await prisma.student.create({
                data: {
                    rollNumber: body.rollNumber,
                    name: body.name,
                    mobile: body.mobile,
                    year: body.year,
                    semester: body.semester,
                    sectionId: body.sectionId,
                    departmentId: body.departmentId,
                    regulationId: regulationId,
                    batchId: body.batchId || null,
                    isDetained: body.isDetained || false,
                    isLeftCollege: body.isLeftCollege || false,
                    isLateralEntry: body.isLateralEntry || false,
                    originalBatchId: body.originalBatchId || null,
                    detainedYear: body.detainedYear || null,
                    detainedSemester: body.detainedSemester || null,
                    rejoinedYear: body.rejoinedYear || null,
                    rejoinedSemester: body.rejoinedSemester || null,
                    // Extended Fields
                    hallTicketNumber: body.hallTicketNumber || null,
                    eamcetRank: body.eamcetRank || null,
                    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
                    dateOfReporting: body.dateOfReporting ? new Date(body.dateOfReporting) : null,
                    gender: body.gender || null,
                    caste: body.caste || null,
                    casteName: body.casteName || null,
                    category: body.category || null,
                    admissionType: body.admissionType || null,
                    fatherName: body.fatherName || null,
                    motherName: body.motherName || null,
                    address: body.address || null,
                    studentContactNumber: body.studentContactNumber || null,
                    emailId: body.emailId || null,
                    aadharNumber: body.aadharNumber || null,
                    abcId: body.abcId || null,
                    reimbursement: body.reimbursement === true || body.reimbursement === "true",
                    certificatesSubmitted: body.certificatesSubmitted === true || body.certificatesSubmitted === "true",
                    domainMailId: body.rollNumber ? `${body.rollNumber.toUpperCase()}@gvpcdpgc.edu.in` : null
                },
            });

            // Automatically provision a student login
            const existingUser = await prisma.user.findUnique({
                where: { username: body.rollNumber }
            });

            if (!existingUser) {
                const bcrypt = require("bcrypt");
                const hashedPassword = await bcrypt.hash(body.rollNumber, 10);
                await prisma.user.create({
                    data: {
                        username: body.rollNumber,
                        password: hashedPassword,
                        role: "STUDENT",
                        departmentId: body.departmentId
                    }
                });
            }
            action = "created";
        }

        // Audit Log
        const performerId = session.user.id;
        try {
            await prisma.auditLog.create({
                data: {
                    action: action === "created" ? "CREATE" : "UPDATE",
                    entity: "Student",
                    entityId: result.rollNumber, // Using RollNo as ID reference for readability or result.id
                    details: JSON.stringify({ rollNumber: result.rollNumber, name: result.name, departmentId: result.departmentId }),
                    performedBy: performerId
                }
            });
        } catch (logError) {
            console.error("Failed to create audit log", logError);
            // Don't fail the request just because logging failed? 
            // Strict audit requirements would say YES, fail. But for now let's just log error.
        }

        return NextResponse.json({ ...result, action }); // Return action status
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to process student" }, { status: 500 });
    }
}
