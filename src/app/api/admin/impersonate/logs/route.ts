import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "DIRECTOR", "SUPERADMIN"].includes(role?.toUpperCase())) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const logs = await prisma.auditLog.findMany({
      where: {
        action: { in: ["IMPERSONATION_START", "IMPERSONATION_END"] }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const parsedLogs = logs.map(log => {
      let detailsObj: any = {};
      try {
        detailsObj = JSON.parse(log.details);
      } catch (e) {}

      return {
        id: log.id,
        createdAt: log.createdAt,
        performedBy: log.performedBy,
        action: log.action,
        adminUsername: detailsObj.adminUsername || log.performedBy,
        targetUsername: detailsObj.targetUsername || "Unknown",
        targetName: detailsObj.targetName || detailsObj.targetUsername || "Unknown",
        targetRole: detailsObj.targetRole || "FACULTY",
        preComment: detailsObj.preComment || "No pre-comment recorded",
        postComment: detailsObj.postComment || null,
        isReadOnly: !!detailsObj.isReadOnly,
        status: detailsObj.status || (detailsObj.postComment ? "COMPLETED" : "ACTIVE"),
        durationSeconds: detailsObj.durationSeconds || null,
        endedAt: detailsObj.endedAt || null
      };
    });

    const filteredLogs = parsedLogs.filter(l => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        l.adminUsername.toLowerCase().includes(s) ||
        l.targetUsername.toLowerCase().includes(s) ||
        l.targetName.toLowerCase().includes(s) ||
        l.preComment.toLowerCase().includes(s) ||
        (l.postComment && l.postComment.toLowerCase().includes(s))
      );
    });

    return NextResponse.json({ logs: filteredLogs });
  } catch (error) {
    console.error("Error fetching impersonation logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
