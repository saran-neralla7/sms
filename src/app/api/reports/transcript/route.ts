import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rollNumber = searchParams.get("rollNumber");
    const studentIdParam = searchParams.get("studentId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { department: true }
    });

    if (!user) {
        return NextResponse.json({ error: "User profile not found." }, { status: 403 });
    }

    const userRole = (user.role || "").toUpperCase();
    const isAuthorized = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(userRole);
    if (!isAuthorized) {
        return NextResponse.json({ error: "Access Denied: Admin, Director, Principal or HOD access required." }, { status: 403 });
    }

    if (!rollNumber && !studentIdParam) {
        return NextResponse.json({ error: "Student Roll Number or ID is required." }, { status: 400 });
    }

    try {
        // Find student with assigned elective subjects
        const student = await prisma.student.findFirst({
            where: rollNumber ? { rollNumber: { equals: rollNumber.trim(), mode: "insensitive" } } : { id: studentIdParam! },
            include: {
                department: true,
                section: true,
                subjects: {
                    where: { electiveSlotId: { not: null } },
                    select: { id: true, code: true, name: true, electiveSlotId: true, electiveSlotRelation: { select: { id: true, name: true } } }
                }
            }
        });

        if (!student) {
            return NextResponse.json({ error: "Student record not found." }, { status: 404 });
        }

        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // Fetch ACADEMIC attendance history for student's section (excludes SMS "General Class" records)
        const historyRecords = await prisma.attendanceHistory.findMany({
            where: {
                departmentId: student.departmentId,
                year: student.year,
                semester: student.semester,
                sectionId: student.sectionId,
                date: { gte: start, lte: end },
                type: "ACADEMIC"
            },
            include: {
                subject: {
                    select: {
                        id: true, name: true, shortName: true, code: true,
                        year: true, semester: true, isElective: true,
                        electiveSlotId: true,
                        electiveSlotRelation: { select: { id: true, name: true } }
                    }
                },
                user: { select: { username: true, faculty: { select: { empName: true } } } },
                period: { select: { name: true } }
            }
        });

        // Filter LUNCH periods
        const validHistory = historyRecords.filter(rec => {
            const periodName = rec.period?.name?.toUpperCase() || "";
            return !periodName.includes("LUNCH");
        });

        // Pre-populate official subjects for the student's department, year, semester
        const officialSubjects = await prisma.subject.findMany({
            where: {
                departmentId: student.departmentId,
                year: student.year,
                semester: student.semester
            },
            include: {
                electiveSlotRelation: true
            }
        });

        // Helper to identify Open Elective subjects
        function isOpenElective(sub: any) {
            if (!sub) return false;
            const slotName = (sub.electiveSlotRelation?.name || "").toUpperCase();
            if (slotName.includes("OE") || slotName.includes("OPEN")) return true;
            const nameUpper = (sub.name || "").toUpperCase();
            if (nameUpper.includes("OPEN ELECTIVE")) return true;
            if (sub.isElective && sub.electiveSlotId) return true;
            return false;
        }

        // Find student's assigned OE subject(s)
        const studentOeSubjects = student.subjects.filter(s => {
            const slotName = (s.electiveSlotRelation?.name || "").toUpperCase();
            return slotName.includes("OE") || slotName.includes("OPEN");
        });

        const subjectMap: Record<string, {
            id: string;
            name: string;
            shortName: string;
            facultyName: string;
            totalHeld: number;
            present: number;
            absent: number;
        }> = {};

        // Add regular (non-OE) official subjects
        officialSubjects.forEach(sub => {
            if (isOpenElective(sub)) return; // Exclude OE placeholders and generic OE subjects
            subjectMap[sub.id] = {
                id: sub.id,
                name: sub.name,
                shortName: sub.shortName || sub.code || sub.name,
                facultyName: "Faculty",
                totalHeld: 0,
                present: 0,
                absent: 0
            };
        });

        // Add student's assigned OE subject(s)
        studentOeSubjects.forEach(oeSub => {
            subjectMap[oeSub.id] = {
                id: oeSub.id,
                name: oeSub.name,
                shortName: oeSub.code || oeSub.name,
                facultyName: "Faculty",
                totalHeld: 0,
                present: 0,
                absent: 0
            };
        });

        const studentRollLower = student.rollNumber.toLowerCase();

        // Process regular non-OE history records
        validHistory.forEach(rec => {
            const subj = rec.subject;
            if (!subj) return; // Exclude records with no subject ("General Class")

            if (isOpenElective(subj)) return; // Skip OE records here (handled per student assignment below)

            if (subj.year !== student.year || subj.semester !== student.semester) return;

            const subId = subj.id;
            const facultyName = rec.user?.faculty?.empName || rec.user?.username || "Faculty";

            if (!subjectMap[subId]) {
                subjectMap[subId] = {
                    id: subId,
                    name: subj.name,
                    shortName: subj.shortName || subj.code || subj.name,
                    facultyName,
                    totalHeld: 0,
                    present: 0,
                    absent: 0
                };
            } else if (facultyName !== "Faculty") {
                subjectMap[subId].facultyName = facultyName;
            }

            subjectMap[subId].totalHeld += 1;

            let detailsList: any[] = [];
            try {
                detailsList = typeof rec.details === "string" ? JSON.parse(rec.details) : rec.details;
            } catch (e) {
                detailsList = [];
            }

            if (Array.isArray(detailsList)) {
                const match = detailsList.find((d: any) => {
                    const r = (d["Roll Number"] || d["rollNumber"] || "").toString().toLowerCase();
                    return r === studentRollLower;
                });

                if (match) {
                    const status = match.Status || match.status;
                    const isPresent = status === "Present" || status === "present" || status === "P" || match.isPresent === true;
                    if (isPresent) {
                        subjectMap[subId].present += 1;
                    } else {
                        subjectMap[subId].absent += 1;
                    }
                }
            }
        });

        // Process assigned OE attendance by searching all ACADEMIC OE history records where student is listed
        if (studentOeSubjects.length > 0) {
            const oeSubjectIds = studentOeSubjects.map(s => s.id);

            const oeHistoryRecords = await prisma.attendanceHistory.findMany({
                where: {
                    subjectId: { in: oeSubjectIds },
                    date: { gte: start, lte: end },
                    type: "ACADEMIC"
                },
                include: {
                    user: { select: { username: true, faculty: { select: { empName: true } } } },
                    period: { select: { name: true } }
                }
            });

            const validOeHistory = oeHistoryRecords.filter(rec => {
                const periodName = rec.period?.name?.toUpperCase() || "";
                return !periodName.includes("LUNCH");
            });

            validOeHistory.forEach(rec => {
                const subId = rec.subjectId!;
                const facultyName = rec.user?.faculty?.empName || rec.user?.username || "Faculty";

                let detailsList: any[] = [];
                try {
                    detailsList = typeof rec.details === "string" ? JSON.parse(rec.details) : rec.details;
                } catch (e) {
                    detailsList = [];
                }

                if (!Array.isArray(detailsList)) return;

                const match = detailsList.find((d: any) => {
                    const r = (d["Roll Number"] || d["rollNumber"] || "").toString().toLowerCase();
                    return r === studentRollLower;
                });

                if (match) {
                    if (subjectMap[subId]) {
                        if (facultyName !== "Faculty") {
                            subjectMap[subId].facultyName = facultyName;
                        }
                        subjectMap[subId].totalHeld += 1;
                        const status = match.Status || match.status;
                        const isPresent = status === "Present" || status === "present" || status === "P" || match.isPresent === true;
                        if (isPresent) {
                            subjectMap[subId].present += 1;
                        } else {
                            subjectMap[subId].absent += 1;
                        }
                    }
                }
            });
        }

        // Filter out subjects with 0 totalHeld that are placeholders or unassigned
        const subjectBreakdown = Object.values(subjectMap)
            .filter(sub => sub.totalHeld > 0 || !sub.name.toUpperCase().includes("OPEN ELECTIVE"))
            .map(sub => {
                const pct = sub.totalHeld > 0 ? parseFloat(((sub.present / sub.totalHeld) * 100).toFixed(2)) : 0;
                return {
                    ...sub,
                    percentage: pct
                };
            });

        const totalHeldAll = subjectBreakdown.reduce((acc, s) => acc + s.totalHeld, 0);
        const totalPresentAll = subjectBreakdown.reduce((acc, s) => acc + s.present, 0);
        const totalAbsentAll = totalHeldAll - totalPresentAll;
        const overallPercentage = totalHeldAll > 0 ? parseFloat(((totalPresentAll / totalHeldAll) * 100).toFixed(2)) : 0;

        return NextResponse.json({
            student: {
                id: student.id,
                rollNumber: student.rollNumber,
                name: student.name,
                departmentName: student.department?.name || "N/A",
                year: student.year,
                semester: student.semester,
                sectionName: student.section?.name || "N/A",
                parentName: student.fatherName || student.motherName || "Guardian",
                mobile: student.mobile || student.studentContactNumber || "N/A",
                email: student.emailId || "N/A"
            },
            subjectBreakdown,
            overall: {
                totalHeld: totalHeldAll,
                totalPresent: totalPresentAll,
                totalAbsent: totalAbsentAll,
                percentage: overallPercentage,
                statusLabel: overallPercentage >= 75 ? "Satisfactory" : (overallPercentage >= 65 ? "Condonation Eligible" : "Detention Risk")
            }
        });
    } catch (e: any) {
        console.error("Transcript Report Error:", e);
        return NextResponse.json({ error: "Failed to generate Student Transcript: " + e.message }, { status: 500 });
    }
}
