import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGlobalAccess } from "@/lib/permissions";

// GET /api/helpdesk/tickets
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const isGlobal = hasGlobalAccess(user);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const departmentId = searchParams.get("departmentId");
    const search = searchParams.get("search");

    let whereClause: any = {};

    if (!isGlobal) {
      // Faculty & HOD can only see their own tickets
      whereClause.userId = user.id;
    } else {
      // Admin / Director filters
      if (status && status !== "ALL") {
        whereClause.status = status;
      }
      if (category && category !== "ALL") {
        whereClause.category = category;
      }
      if (departmentId && departmentId !== "ALL") {
        whereClause.departmentId = departmentId;
      }
      if (search && search.trim() !== "") {
        const query = search.trim();
        whereClause.OR = [
          { title: { contains: query, mode: "insensitive" } },
          { user: { username: { contains: query, mode: "insensitive" } } },
          { user: { faculty: { empName: { contains: query, mode: "insensitive" } } } }
        ];
      }
    }

    const tickets = await prisma.helpdeskTicket.findMany({
      where: whereClause,
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
          orderBy: { createdAt: "desc" },
          take: 1
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: [
        { status: "asc" }, // OPEN, IN_PROGRESS first
        { updatedAt: "desc" }
      ]
    });

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    console.error("Error fetching helpdesk tickets:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch tickets" }, { status: 500 });
  }
}

// POST /api/helpdesk/tickets
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await req.json();
    const { title, category, priority = "MEDIUM", message } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Ticket title is required" }, { status: 400 });
    }
    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Initial message is required" }, { status: 400 });
    }

    const cleanCategory = category || "GENERAL";
    const cleanPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM";

    const senderName = user.name || user.username || "Faculty";

    const ticket = await prisma.helpdeskTicket.create({
      data: {
        title: title.trim(),
        category: cleanCategory,
        priority: cleanPriority,
        status: "OPEN",
        userId: user.id,
        facultyId: user.facultyId || null,
        departmentId: user.departmentId || null,
        messages: {
          create: {
            senderId: user.id,
            senderName,
            senderRole: user.role,
            message: message.trim()
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            faculty: {
              select: {
                empName: true,
                designation: true,
                department: { select: { name: true, code: true } }
              }
            }
          }
        },
        messages: true
      }
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error("Error creating helpdesk ticket:", error);
    return NextResponse.json({ error: error.message || "Failed to create ticket" }, { status: 500 });
  }
}
