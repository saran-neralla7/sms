import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateLeaveBalances } from "@/lib/leaves";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "DIRECTOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, remarks } = body; // action: "approve" | "reject"

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveRequest.status !== "PENDING_DIRECTOR") {
      return NextResponse.json({ error: "Request is not pending Director approval" }, { status: 400 });
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "APPROVED" : "REJECTED",
        directorRemarks: remarks || null,
        directorApprovedAt: new Date(),
      },
    });

    // If approved, trigger balance recalculation for the calendar year of this leave request
    if (action === "approve") {
      const calendarYear = new Date(leaveRequest.startDate).getFullYear().toString();
      await recalculateLeaveBalances(leaveRequest.facultyId, calendarYear);
    }

    return NextResponse.json({ success: true, leaveRequest: updatedRequest });
  } catch (error: any) {
    console.error("PATCH /api/director/leaves/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to process leave request" }, { status: 500 });
  }
}
