import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getDaysUntilBirthday(dob: Date, today: Date = new Date()) {
  const birthMonth = dob.getMonth(); // 0-11
  const birthDay = dob.getDate(); // 1-31
  
  // Next birthday this year
  const nextBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
  nextBirthday.setHours(0, 0, 0, 0);
  
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  todayMidnight.setHours(0, 0, 0, 0);
  
  if (nextBirthday < todayMidnight) {
    // If birthday already passed this year, it's next year
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }
  
  const diffTime = nextBirthday.getTime() - todayMidnight.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const monthParam = searchParams.get("month"); // 1-12 or null

    const today = new Date();
    const currentMonth0Indexed = today.getMonth(); // 0-11

    // Fetch active faculty
    const faculty = await prisma.faculty.findMany({
      where: {
        resignDate: null,
      },
      select: {
        id: true,
        empName: true,
        designation: true,
        dob: true,
        photoUrl: true,
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    // Fetch active students with dob
    const students = await prisma.student.findMany({
      where: {
        isLeftCollege: false,
        isAlumni: false,
        dateOfBirth: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        dateOfBirth: true,
        photoUrl: true,
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    // Format faculty items
    const formattedFaculty = faculty.map(f => {
      const dobDate = new Date(f.dob);
      return {
        id: f.id,
        name: f.empName,
        dob: f.dob,
        birthMonth: dobDate.getMonth() + 1, // 1-12
        birthDay: dobDate.getDate(),
        photoUrl: f.photoUrl,
        designation: f.designation,
        department: f.department.name,
        deptCode: f.department.code,
        type: "faculty",
        daysUntil: getDaysUntilBirthday(dobDate, today),
      };
    });

    // Format student items
    const formattedStudents = students.map(s => {
      const dobDate = new Date(s.dateOfBirth!);
      return {
        id: s.id,
        name: s.name,
        dob: s.dateOfBirth,
        birthMonth: dobDate.getMonth() + 1, // 1-12
        birthDay: dobDate.getDate(),
        photoUrl: s.photoUrl,
        designation: s.rollNumber, // Use roll number for student identity detail slot
        department: s.department.name,
        deptCode: s.department.code,
        type: "student",
        daysUntil: getDaysUntilBirthday(dobDate, today),
      };
    });

    // Combine all
    const allBirthdays = [...formattedFaculty, ...formattedStudents];

    if (monthParam) {
      const monthInt = parseInt(monthParam, 10);
      if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
        return NextResponse.json({ error: "Invalid month parameter" }, { status: 400 });
      }

      // Filter by month and sort by birthDay
      const monthBirthdays = allBirthdays
        .filter(b => b.birthMonth === monthInt)
        .sort((a, b) => a.birthDay - b.birthDay);

      return NextResponse.json({ birthdays: monthBirthdays });
    }

    // Default response: upcoming and thisMonth
    const upcoming = [...allBirthdays]
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 15); // Return top 15 closest birthdays

    const thisMonth = allBirthdays
      .filter(b => b.birthMonth === (currentMonth0Indexed + 1))
      .sort((a, b) => a.birthDay - b.birthDay);

    return NextResponse.json({ upcoming, thisMonth });

  } catch (error: any) {
    console.error("GET /api/admin/birthdays error:", error);
    return NextResponse.json({ error: error.message || "Failed to load birthdays" }, { status: 500 });
  }
}
