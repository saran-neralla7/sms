import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Assume authOptions is exported here, or we use getServerSession without it if App Router 

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
                        subject: true,
                        section: true,
                        academicYear: true
                    }
                },
                FeedbackResponse: {
                    include: {
                        subject: true
                    }
                }
            }
        });

        if (!faculty) {
            return NextResponse.json({ error: "Faculty profile not found" }, { status: 404 });
        }

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
        const overallAverage = feedbacks.length > 0 ? (overallTotal / feedbacks.length).toFixed(1) : "0.0";

        const subjectFeedbackMap: Record<string, { total: number, count: number, name: string }> = {};
        feedbacks.forEach((f: any) => {
            const subjName = f.subject?.name || "General";
            if (!subjectFeedbackMap[subjName]) {
                subjectFeedbackMap[subjName] = { total: 0, count: 0, name: subjName };
            }
            subjectFeedbackMap[subjName].total += (f.overallRating || 0);
            subjectFeedbackMap[subjName].count += 1;
        });

        const subjectFeedback = Object.values(subjectFeedbackMap).map(sf => ({
            name: sf.name,
            average: (sf.total / sf.count).toFixed(1),
            count: sf.count
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
            subjects: mappings,
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
