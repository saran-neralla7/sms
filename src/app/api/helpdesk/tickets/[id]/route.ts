import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalAccess } from "@/lib/permissions";

// GET /api/helpdesk/tickets/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    const ticket = await prisma.helpdeskTicket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            faculty: {
              select: {
                id: true,
                empCode: true,
                empName: true,
                designation: true,
                mobile: true,
                email: true,
                department: {
                  select: { id: true, name: true, code: true }
                }
              }
            }
          }
        },
        resolvedBy: {
          select: {
            id: true,
            username: true
          }
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // RBAC: Faculty/HOD can only view their own ticket
    if (!isGlobal && ticket.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error("Error fetching ticket details:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch ticket" }, { status: 500 });
  }
}

// POST /api/helpdesk/tickets/[id] (Add message to thread)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    const ticket = await prisma.helpdeskTicket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // RBAC check
    if (!isGlobal && ticket.userId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    const senderName = user.name || user.username || (isGlobal ? "Administrator" : "Faculty");

    // Add message
    const newMessage = await prisma.helpdeskMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        senderName,
        senderRole: user.role,
        message: message.trim()
      }
    });

    // If Admin replies and ticket is OPEN, update to IN_PROGRESS
    if (isGlobal && ticket.status === "OPEN") {
      await prisma.helpdeskTicket.update({
        where: { id },
        data: { status: "IN_PROGRESS" }
      });
    }

    // If Faculty replies to a RESOLVED ticket, transition back to IN_PROGRESS
    if (!isGlobal && ticket.status === "RESOLVED") {
      await prisma.helpdeskTicket.update({
        where: { id },
        data: { status: "IN_PROGRESS" }
      });
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error("Error sending helpdesk message:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}

// PATCH /api/helpdesk/tickets/[id] (Update status, resolve, or edit priority)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    const ticket = await prisma.helpdeskTicket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, resolutionNotes, priority } = body;

    // Faculty can only close their own resolved ticket
    if (!isGlobal) {
      if (ticket.userId !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (status && status !== "CLOSED") {
        return NextResponse.json({ error: "Faculty can only close tickets" }, { status: 403 });
      }

      const updated = await prisma.helpdeskTicket.update({
        where: { id },
        data: { status: "CLOSED" }
      });
      return NextResponse.json({ success: true, ticket: updated });
    }

    // Admin / Director updates
    const updateData: any = {};

    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      updateData.priority = priority;
    }

    if (status && ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
      updateData.status = status;

      if (status === "RESOLVED") {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = user.id;
        if (resolutionNotes) {
          updateData.resolutionNotes = resolutionNotes.trim();
        }

        // Add a system resolution message to thread
        const notesText = resolutionNotes ? `\n\nResolution Remarks: ${resolutionNotes.trim()}` : "";
        await prisma.helpdeskMessage.create({
          data: {
            ticketId: id,
            senderId: user.id,
            senderName: user.name || "Administrator",
            senderRole: "ADMIN",
            message: `✅ Issue marked as RESOLVED by Administrator.${notesText}`
          }
        });
      }
    }

    const updated = await prisma.helpdeskTicket.update({
      where: { id },
      data: updateData,
      include: {
        resolvedBy: {
          select: { id: true, username: true }
        }
      }
    });

    return NextResponse.json({ success: true, ticket: updated });
  } catch (error: any) {
    console.error("Error updating helpdesk ticket:", error);
    return NextResponse.json({ error: error.message || "Failed to update ticket" }, { status: 500 });
  }
}
