import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTransporter,
  getFromEmail,
  getLogoAttachment,
  getBirthdayCakeAttachment,
  getFacultyPhotoAttachment,
  generatePersonalBirthdayHtml,
  generateBroadcastBirthdayHtml,
} from "@/lib/email-service";

export async function POST(request: Request) {
  return handleBirthdayEmails(request);
}

export async function GET(request: Request) {
  return handleBirthdayEmails(request);
}

async function handleBirthdayEmails(request: Request) {
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
        action: "BIRTHDAY_EMAIL_DISPATCH",
        details: { contains: todayDateStr },
      },
    });

    if (existingLog) {
      return NextResponse.json({
        message: `Birthday emails already dispatched for today (${todayDateStr}).`,
        alreadyDispatched: true,
      });
    }

    // Fetch active faculty
    const activeFaculty = await prisma.faculty.findMany({
      where: { resignDate: null },
      include: { department: true },
    });

    const celebrants = activeFaculty.filter((f) => {
      if (!f.dob) return false;
      const dob = new Date(f.dob);
      return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
    });

    if (celebrants.length === 0) {
      return NextResponse.json({ message: "No faculty birthdays today.", count: 0 });
    }

    const transporter = getTransporter();
    const from = getFromEmail();
    const adminEmail = "saran.neralla@gvpcdpgc.edu.in";
    const logoAttachment = getLogoAttachment();
    const cakeAttachment = getBirthdayCakeAttachment();

    // 1. Send Personal Wish Email to each celebrant
    const personalResults: any[] = [];
    for (const c of celebrants) {
      if (!c.email) continue;

      const html = generatePersonalBirthdayHtml(c.empName);
      const subject = `🎂 Happy Birthday, ${c.empName}! — Best Wishes from GVPCDPGC Family!`;

      try {
        const info = await transporter.sendMail({
          from,
          to: c.email,
          bcc: adminEmail,
          subject,
          html,
          attachments: [logoAttachment, cakeAttachment],
        });
        personalResults.push({ name: c.empName, email: c.email, messageId: info.messageId });
      } catch (err: any) {
        console.error(`Failed to send personal birthday email to ${c.empName}:`, err);
        personalResults.push({ name: c.empName, email: c.email, error: err.message });
      }
    }

    // 2. Send Broadcast Email to all active faculty (and always include Admin)
    const celebrantIds = new Set(celebrants.map((c) => c.id));
    const broadcastRecipients = activeFaculty
      .filter((f) => !celebrantIds.has(f.id) && f.email && f.email.trim() !== "")
      .map((f) => f.email!);

    if (!broadcastRecipients.includes(adminEmail)) {
      broadcastRecipients.push(adminEmail);
    }

    let broadcastResult: any = null;
    if (broadcastRecipients.length > 0) {
      const celebrantDetails = celebrants.map((c) => ({
        name: c.empName,
        designation: c.designation || "Faculty",
        department: c.department?.name || "GVPCDPGC",
        photoUrl: c.photoUrl,
      }));

      const broadcastHtml = generateBroadcastBirthdayHtml(celebrantDetails);
      const broadcastSubject = `🎉 Today's Birthday Celebrations at GVPCDPGC!`;

      const broadcastAttachments: any[] = [logoAttachment];
      celebrantDetails.forEach((c, idx) => {
        const pAtt = getFacultyPhotoAttachment(c.photoUrl, idx);
        if (pAtt) broadcastAttachments.push(pAtt);
      });

      try {
        const info = await transporter.sendMail({
          from,
          to: broadcastRecipients,
          bcc: adminEmail,
          subject: broadcastSubject,
          html: broadcastHtml,
          attachments: broadcastAttachments,
        });
        broadcastResult = { recipientCount: broadcastRecipients.length, messageId: info.messageId };
      } catch (err: any) {
        console.error("Failed to send broadcast birthday email:", err);
        broadcastResult = { error: err.message };
      }
    }

    // Log execution to AuditLog to prevent duplicate runs
    await prisma.auditLog.create({
      data: {
        action: "BIRTHDAY_EMAIL_DISPATCH",
        entity: "Faculty",
        details: `Dispatched birthday emails for ${todayDateStr}. Celebrants: ${celebrants.map((c) => c.empName).join(", ")}`,
        performedBy: "SYSTEM_CRON",
      },
    });

    return NextResponse.json({
      success: true,
      todayDate: todayDateStr,
      celebrantCount: celebrants.length,
      celebrants: celebrants.map((c) => ({ name: c.empName, email: c.email })),
      personalResults,
      broadcastResult,
    });
  } catch (error: any) {
    console.error("Error in birthday email cron:", error);
    return NextResponse.json({ error: error.message || "Cron execution failed" }, { status: 500 });
  }
}
