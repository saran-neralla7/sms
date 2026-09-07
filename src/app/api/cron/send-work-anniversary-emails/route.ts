import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTransporter,
  getFromEmail,
  getLogoAttachment,
  generatePersonalWorkAnniversaryHtml,
} from "@/lib/email-service";

export async function POST(request: Request) {
  return handleWorkAnniversaryEmails(request);
}

export async function GET(request: Request) {
  return handleWorkAnniversaryEmails(request);
}

async function handleWorkAnniversaryEmails(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const cronSecret = process.env.CRON_SECRET || "CRON_SECRET_KEY";

    if (secret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
    }

    const today = new Date();
    const todayDateStr = today.toISOString().split("T")[0];

    // Check deduplication in AuditLog
    const existingLog = await prisma.auditLog.findFirst({
      where: {
        action: "WORK_ANNIVERSARY_EMAIL_DISPATCH",
        details: { contains: todayDateStr },
      },
    });

    if (existingLog) {
      return NextResponse.json({
        message: `Work Anniversary emails already dispatched for today (${todayDateStr}).`,
        alreadyDispatched: true,
      });
    }

    // Fetch active faculty
    const activeFaculty = await prisma.faculty.findMany({
      where: { resignDate: null },
      include: { department: true },
    });

    const celebrants = activeFaculty
      .map((f) => {
        if (!f.joinDate) return null;
        const joinDate = new Date(f.joinDate);
        if (joinDate.getMonth() === today.getMonth() && joinDate.getDate() === today.getDate()) {
          const years = today.getFullYear() - joinDate.getFullYear();
          if (years > 0) {
            return { ...f, years };
          }
        }
        return null;
      })
      .filter(Boolean) as Array<any>;

    if (celebrants.length === 0) {
      return NextResponse.json({ message: "No faculty work anniversaries today.", count: 0 });
    }

    const transporter = getTransporter();
    const from = getFromEmail();
    const adminEmail = "saran.neralla@gvpcdpgc.edu.in";
    const logoAttachment = getLogoAttachment();

    // Send Personal Wish Email to each celebrant ONLY (with BCC to admin)
    const personalResults: any[] = [];
    for (const c of celebrants) {
      if (!c.email) continue;

      const html = generatePersonalWorkAnniversaryHtml(c.empName, c.years);
      const subject = `🏆 Happy Work Anniversary, ${c.empName}! — Celebrating ${c.years} Year${c.years > 1 ? "s" : ""} at GVPCDPGC!`;

      try {
        const info = await transporter.sendMail({
          from,
          to: c.email,
          bcc: adminEmail,
          subject,
          html,
          attachments: [logoAttachment],
        });
        personalResults.push({ name: c.empName, email: c.email, years: c.years, messageId: info.messageId });
      } catch (err: any) {
        console.error(`Failed to send work anniversary email to ${c.empName}:`, err);
        personalResults.push({ name: c.empName, email: c.email, error: err.message });
      }
    }

    // Log execution to AuditLog
    await prisma.auditLog.create({
      data: {
        action: "WORK_ANNIVERSARY_EMAIL_DISPATCH",
        entity: "Faculty",
        details: `Dispatched personal work anniversary emails for ${todayDateStr}. Celebrants: ${celebrants.map((c) => `${c.empName} (${c.years}y)`).join(", ")}`,
        performedBy: "SYSTEM_CRON",
      },
    });

    return NextResponse.json({
      success: true,
      todayDate: todayDateStr,
      celebrantCount: celebrants.length,
      celebrants: celebrants.map((c) => ({ name: c.empName, email: c.email, years: c.years })),
      personalResults,
    });
  } catch (error: any) {
    console.error("Error in work anniversary email cron:", error);
    return NextResponse.json({ error: error.message || "Cron execution failed" }, { status: 500 });
  }
}
