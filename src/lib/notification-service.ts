import { prisma } from "@/lib/prisma";

interface AttendanceDetail {
    studentId?: string;
    id?: string;
    rollNumber?: string;
    status?: string;
    isPresent?: boolean;
    [key: string]: any;
}

interface TargetedAttendanceParams {
    departmentId: string;
    year: string;
    semester: string;
    sectionId: string;
    subjectId?: string | null;
    date: string;
    students: AttendanceDetail[];
}

export async function createTargetedAttendanceNotifications(params: TargetedAttendanceParams) {
    try {
        const { departmentId, year, semester, sectionId, subjectId, date, students } = params;

        if (!students || students.length === 0) return;

        // Fetch subject details if present
        let subjectName = "Regular Class";
        if (subjectId) {
            const sub = await prisma.subject.findUnique({
                where: { id: subjectId },
                select: { name: true, shortName: true }
            });
            if (sub) {
                subjectName = sub.shortName || sub.name;
            }
        }

        // Collect roll numbers from attendance submission
        const rollNumbers = students
            .map((s) => s.rollNumber)
            .filter((r): r is string => !!r);

        if (rollNumbers.length === 0) return;

        // Strictly query ONLY STUDENT users matching these roll numbers for this specific department, year, semester, section
        const studentUsers = await prisma.user.findMany({
            where: {
                role: "STUDENT",
                username: { in: rollNumbers }
            },
            select: {
                id: true,
                username: true
            }
        });

        const userMap = new Map<string, string>();
        studentUsers.forEach((u) => userMap.set(u.username.toUpperCase(), u.id));

        const formattedDate = new Date(date).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        const notificationsToCreate: Array<{
            userId: string;
            title: string;
            message: string;
            type: string;
            link: string;
        }> = [];

        students.forEach((s) => {
            const roll = (s.rollNumber || "").toUpperCase();
            const userId = userMap.get(roll);
            if (!userId) return; // Ignore if student user profile does not exist

            const statusText = (s.status === "Present" || s.status === "P" || s.isPresent === true) ? "PRESENT" : "ABSENT";
            
            notificationsToCreate.push({
                userId,
                title: `Attendance Posted - ${subjectName}`,
                message: `Your attendance for ${subjectName} on ${formattedDate} was marked ${statusText}.`,
                type: "ATTENDANCE_POSTED",
                link: "/student/dashboard"
            });
        });

        if (notificationsToCreate.length > 0) {
            await prisma.notification.createMany({
                data: notificationsToCreate
            });
        }
    } catch (error) {
        console.error("Error creating targeted attendance notifications:", error);
    }
}

export async function createFacultyTimetableNotification(facultyId: string, details: { subjectName: string; departmentCode: string; year: string; semester: string; sectionName: string }) {
    try {
        const user = await prisma.user.findFirst({
            where: { facultyId },
            select: { id: true }
        });

        if (!user) return;

        await prisma.notification.create({
            data: {
                userId: user.id,
                title: "Class Mapping Update",
                message: `You have been mapped to teach ${details.subjectName} for ${details.departmentCode} Yr ${details.year} Sem ${details.semester} Sec ${details.sectionName}.`,
                type: "TIMETABLE_ADDED",
                link: "/faculty"
            }
        });
    } catch (error) {
        console.error("Error creating faculty timetable notification:", error);
    }
}
