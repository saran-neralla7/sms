const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Simple .env parser
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '465', 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM || `GVPCDPGC Notifications <${user}>`;

const targetEmail = 'saran.neralla@gvpcdpgc.edu.in';

console.log('Using SMTP User:', user);
console.log('Target Email:', targetEmail);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: true,
  auth: { user, pass }
});

const personalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #4f46e5 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0 0; font-size: 16px; opacity: 0.9; }
    .body-content { padding: 32px 28px; color: #334155; line-height: 1.7; }
    .salutation { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
    .quote-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin: 20px 0; font-style: italic; color: #475569; }
    .signature { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b; font-size: 14px; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="font-size: 48px; margin-bottom: 10px;">🎉 🎂 🎉</div>
      <h1>Happy Birthday!</h1>
      <p>Wishing you a wonderful day filled with joy and success!</p>
    </div>
    <div class="body-content">
      <div class="salutation">Dear Saran Neralla,</div>
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

const broadcastHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 32px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; font-size: 15px; opacity: 0.9; }
    .body-content { padding: 28px 24px; color: #334155; }
    .footer { background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="font-size: 40px; margin-bottom: 8px;">🎈 🎉 🎈</div>
      <h1>Birthday Announcement!</h1>
      <p>Let's celebrate our colleagues today!</p>
    </div>
    <div class="body-content">
      <p style="font-size: 15px; margin-bottom: 20px;">Dear Colleagues,</p>
      <p style="margin-bottom: 24px;">Please join us in wishing a very <strong>Happy Birthday</strong> to our esteemed colleague(s) celebrating today:</p>
      
      <div style="display: flex; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; margin-right: 16px; flex-shrink: 0;">SN</div>
        <div>
          <h3 style="margin: 0 0 4px 0; color: #0f172a; font-size: 17px;">Saran Neralla</h3>
          <p style="margin: 2px 0; color: #64748b; font-size: 13px;"><strong>Designation:</strong> Assistant Professor</p>
          <p style="margin: 2px 0; color: #64748b; font-size: 13px;"><strong>Department:</strong> Computer Science and Engineering</p>
        </div>
      </div>
      
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

async function send() {
  console.log('Sending Personal Wish Email to', targetEmail, '...');
  const res1 = await transporter.sendMail({
    from,
    to: targetEmail,
    subject: '🎂 Happy Birthday, Saran Neralla! — Best Wishes from GVPCDPGC Family!',
    html: personalHtml
  });
  console.log('✅ Personal Email Sent Successfully! Message ID:', res1.messageId);

  console.log('Sending Broadcast Announcement Email to', targetEmail, '...');
  const res2 = await transporter.sendMail({
    from,
    to: targetEmail,
    subject: '🎉 Today\'s Birthday Celebrations at GVPCDPGC!',
    html: broadcastHtml
  });
  console.log('✅ Broadcast Email Sent Successfully! Message ID:', res2.messageId);
}

send().catch(err => {
  console.error('❌ Error sending emails:', err);
});
