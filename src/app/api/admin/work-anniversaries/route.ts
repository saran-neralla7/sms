import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getDaysUntilAnniversary(joinDate: Date, today: Date = new Date()) {
  const joinMonth = joinDate.getMonth();
  const joinDay = joinDate.getDate();

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  todayMidnight.setHours(0, 0, 0, 0);

  let nextAnniversary = new Date(today.getFullYear(), joinMonth, joinDay);
  nextAnniversary.setHours(0, 0, 0, 0);

  if (nextAnniversary < todayMidnight) {
    nextAnniversary.setFullYear(today.getFullYear() + 1);
  }

  const diffTime = nextAnniversary.getTime() - todayMidnight.getTime();
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const completedYears = nextAnniversary.getFullYear() - joinDate.getFullYear();

  return { daysUntil, completedYears, nextAnniversaryDate: nextAnniversary };
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
        joinDate: true,
        photoUrl: true,
        department: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    const formattedFaculty = faculty
      .filter((f) => f.joinDate !== null)
      .map((f) => {
        const joinDate = new Date(f.joinDate);
        const { daysUntil, completedYears } = getDaysUntilAnniversary(joinDate, today);

        return {
          id: f.id,
          name: f.empName,
          joinDate: f.joinDate,
          joinMonth: joinDate.getMonth() + 1, // 1-12
          joinDay: joinDate.getDate(),
          photoUrl: f.photoUrl,
          designation: f.designation,
          department: f.department.name,
          deptCode: f.department.code,
          completedYears,
          daysUntil,
        };
      });

    if (monthParam) {
      const monthInt = parseInt(monthParam, 10);
      if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
        return NextResponse.json({ error: "Invalid month parameter" }, { status: 400 });
      }

      const monthAnniversaries = formattedFaculty
        .filter((a) => a.joinMonth === monthInt)
        .sort((a, b) => a.joinDay - b.joinDay);

      return NextResponse.json({ anniversaries: monthAnniversaries });
    }

    const upcoming = [...formattedFaculty]
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 15);

    const thisMonth = formattedFaculty
      .filter((a) => a.joinMonth === currentMonth0Indexed + 1)
      .sort((a, b) => a.joinDay - b.joinDay);

    return NextResponse.json({ upcoming, thisMonth });
  } catch (error: any) {
    console.error("GET /api/admin/work-anniversaries error:", error);
    return NextResponse.json({ error: error.message || "Failed to load work anniversaries" }, { status: 500 });
  }
}
