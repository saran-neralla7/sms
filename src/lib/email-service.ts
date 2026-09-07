import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

export function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured in environment variables (.env).");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export function getFromEmail() {
  return process.env.SMTP_FROM || `GVPCDPGC Notifications <${process.env.SMTP_USER || "notifications@gvpcdpgc.edu.in"}>`;
}

export function getLogoAttachment() {
  return {
    filename: "gvp-logo.jpg",
    path: path.join(process.cwd(), "public", "gvp-logo.jpg"),
    cid: "gvplogo",
  };
}

export function getBirthdayCakeAttachment() {
  return {
    filename: "birthday-cake.png",
    path: path.join(process.cwd(), "public", "birthday-cake.png"),
    cid: "birthdaycake",
  };
}

export function getFacultyPhotoAttachment(photoUrl?: string | null, index: number = 0) {
  if (!photoUrl) return null;
  const filename = photoUrl.replace(/^\/api\/faculty-photos\//, "").replace(/^\/faculty-photos\//, "");
  const fullPath = path.join(process.cwd(), "public", "faculty-photos", filename);
  if (fs.existsSync(fullPath)) {
    const ext = path.extname(filename) || ".jpg";
    return {
      filename: `faculty-photo-${index}${ext}`,
      path: fullPath,
      cid: `facultyphoto${index}`,
    };
  }
  return null;
}

const LOGO_HEADER_HTML = `
  <div style="background-color: #ffffff; padding: 16px 20px; text-align: center; border-bottom: 2px solid #e2e8f0;">
    <img src="cid:gvplogo" alt="Gayatri Vidya Parishad College Logo" style="max-height: 70px; width: auto; display: inline-block;" />
    <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
      Gayatri Vidya Parishad College for Degree & PG Courses (A)
    </div>
    <div style="font-size: 11px; color: #64748b;">Visakhapatnam | Re-accredited by NAAC | Autonomous</div>
  </div>
`;

export function generatePersonalBirthdayHtml(name: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #4f46e5 100%); padding: 32px 20px 24px 20px; text-align: center; color: #ffffff; position: relative; }
    .header h1 { margin: 10px 0 0 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 15px; opacity: 0.95; }
    .body-content { padding: 30px 28px; color: #334155; line-height: 1.7; }
    .salutation { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
    .quote-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin: 20px 0; font-style: italic; color: #475569; }
    .signature { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
    .cake-banner { text-align: center; margin: 15px 0 25px 0; }
    .cake-banner img { max-width: 140px; width: 140px; height: auto; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    ${LOGO_HEADER_HTML}
    <div class="header">
      <div style="font-size: 38px; margin-bottom: 4px;">🎉 🎂 🎉</div>
      <h1>Happy Birthday!</h1>
      <p>Wishing you a wonderful day filled with joy, peace, and success!</p>
    </div>
    <div class="body-content">
      <div class="cake-banner">
        <img src="cid:birthdaycake" alt="Birthday Cake" width="140" style="width: 140px; max-width: 140px; display: inline-block;" />
      </div>
      <div class="salutation">Dear ${name},</div>
      <p>On behalf of the <strong>Management, Principal, and the entire GVPCDPGC Family</strong>, we extend our warmest wishes to you on your birthday!</p>
      
      <div class="quote-box">
        "Education is not the learning of facts, but the training of the mind to think."
      </div>
      
      <p>Thank you for your dedicated service, inspiration, and invaluable contributions to our institution and students. May this coming year bring you good health, prosperity, happiness, and continued success in all your endeavours.</p>
      
      <div class="signature">
        <strong style="color: #1e293b; font-size: 15px;">Warm Regards,</strong><br>
        <strong>Management & Principal</strong><br>
        Gayatri Vidya Parishad College for Degree and PG Courses (A)<br>
        Visakhapatnam
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Gayatri Vidya Parishad College for Degree and PG Courses (A).
    </div>
  </div>
</body>
</html>`;
}

export function generateBroadcastBirthdayHtml(
  celebrants: Array<{ name: string; designation: string; department: string; photoUrl?: string | null }>
) {
  const celebrantCards = celebrants
    .map((c, index) => {
      const photoAtt = getFacultyPhotoAttachment(c.photoUrl, index);
      const initials = c.name
        .replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.|CH\.)\s*/i, "")
        .trim()
        .split(" ")
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "FC";

      const photoHtml = photoAtt
        ? `<img src="cid:facultyphoto${index}" alt="${c.name}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #10b981; margin-right: 16px; flex-shrink: 0; display: block;" />`
        : `<div style="width: 60px; height: 60px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 16px; flex-shrink: 0;">${initials}</div>`;

      return `
      <div style="display: flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        ${photoHtml}
        <div>
          <h3 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px;">${c.name}</h3>
          <p style="margin: 2px 0; color: #64748b; font-size: 13px;"><strong>Designation:</strong> ${c.designation || "Faculty"}</p>
          <p style="margin: 2px 0; color: #64748b; font-size: 13px;"><strong>Department:</strong> ${c.department || "GVPCDPGC"}</p>
        </div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 28px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; font-size: 15px; opacity: 0.9; }
    .body-content { padding: 28px 24px; color: #334155; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    ${LOGO_HEADER_HTML}
    <div class="header">
      <div style="font-size: 38px; margin-bottom: 6px;">🎈 🎉 🎈</div>
      <h1>Birthday Announcement!</h1>
      <p>Let's celebrate our colleagues today!</p>
    </div>
    <div class="body-content">
      <p style="font-size: 15px; margin-bottom: 20px;">Dear Colleagues,</p>
      <p style="margin-bottom: 24px;">Please join us in wishing a very <strong>Happy Birthday</strong> to our esteemed colleague(s) celebrating today:</p>
      
      ${celebrantCards}
      
      <p style="text-align: center; margin-top: 24px; font-size: 14px; color: #475569;">
        ✨ Take a moment to reach out and wish them a wonderful day! ✨
      </p>
    </div>
    <div class="footer">
      Gayatri Vidya Parishad College for Degree and PG Courses (A) — Faculty Notifications
    </div>
  </div>
</body>
</html>`;
}

export function generatePersonalWorkAnniversaryHtml(name: string, years: number) {
  const yearText = years === 1 ? "1 Year" : `${years} Years`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #6366f1 100%); padding: 32px 20px 24px 20px; text-align: center; color: #ffffff; position: relative; }
    .header h1 { margin: 10px 0 0 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 15px; opacity: 0.95; }
    .body-content { padding: 30px 28px; color: #334155; line-height: 1.7; }
    .salutation { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
    .milestone-badge { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; padding: 18px; border-radius: 12px; text-align: center; margin: 20px 0; color: #78350f; }
    .milestone-years { font-size: 28px; font-weight: 800; color: #b45309; }
    .signature { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    ${LOGO_HEADER_HTML}
    <div class="header">
      <div style="font-size: 38px; margin-bottom: 4px;">🏆 🎉 🎖️</div>
      <h1>Happy Work Anniversary!</h1>
      <p>Celebrating your commitment & achievements with GVPCDPGC!</p>
    </div>
    <div class="body-content">
      <div class="salutation">Dear ${name},</div>
      <p>On behalf of the <strong>Management, Principal, and the entire GVPCDPGC Family</strong>, we send our heartfelt congratulations on your work anniversary today!</p>
      
      <div class="milestone-badge">
        <div style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #92400e;">Service Milestone</div>
        <div class="milestone-years">🌟 ${yearText} of Excellence 🌟</div>
        <div style="font-size: 13px; color: #92400e; margin-top: 4px;">Thank you for being an indispensable part of our college family!</div>
      </div>
      
      <p>Your dedication, hard work, and continuous commitment have played a vital role in the growth and academic standard of our institution. We deeply appreciate your valuable contributions to our students and community.</p>
      
      <p>May your journey with us continue to bring professional fulfillment, personal happiness, and many more milestones of success!</p>
      
      <div class="signature">
        <strong style="color: #1e293b; font-size: 15px;">Warm Regards,</strong><br>
        <strong>Management & Principal</strong><br>
        Gayatri Vidya Parishad College for Degree and PG Courses (A)<br>
        Visakhapatnam
      </div>
    </div>
    <div class="footer">
      This is an automated notification from Gayatri Vidya Parishad College for Degree and PG Courses (A).
    </div>
  </div>
</body>
</html>`;
}
