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
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      leaveType,
      startDateStr,
      endDateStr,
      numberOfDays,
      reason,
      substituteId,
      status,
      hodRemarks,
      directorRemarks,
    } = body;

    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const oldFacultyId = existingRequest.facultyId;
    const oldYear = new Date(existingRequest.startDate).getFullYear().toString();

    // Map new fields
    const updatedData: any = {};
    if (leaveType) updatedData.leaveType = leaveType;
    if (startDateStr) updatedData.startDate = new Date(startDateStr);
    if (endDateStr) updatedData.endDate = new Date(endDateStr);
    if (numberOfDays !== undefined) updatedData.numberOfDays = parseFloat(numberOfDays);
    if (reason) updatedData.reason = reason;
    if (substituteId !== undefined) updatedData.substituteId = substituteId || null;
    if (status) updatedData.status = status;
    if (hodRemarks !== undefined) updatedData.hodRemarks = hodRemarks || null;
    if (directorRemarks !== undefined) updatedData.directorRemarks = directorRemarks || null;

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: updatedData,
    });

    // Reconcile balances for old faculty/year
    await recalculateLeaveBalances(oldFacultyId, oldYear);

    // Reconcile balances for new faculty/year if changed
    const newFacultyId = updatedRequest.facultyId;
    const newYear = new Date(updatedRequest.startDate).getFullYear().toString();
    if (oldFacultyId !== newFacultyId || oldYear !== newYear) {
      await recalculateLeaveBalances(newFacultyId, newYear);
    }

    return NextResponse.json({ success: true, leaveRequest: updatedRequest });
  } catch (error: any) {
    console.error("PATCH /api/admin/leaves/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to edit leave request" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingRequest = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const facultyId = existingRequest.facultyId;
    const calendarYear = new Date(existingRequest.startDate).getFullYear().toString();

    await prisma.leaveRequest.delete({
      where: { id },
    });

    // Reconcile balances if the deleted request was approved
    if (existingRequest.status === "APPROVED") {
      await recalculateLeaveBalances(facultyId, calendarYear);
    }

    return NextResponse.json({ success: true, message: "Leave request deleted and balances updated." });
  } catch (error: any) {
    console.error("DELETE /api/admin/leaves/[id] error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete leave request" }, { status: 500 });
  }
}
