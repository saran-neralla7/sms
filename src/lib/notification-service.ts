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

export async function checkAndTriggerFacultyBirthdayNotifications() {
    try {
        const today = new Date();
        const todayMonth = today.getMonth(); // 0-indexed (0-11)
        const todayDay = today.getDate(); // 1-31

        // Find active faculty members (resignDate is null)
        const activeFaculty = await prisma.faculty.findMany({
            where: {
                resignDate: null
            },
            select: {
                id: true,
                empName: true,
                gender: true,
                dob: true,
                photoUrl: true,
                department: {
                    select: {
                        code: true,
                        name: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        role: true
                    }
                }
            }
        });

        // Filter faculty whose birthday is today
        const birthdayFacultyList = activeFaculty.filter(f => {
            if (!f.dob) return false;
            const d = new Date(f.dob);
            return d.getMonth() === todayMonth && d.getDate() === todayDay;
        });

        if (birthdayFacultyList.length === 0) return;

        // Fetch all active non-student users (role !== "STUDENT")
        const nonStudentUsers = await prisma.user.findMany({
            where: {
                role: {
                    not: "STUDENT"
                }
            },
            select: {
                id: true,
                role: true,
                facultyId: true
            }
        });

        if (nonStudentUsers.length === 0) return;

        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

        // Fetch notifications created today of type "FACULTY_BIRTHDAY"
        const existingBirthdayNotifs = await prisma.notification.findMany({
            where: {
                type: "FACULTY_BIRTHDAY",
                createdAt: {
                    gte: startOfToday,
                    lte: endOfToday
                }
            },
            select: {
                userId: true,
                title: true
            }
        });

        const existingSet = new Set<string>();
        existingBirthdayNotifs.forEach(n => {
            existingSet.add(`${n.userId}_${n.title}`);
        });

        const notificationsToCreate: Array<{
            userId: string;
            title: string;
            message: string;
            type: string;
            link: string;
            photoUrl: string | null;
        }> = [];

        for (const f of birthdayFacultyList) {
            const genderStr = (f.gender || "").trim().toUpperCase();
            const isFemale = genderStr === "FEMALE" || genderStr === "F" || genderStr === "WOMAN";
            const titleSuffix = isFemale ? "Madam" : "Sir";
            const possessiveSuffix = isFemale ? "Madam's" : "Sir's";

            const personalTitle = `Happy Birthday ${titleSuffix}! 🎂`;
            const personalMessage = `Happy Birthday ${titleSuffix}! 🎂 Wishing you a wonderful and successful year ahead from Gayatri Vidya Parishad College for Degree and PG Courses (A).`;

            const broadcastTitle = `Faculty Birthday Celebration 🎉`;
            const broadcastMessage = `🎉 Today is ${f.empName} ${possessiveSuffix} Birthday! Join us in wishing them a very Happy Birthday.`;

            for (const user of nonStudentUsers) {
                const isTargetBirthdayFaculty = user.facultyId === f.id || (f.user && f.user.id === user.id);
                const notifTitle = isTargetBirthdayFaculty ? personalTitle : broadcastTitle;
                const notifMessage = isTargetBirthdayFaculty ? personalMessage : broadcastMessage;

                const dedupeKey = `${user.id}_${notifTitle}`;

                if (!existingSet.has(dedupeKey)) {
                    existingSet.add(dedupeKey);
                    notificationsToCreate.push({
                        userId: user.id,
                        title: notifTitle,
                        message: notifMessage,
                        type: "FACULTY_BIRTHDAY",
                        link: "/faculty/dashboard",
                        photoUrl: f.photoUrl || null
                    });
                }
            }
        }

        if (notificationsToCreate.length > 0) {
            await prisma.notification.createMany({
                data: notificationsToCreate
            });
        }
    } catch (error) {
        console.error("Error creating faculty birthday notifications:", error);
    }
}
