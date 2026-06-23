import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateFacultyLeaveQuota } from "@/lib/leaves";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const facultyId = id;
    const body = await req.json();
    const { clQuota, calendarYear } = body;

    if (clQuota === undefined || !calendarYear) {
      return NextResponse.json({ error: "clQuota and calendarYear are required" }, { status: 400 });
    }

    // Ensure quota record exists
    await getOrCreateFacultyLeaveQuota(facultyId, calendarYear);

    const updatedQuota = await prisma.facultyLeaveQuota.update({
      where: {
        facultyId_calendarYear: {
          facultyId,
          calendarYear,
        },
      },
      data: {
        clQuota: parseFloat(clQuota),
      },
    });

    return NextResponse.json({ success: true, quota: updatedQuota });
  } catch (error: any) {
    console.error("PATCH /api/admin/faculty/[id]/leaves error:", error);
    return NextResponse.json({ error: error.message || "Failed to update quota" }, { status: 500 });
  }
}
