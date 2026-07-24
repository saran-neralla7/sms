import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "DIRECTOR", "SUPERADMIN"].includes(role?.toUpperCase())) {
    return NextResponse.json({ error: "Access Denied: Only Admins can impersonate." }, { status: 403 });
  }

  try {
    const { targetUserId, preComment, isReadOnly } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    if (!preComment || typeof preComment !== "string" || preComment.trim().length < 10) {
      return NextResponse.json({ error: "Pre-access reason is mandatory and must be at least 10 characters." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { faculty: true }
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const adminUser = (session.user as any);

    // Create AuditLog entry
    const auditRecord = await prisma.auditLog.create({
      data: {
        action: "IMPERSONATION_START",
        entity: "User",
        entityId: targetUserId,
        performedBy: adminUser.username || adminUser.id,
        details: JSON.stringify({
          adminId: adminUser.id,
          adminUsername: adminUser.username,
          adminRole: adminUser.role,
          targetUserId: targetUser.id,
          targetUsername: targetUser.username,
          targetName: targetUser.faculty?.empName || targetUser.username,
          targetRole: targetUser.role,
          targetFacultyId: targetUser.facultyId,
          targetDepartmentId: targetUser.departmentId,
          preComment: preComment.trim(),
          isReadOnly: !!isReadOnly,
          status: "ACTIVE",
          startedAt: new Date().toISOString()
        })
      }
    });

    const sessionPayload = {
      auditLogId: auditRecord.id,
      adminId: adminUser.id,
      adminUsername: adminUser.username,
      adminRole: adminUser.role,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
      targetName: targetUser.faculty?.empName || targetUser.username,
      targetRole: targetUser.role,
      targetFacultyId: targetUser.facultyId,
      targetDepartmentId: targetUser.departmentId,
      preComment: preComment.trim(),
      isReadOnly: !!isReadOnly,
      startedAt: new Date().toISOString()
    };

    const cookieStore = await cookies();
    cookieStore.set("impersonate_session", JSON.stringify(sessionPayload), {
      httpOnly: false, // allow client-side reading for banner
      path: "/",
      sameSite: "lax",
      maxAge: 3600 // 1 hour max
    });

    return NextResponse.json({
      success: true,
      auditLogId: auditRecord.id,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error("Error starting impersonation:", error);
    return NextResponse.json({ error: "Failed to start impersonation" }, { status: 500 });
  }
}
