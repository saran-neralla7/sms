import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logging";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "HOD") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, remarks } = body; // action: "approve" | "reject"

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        faculty: true,
      },
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Ensure HOD belongs to the same department as the faculty requesting leave
    const hodDeptId = (session.user as any).departmentId;
    if (leaveRequest.faculty.departmentId !== hodDeptId) {
      return NextResponse.json({ error: "Forbidden. Department mismatch." }, { status: 403 });
    }

    if (leaveRequest.status !== "PENDING_HOD") {
      return NextResponse.json({ error: "Request is not pending HOD approval" }, { status: 400 });
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "PENDING_DIRECTOR" : "REJECTED",
        hodRemarks: remarks || null,
        hodApprovedAt: new Date(),
      },
    });

    await logActivity(
      session.user.id,
      action === "approve" ? "APPROVE" : "REJECT",
      "LeaveRequest",
      `${leaveRequest.faculty.empName} | ${leaveRequest.leaveType} | ${leaveRequest.startDate.toDateString()} to ${leaveRequest.endDate.toDateString()}`,
      { leaveRequestId: id, action, remarks, newStatus: updatedRequest.status }
    );

    return NextResponse.json({ success: true, leaveRequest: updatedRequest });
  } catch (error: any) {
    console.error("PATCH /api/hod/leaves/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to process leave request" }, { status: 500 });
  }
}
