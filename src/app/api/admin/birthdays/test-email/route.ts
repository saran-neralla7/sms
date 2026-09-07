import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTransporter,
  getFromEmail,
  generatePersonalBirthdayHtml,
  generateBroadcastBirthdayHtml,
} from "@/lib/email-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role || "";
    if (!session || !["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(userRole)) {
      return NextResponse.json({ error: "Admin access required to send test emails." }, { status: 403 });
    }

    const body = await request.json();
    const { toEmail, type = "personal" } = body;

    if (!toEmail || typeof toEmail !== "string" || !toEmail.includes("@")) {
      return NextResponse.json({ error: "Valid recipient email address (toEmail) is required." }, { status: 400 });
    }

    const transporter = getTransporter();
    const from = getFromEmail();

    let subject = "";
    let html = "";

    if (type === "broadcast") {
      subject = "[TEST] 🎉 Today's Birthday Celebrations at GVPCDPGC!";
      html = generateBroadcastBirthdayHtml([
        {
          name: "Dr. D.S.S.N. Raju",
          designation: "Assistant Professor",
          department: "Computer Science and Engineering (AI & ML)",
        },
        {
          name: "Prof. P V Vinay",
          designation: "Professor",
          department: "Mechanical Engineering",
        },
      ]);
    } else {
      subject = "[TEST] 🎂 Happy Birthday! — Best Wishes from GVPCDPGC Family!";
      html = generatePersonalBirthdayHtml("Dr. D.S.S.N. Raju");
    }

    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      message: `Test ${type} birthday email sent successfully to ${toEmail}!`,
      messageId: info.messageId,
      accepted: info.accepted,
    });
  } catch (error: any) {
    console.error("Test email sending error:", error);
    return NextResponse.json({
      error: "Failed to send test email: " + (error.message || String(error)),
      hint: "Make sure SMTP_HOST, SMTP_USER, and SMTP_PASS are correctly set in .env",
    }, { status: 500 });
  }
}
