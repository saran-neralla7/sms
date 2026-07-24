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

  try {
    const { auditLogId, postComment, exitType } = await req.json();

    const cookieStore = await cookies();
    const existingCookie = cookieStore.get("impersonate_session")?.value;
    let cookieData: any = null;
    if (existingCookie) {
      try {
        cookieData = JSON.parse(existingCookie);
      } catch (e) {}
    }

    const targetAuditId = auditLogId || cookieData?.auditLogId;

    if (!postComment || typeof postComment !== "string" || postComment.trim().length < 5) {
      return NextResponse.json({ error: "Post-exit summary is required (minimum 5 characters)." }, { status: 400 });
    }

    const endedAt = new Date();
    let durationSeconds = 0;

    if (targetAuditId) {
      const existingAudit = await prisma.auditLog.findUnique({
        where: { id: targetAuditId }
      });

      if (existingAudit) {
        let detailsObj: any = {};
        try {
          detailsObj = JSON.parse(existingAudit.details);
        } catch (e) {}

        const startedAt = detailsObj.startedAt ? new Date(detailsObj.startedAt) : existingAudit.createdAt;
        durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

        const updatedDetails = {
          ...detailsObj,
          postComment: postComment.trim(),
          exitType: exitType || "MANUAL_EXIT",
          endedAt: endedAt.toISOString(),
          durationSeconds,
          status: exitType === "TIMEOUT" ? "CLOSED_BY_TIMEOUT" : "COMPLETED"
        };

        await prisma.auditLog.update({
          where: { id: targetAuditId },
          data: {
            details: JSON.stringify(updatedDetails)
          }
        });
      }
    } else {
      // Create fresh AuditLog if auditLogId was missing
      const adminUser = (session.user as any);
      await prisma.auditLog.create({
        data: {
          action: "IMPERSONATION_END",
          entity: "User",
          entityId: cookieData?.targetUserId || "UNKNOWN",
          performedBy: adminUser.username || adminUser.id,
          details: JSON.stringify({
            adminUsername: adminUser.username,
            targetUsername: cookieData?.targetUsername,
            postComment: postComment.trim(),
            exitType: exitType || "MANUAL_EXIT",
            endedAt: endedAt.toISOString(),
            status: "COMPLETED"
          })
        }
      });
    }

    // Clear impersonation cookie
    cookieStore.delete("impersonate_session");

    return NextResponse.json({ success: true, durationSeconds });
  } catch (error) {
    console.error("Error stopping impersonation:", error);
    return NextResponse.json({ error: "Failed to stop impersonation" }, { status: 500 });
  }
}
