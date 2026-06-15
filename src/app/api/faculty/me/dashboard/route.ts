import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Assume authOptions is exported here, or we use getServerSession without it if App Router 

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authOptions as any);
        if (!session || !session.user || session.user.role !== "FACULTY") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const username = session.user.username;

        // Find the faculty profile
        const faculty = await prisma.faculty.findFirst({
            where: { user: { username: username } },
            include: {
                department: true,
                FacultySubjectMapping: {
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
        const mappingsWithStudents = await Promise.all(
            faculty.FacultySubjectMapping.map(async (m) => {
                const students = await prisma.student.findMany({
                    where: {
                        departmentId: m.subject.departmentId,
                        year: m.subject.year,
                        semester: m.subject.semester,
                        sectionId: m.sectionId,
                        isDetained: false,
                        isAlumni: false
                    },
                    select: {
                        id: true,
                        rollNumber: true,
                        name: true
                    },
                    orderBy: {
                        rollNumber: "asc"
                    }
                });
                return {
                    ...m,
                    students
                };
            })
        );

        // 1. Personal Timetable
        const mappings = faculty.FacultySubjectMapping;
        const personalOrConditions = mappings.map(m => ({
            subjectId: m.subjectId,
            sectionId: m.sectionId
        }));

        let personalTimetable: any[] = [];
        if (personalOrConditions.length > 0) {
            personalTimetable = await prisma.timetable.findMany({
                where: { OR: personalOrConditions },
                include: {
                    period: true,
                    subject: true,
                    section: true
                },
                orderBy: [{ dayOfWeek: 'asc' }, { period: { order: 'asc' } }]
            });
        }

        // 2. Section Timetables (Full timetables of the sections they teach)
        const sectionIds = Array.from(new Set(mappings.map(m => m.sectionId)));
        let sectionTimetables: any[] = [];
        if (sectionIds.length > 0) {
            sectionTimetables = await prisma.timetable.findMany({
                where: { sectionId: { in: sectionIds } },
                include: {
                    period: true,
                    subject: true,
                    section: true
                },
                orderBy: [{ sectionId: 'asc' }, { dayOfWeek: 'asc' }, { period: { order: 'asc' } }]
            });
        }

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
