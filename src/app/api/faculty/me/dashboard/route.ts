import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Assume authOptions is exported here, or we use getServerSession without it if App Router 
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authOptions as any);
        if (!session || !session.user || session.user.role !== "FACULTY") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const username = session.user.username;

        // Retrieve academic year from cookies
        const cookieStore = await cookies();
        let academicYearId = cookieStore.get("academic-year-id")?.value;
        if (!academicYearId) {
            const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            if (currentYear) academicYearId = currentYear.id;
        }

        // Find the faculty profile
        const faculty = await prisma.faculty.findFirst({
            where: { user: { username: username } },
            include: {
                department: true,
                FacultySubjectMapping: {
                    where: {
                        academicYearId: academicYearId || undefined
                    },
                    include: {
                        subject: {
                            include: {
                                department: true
                            }
                        },
                        section: true,
                        academicYear: true
                    }
                },
                FeedbackResponse: {
                    where: {
                        form: {
                            academicYearId: academicYearId || undefined,
                            OR: [
                                { endDate: { lt: new Date() } },
                                { isActive: false }
                            ]
                        }
                    },
                    include: {
                        subject: {
                            include: {
                                department: true
                            }
                        },
                        section: true,
                        form: {
                            include: {
                                targetBatch: true
                            }
                        }
                    }
                }
            }
        });

        if (!faculty) {
            return NextResponse.json({ error: "Faculty profile not found" }, { status: 404 });
        }

        // Fetch student list for each subject mapping
        // For OPEN_ELECTIVE (isElective) subjects, merge students from all section mappings into one card
        const oeSubjectIds = new Set(
            faculty.FacultySubjectMapping
                .filter(m => m.subject.isElective)
                .map(m => m.subjectId)
        );

        // Build merged OE mappings (one per unique subjectId) and normal per-section mappings
        const oeMergedMap: Record<string, any> = {};
        const normalMappings: any[] = [];

        for (const m of faculty.FacultySubjectMapping) {
            if (m.subject.isElective) {
                if (!oeMergedMap[m.subjectId]) {
                    oeMergedMap[m.subjectId] = { ...m, _sections: [m.section], _allSectionIds: [m.sectionId] };
                } else {
                    oeMergedMap[m.subjectId]._sections.push(m.section);
                    oeMergedMap[m.subjectId]._allSectionIds.push(m.sectionId);
                }
            } else {
                normalMappings.push(m);
            }
        }

        // Fetch students for normal mappings
        const normalMappingsWithStudents = await Promise.all(
            normalMappings.map(async (m) => {
                const students = await prisma.student.findMany({
                    where: {
                        departmentId: m.subject.departmentId,
                        year: m.subject.year,
                        semester: m.subject.semester,
                        sectionId: m.sectionId,
                        isDetained: false,
                        isAlumni: false,
                        isLeftCollege: false
                    },
                    select: { id: true, rollNumber: true, name: true },
                    orderBy: { rollNumber: "asc" }
                });
                return { ...m, students };
            })
        );

        // Fetch enrolled students for each OE subject (cross-section, using StudentToSubject implicit many-to-many)
        const oeMappingsWithStudents = await Promise.all(
            Object.values(oeMergedMap).map(async (m: any) => {
                const students = await prisma.student.findMany({
                    where: {
                        subjects: { some: { id: m.subjectId } },
                        isDetained: false,
                        isAlumni: false,
                        isLeftCollege: false
                    },
                    select: { id: true, rollNumber: true, name: true },
                    orderBy: { rollNumber: "asc" }
                });
                return {
                    ...m,
                    // Show "All Sections" for OE subject section label
                    section: { name: m._sections.map((s: any) => s?.name).join(", ") || "All" },
                    students
                };
            })
        );

        const mappingsWithStudents = [...normalMappingsWithStudents, ...oeMappingsWithStudents];


        // 1. Personal Timetable — match by subjectId OR electiveSlotId (for OE classes)
        const mappedSubjectIds = Array.from(new Set(faculty.FacultySubjectMapping.map(m => m.subjectId))).filter(Boolean);
        const mappedElecSlotIds = faculty.FacultySubjectMapping
            .map(m => m.subject.electiveSlotId).filter(Boolean) as string[];

        // Build unique year+semester+section combos from faculty mappings
        const sectionCombos: { sectionId: string; sectionName: string; year: string; semester: string }[] = [];
        const seenCombos = new Set<string>();
        for (const m of faculty.FacultySubjectMapping) {
            const key = `${m.sectionId}_${m.subject.year}_${m.subject.semester}`;
            if (!seenCombos.has(key)) {
                seenCombos.add(key);
                sectionCombos.push({
                    sectionId: m.sectionId,
                    sectionName: (m.section as any)?.name || '',
                    year: m.subject.year,
                    semester: m.subject.semester
                });
            }
        }

        const personalOrConditions: any[] = [];
        if (mappedSubjectIds.length > 0) personalOrConditions.push({ subjectId: { in: mappedSubjectIds }, validTo: null });
        if (mappedElecSlotIds.length > 0) personalOrConditions.push({ electiveSlotId: { in: mappedElecSlotIds }, validTo: null });

        let personalTimetable: any[] = [];
        if (personalOrConditions.length > 0) {
            personalTimetable = await prisma.timetable.findMany({
                where: { OR: personalOrConditions },
                include: {
                    period: true,
                    subject: { include: { department: true } },
                    section: true,
                    electiveSlot: true
                },
                orderBy: [{ dayOfWeek: 'asc' }, { period: { order: 'asc' } }]
            });
        }

        // Fetch ALL periods for the timetable grid
        const allPeriods = await prisma.period.findMany({ orderBy: { order: 'asc' } });

        // 2. Section Timetables — scoped by exact year+semester per combo so other years don't bleed
        const sectionTimetableGroups: any[] = [];
        for (const combo of sectionCombos) {
            const entries = await prisma.timetable.findMany({
                where: {
                    sectionId: combo.sectionId,
                    year: combo.year,
                    semester: combo.semester,
                    validTo: null
                },
                include: {
                    period: true,
                    subject: { include: { department: true } },
                    section: true
                },
                orderBy: [{ dayOfWeek: 'asc' }, { period: { order: 'asc' } }]
            });
            if (entries.length > 0) {
                sectionTimetableGroups.push({
                    sectionId: combo.sectionId,
                    sectionName: combo.sectionName,
                    year: combo.year,
                    semester: combo.semester,
                    entries
                });
            }
        }
        const sectionTimetables = sectionTimetableGroups;

        // 3. Feedback Calculations
        const feedbacks = faculty.FeedbackResponse;
        const overallTotal = feedbacks.reduce((acc: number, f: any) => acc + (f.overallRating || 0), 0);
        const overallAverage = feedbacks.length > 0 ? (overallTotal / feedbacks.length).toFixed(2) : "0.00";

        const subjectFeedbackMap: Record<string, { 
            total: number, 
            count: number, 
            name: string, 
            subjectId: string, 
            sectionId: string | null,
            departmentCode: string,
            year: string,
            semester: string,
            sectionName: string,
            batchName: string
        }> = {};

        feedbacks.forEach((f: any) => {
            const subjId = f.subjectId || "GENERAL";
            const sectId = f.sectionId || "ALL";
            const key = `${subjId}_${sectId}`;

            const subjName = f.subject?.name || "General";
            const displayName = subjName;

            if (!subjectFeedbackMap[key]) {
                subjectFeedbackMap[key] = { 
                    total: 0, 
                    count: 0, 
                    name: displayName, 
                    subjectId: subjId,
                    sectionId: f.sectionId || null,
                    departmentCode: f.subject?.department?.code || "",
                    year: f.subject?.year || "",
                    semester: f.subject?.semester || "",
                    sectionName: f.section?.name || "",
                    batchName: f.form?.targetBatch?.name || ""
                };
            }
            subjectFeedbackMap[key].total += (f.overallRating || 0);
            subjectFeedbackMap[key].count += 1;
        });

        const subjectFeedback = Object.values(subjectFeedbackMap).map(sf => ({
            name: sf.name,
            subjectId: sf.subjectId,
            sectionId: sf.sectionId,
            average: (sf.total / sf.count).toFixed(2),
            count: sf.count,
            departmentCode: sf.departmentCode,
            year: sf.year,
            semester: sf.semester,
            sectionName: sf.sectionName,
            batchName: sf.batchName
        }));

        return NextResponse.json({
            profile: {
                id: faculty.id,
                empName: faculty.empName,
                empCode: faculty.empCode,
                designation: faculty.designation,
                photoUrl: faculty.photoUrl,
                department: faculty.department?.name,
                email: faculty.email,
                mobile: faculty.mobile
            },
            subjects: mappingsWithStudents,
            allPeriods,
            personalTimetable,
            sectionTimetables,
            feedback: {
                overallAverage,
                totalResponses: feedbacks.length,
                subjectWise: subjectFeedback
            }
        });
    } catch (error) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
    }
}
