import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsForClass } from "@/lib/student-utils";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const subjectId = searchParams.get("subjectId");
        const sectionId = searchParams.get("sectionId");
        let academicYearId = searchParams.get("academicYearId");

        if (!subjectId) {
            return NextResponse.json({ error: "Missing subjectId" }, { status: 400 });
        }

        if (!academicYearId) {
            const currentAy = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
            academicYearId = currentAy?.id || null;
        }

        const subject = await prisma.subject.findUnique({
            where: { id: subjectId },
            include: { department: true }
        });

        if (!subject) {
            return NextResponse.json({ error: "Subject not found" }, { status: 404 });
        }

        // Get user's faculty profile
        const userObj = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { facultyId: true, role: true }
        });

        const facultyId = userObj?.facultyId;

        // Fetch all section mappings for this subject for this faculty (or all sections if HOD/ADMIN)
        const mappingsWhere: any = { subjectId };
        if (academicYearId) mappingsWhere.academicYearId = academicYearId;
        if (facultyId && session.user.role === "FACULTY") {
            mappingsWhere.facultyId = facultyId;
        }

        const mappings = await prisma.facultySubjectMapping.findMany({
            where: mappingsWhere,
            include: {
                section: true,
                academicYear: true
            }
        });

        // Unique sections array
        const sections = Array.from(
            new Map(mappings.map(m => [m.section.id, m.section])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));

        const activeSectionId = sectionId || sections[0]?.id || "";

        // Fetch students for activeSectionId using robust getStudentsForClass utility
        let students: any[] = [];
        if (academicYearId && activeSectionId) {
            students = await getStudentsForClass({
                academicYearId,
                departmentId: subject.departmentId,
                year: subject.year,
                semester: subject.semester,
                sectionId: activeSectionId,
                subjectId,
                include: {
                    labBatch: { select: { name: true } }
                }
            });
        }

        // Fetch attendance history for this subject and section
        const subjectAttendanceHistories = await prisma.attendanceHistory.findMany({
            where: {
                subjectId,
                sectionId: activeSectionId,
                status: "Completed"
            },
            select: {
                details: true
            }
        });

        const totalSubjectClasses = subjectAttendanceHistories.length;

        const attendanceMap: Record<string, { attended: number; total: number; pct: number }> = {};

        students.forEach(s => {
            let attendedCount = 0;
            subjectAttendanceHistories.forEach(hist => {
                try {
                    const parsedDetails = JSON.parse(hist.details || "[]");
                    const studentLog = parsedDetails.find((d: any) => {
                        const dRoll = d["Roll Number"] || d.rollNumber || d.roll_number || d.roll;
                        const dId = d.studentId || d.student_id || d.id;
                        return (
                            (dRoll && s.rollNumber && dRoll.toString().trim().toUpperCase() === s.rollNumber.toString().trim().toUpperCase()) ||
                            (dId && s.id && dId === s.id)
                        );
                    });
                    if (studentLog) {
                        const status = (studentLog.Status || studentLog.status || "").toString().trim().toUpperCase();
                        if (status === "PRESENT" || status === "OD" || status === "LATE") {
                            attendedCount++;
                        }
                    }
                } catch (_) {}
            });
            const pct = totalSubjectClasses > 0 ? Math.round((attendedCount / totalSubjectClasses) * 100) : 100;
            attendanceMap[s.id] = { attended: attendedCount, total: totalSubjectClasses, pct };
        });

        const enrichedStudents = students.map(s => ({
            ...s,
            attendance: attendanceMap[s.id] || { attended: 0, total: totalSubjectClasses, pct: 100 }
        }));

        // Fetch CourseFile record for active section
        let courseFile = null;
        if (academicYearId && activeSectionId) {
            courseFile = await prisma.courseFile.findUnique({
                where: {
                    academicYearId_departmentId_year_semester_sectionId_subjectId: {
                        academicYearId,
                        departmentId: subject.departmentId,
                        year: subject.year,
                        semester: subject.semester,
                        sectionId: activeSectionId,
                        subjectId
                    }
                }
            });

            // If section-specific course file does not exist, pre-fill from any existing course file for this subject
            if (!courseFile) {
                const templateFile = await prisma.courseFile.findFirst({
                    where: {
                        academicYearId,
                        departmentId: subject.departmentId,
                        year: subject.year,
                        semester: subject.semester,
                        subjectId
                    }
                });
                if (templateFile) {
                    courseFile = templateFile;
                }
            }
        }

        // Fetch teaching diary entries for this subject and section
        const diaries = await prisma.attendanceHistory.findMany({
            where: {
                subjectId,
                sectionId: activeSectionId,
                topicsTaught: { not: null }
            },
            include: {
                period: true,
                section: true
            },
            orderBy: { date: "desc" }
        });

        // Fetch CO-PO and CO-PSO mappings for this subject
        const coPoMappings = await prisma.subjectCoPoMapping.findMany({
            where: { subjectId }
        });
        const coPsoMappings = await prisma.subjectCoPsoMapping.findMany({
            where: { subjectId }
        });

        return NextResponse.json({
            subject,
            sections,
            activeSectionId,
            academicYearId,
            students: enrichedStudents,
            courseFile,
            diaries,
            coPoMappings,
            coPsoMappings
        });
    } catch (error: any) {
        console.error("Error in GET /api/faculty/subject-dashboard:", error);
        return NextResponse.json({ error: error.message || "Failed to load subject dashboard" }, { status: 500 });
    }
}
