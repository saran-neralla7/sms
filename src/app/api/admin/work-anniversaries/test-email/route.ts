import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTransporter,
  getFromEmail,
  getLogoAttachment,
  generatePersonalWorkAnniversaryHtml,
} from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role || "";
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required to send test emails." }, { status: 403 });
    }

    const body = await request.json();
    const { toEmail } = body;

    if (!toEmail || typeof toEmail !== "string" || !toEmail.includes("@")) {
      return NextResponse.json({ error: "Valid recipient email address (toEmail) is required." }, { status: 400 });
    }

    const transporter = getTransporter();
    const from = getFromEmail();
    const adminEmail = "saran.neralla@gvpcdpgc.edu.in";
    const logoAttachment = getLogoAttachment();

    const subject = "[TEST] 🏆 Happy Work Anniversary! — Celebrating 5 Years at GVPCDPGC!";
    const html = generatePersonalWorkAnniversaryHtml("Dr. D.S.S.N. Raju", 5);

    const info = await transporter.sendMail({
      from,
      to: toEmail,
      bcc: adminEmail,
      subject,
      html,
      attachments: [logoAttachment],
    });

    return NextResponse.json({
      success: true,
      message: `Test work anniversary email sent successfully to ${toEmail}!`,
      messageId: info.messageId,
      accepted: info.accepted,
    });
  } catch (error: any) {
    console.error("Test email sending error:", error);
    return NextResponse.json(
      {
        error: "Failed to send test email: " + (error.message || String(error)),
        hint: "Make sure SMTP_HOST, SMTP_USER, and SMTP_PASS are correctly set in .env",
      },
      { status: 500 }
    );
  }
}
