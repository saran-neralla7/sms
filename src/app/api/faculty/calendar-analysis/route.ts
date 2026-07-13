import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Helper to format a Date object into YYYY-MM-DD in Asia/Kolkata timezone
function getISTDateString(date: Date): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    return formatter.format(date);
}

// Parse YYYY-MM-DD into a Date object at midnight in Asia/Kolkata timezone
function parseISTDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    // Create in UTC first, then adjust offset to match local IST midnight
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    // IST is UTC + 5:30. To get midnight in IST, we subtract the offset from UTC
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(utcDate.getTime() - istOffset);
}

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

        if (!academicYearId) {
            return NextResponse.json({ error: "No active academic year found" }, { status: 404 });
        }

        // Find the faculty profile and their subject mappings
        const faculty = await prisma.faculty.findFirst({
            where: { user: { username } },
            include: {
                FacultySubjectMapping: {
                    where: { academicYearId },
                    include: {
                        subject: {
                            include: {
                                department: true
                            }
                        },
                        section: true,
                        academicYear: true
                    }
                }
            }
        });

        if (!faculty) {
            return NextResponse.json({ error: "Faculty profile not found" }, { status: 404 });
        }

        // Fetch all holidays for this academic year
        const holidays = await prisma.academicHoliday.findMany({
            where: { academicYearId },
            orderBy: { date: "asc" }
        });

        // Map holidays to a set of YYYY-MM-DD strings for O(1) lookup
        const holidayMap = new Map<string, string>(); // dateString -> holidayName
        holidays.forEach(h => {
            const startStr = getISTDateString(h.date);
            holidayMap.set(startStr, h.name);
            // Expand multi-day holidays: mark every day in the range
            if (h.endDate) {
                const end = new Date(h.endDate);
                let cur = new Date(h.date);
                cur.setDate(cur.getDate() + 1); // start from day after start (already added above)
                while (cur <= end) {
                    holidayMap.set(getISTDateString(cur), h.name);
                    cur.setDate(cur.getDate() + 1);
                }
            }
        });

        // Process each mapping
        const analysisResults = await Promise.all(
            faculty.FacultySubjectMapping.map(async (mapping) => {
                const { subject, section } = mapping;

                // 1. Fetch academic timeline for this subject's Year and Semester
                const timeline = await prisma.academicSemesterTimeline.findUnique({
                    where: {
                        academicYearId_year_semester: {
                            academicYearId,
                            year: subject.year,
                            semester: subject.semester
                        }
                    }
                });

                if (!timeline) {
                    return {
                        mappingId: mapping.id,
                        subject,
                        section,
                        hasTimeline: false,
                        hasTimetable: false,
                        stats: null,
                        schedule: []
                    };
                }

                // Get IST date strings for timelines
                const startStr = getISTDateString(timeline.classworkStart);
                const endStr = getISTDateString(timeline.classworkEnd);

                const mid1StartStr = timeline.mid1Start ? getISTDateString(timeline.mid1Start) : null;
                const mid1EndStr = timeline.mid1End ? getISTDateString(timeline.mid1End) : null;

                const mid2StartStr = timeline.mid2Start ? getISTDateString(timeline.mid2Start) : null;
                const mid2EndStr = timeline.mid2End ? getISTDateString(timeline.mid2End) : null;

                const semExamStartStr = timeline.semExamStart ? getISTDateString(timeline.semExamStart) : null;
                const semExamEndStr = timeline.semExamEnd ? getISTDateString(timeline.semExamEnd) : null;

                // 2. Fetch all timetable entries for this section
                const timetableEntries = await prisma.timetable.findMany({
                    where: {
                        sectionId: mapping.sectionId,
                        OR: [
                            { subjectId: subject.id },
                            subject.electiveSlotId ? { electiveSlotId: subject.electiveSlotId } : {}
                        ]
                    },
                    include: {
                        period: true
                    }
                });

                if (timetableEntries.length === 0) {
                    return {
                        mappingId: mapping.id,
                        subject,
                        section,
                        hasTimeline: true,
                        hasTimetable: false,
                        timeline,
                        stats: null,
                        schedule: []
                    };
                }

                // 3. Loop through dates from classworkStart to classworkEnd
                const schedule: any[] = [];
                let totalScheduled = 0;
                let lostToHolidays = 0;
                let lostToExams = 0;
                let activeClasses = 0;

                const startDate = new Date(timeline.classworkStart);
                const endDate = new Date(timeline.classworkEnd);

                // Increment day by day
                let current = new Date(startDate.getTime());
                while (current.getTime() <= endDate.getTime()) {
                    const dateStr = getISTDateString(current);
                    const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, etc.

                    // Check if there is a timetable entry for this day of week active on this date
                    const activeTimetable = timetableEntries.filter(t => {
                        if (t.dayOfWeek !== dayOfWeek) return false;
                        const fromMatch = t.validFrom.getTime() <= current.getTime();
                        const toMatch = !t.validTo || t.validTo.getTime() > current.getTime();
                        return fromMatch && toMatch;
                    });

                    if (activeTimetable.length > 0) {
                        // Class is scheduled!
                        activeTimetable.forEach(t => {
                            totalScheduled++;

                            let status = "ACTIVE";
                            let details = "";

                            // Check Holiday
                            const holidayName = holidayMap.get(dateStr);
                            if (holidayName) {
                                status = "HOLIDAY";
                                details = holidayName;
                                lostToHolidays++;
                            }
                            // Check Mid 1
                            else if (mid1StartStr && mid1EndStr && dateStr >= mid1StartStr && dateStr <= mid1EndStr) {
                                status = "MID_I_EXAM";
                                details = "Mid-I Examinations";
                                lostToExams++;
                            }
                            // Check Mid 2
                            else if (mid2StartStr && mid2EndStr && dateStr >= mid2StartStr && dateStr <= mid2EndStr) {
                                status = "MID_II_EXAM";
                                details = "Mid-II Examinations";
                                lostToExams++;
                            }
                            // Check Sem Exam
                            else if (semExamStartStr && semExamEndStr && dateStr >= semExamStartStr && dateStr <= semExamEndStr) {
                                status = "SEM_EXAM";
                                details = "Semester End Examinations";
                                lostToExams++;
                            } else {
                                activeClasses++;
                            }

                            schedule.push({
                                date: dateStr,
                                dayOfWeek,
                                period: {
                                    id: t.period.id,
                                    name: t.period.name,
                                    startTime: t.period.startTime,
                                    endTime: t.period.endTime
                                },
                                status,
                                details
                            });
                        });
                    }

                    // Move to next day
                    current.setDate(current.getDate() + 1);
                }

                return {
                    mappingId: mapping.id,
                    subject,
                    section,
                    hasTimeline: true,
                    hasTimetable: true,
                    timeline,
                    stats: {
                        totalScheduled,
                        lostToHolidays,
                        lostToExams,
                        activeClasses
                    },
                    schedule: schedule.sort((a, b) => a.date.localeCompare(b.date) || a.period.startTime.localeCompare(b.period.startTime))
                };
            })
        );

        return NextResponse.json({
            academicYear: faculty.FacultySubjectMapping[0]?.academicYear?.name || "N/A",
            results: analysisResults
        });
    } catch (error: any) {
        console.error("Calendar Analysis API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
