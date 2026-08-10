# Automated Faculty Birthday Email System Architecture

## Overview
An automated daily email notification system designed for GVPCDPGC Faculty. Every morning at 08:00 AM, the system identifies faculty members celebrating their birthday and dispatches:
1. **Personal Birthday Wish**: A warm, festive email sent directly to the birthday celebrant(s).
2. **Broadcast Announcement**: A consolidated email sent to all other faculty members celebrating their colleague's birthday.

---

## Key Features & Rules

### 1. Personal Wishing Mail (To the Birthday Celebrant)
- **Recipient**: The faculty member celebrating their birthday today.
- **Salutation**: Dynamic & respectful based on gender/designation (e.g., *"Dear Dr. [Name]"*, *"Dear Prof. [Name]"*, *"Dear Sir/Madam"*).
- **Design**: Rich HTML with celebratory banner, confetti/balloon graphics, motivational quote, and warm wishes from the Management & Principal.

### 2. Broadcast Announcement (To All Other Faculty)
- **Recipients**: All other active faculty members.
- **Single Birthday**: Features a highlight card with photo, name, designation, and department.
- **Multiple Birthdays (Same Day)**: If 2 or more faculty members share a birthday on the same day, the system **combines all celebrants into a SINGLE consolidated broadcast email** so colleagues receive one clean announcement instead of multiple spam emails.

---

## Technical Setup & Requirements

### 1. Email Service Configuration (SMTP)
Add the following credentials to `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=notifications@gvpcdpgc.edu.in
SMTP_PASS=your_app_password
SMTP_FROM="GVPCDPGC Notifications <notifications@gvpcdpgc.edu.in>"
```

### 2. Automated Daily Trigger (Cron Job)
Scheduled via Linux crontab (`crontab -e`) to execute daily at 08:00 AM IST:
```bash
0 8 * * * curl -X POST http://localhost:3000/api/cron/send-birthday-emails?secret=CRON_SECRET_KEY
```

### 3. Safety & Deduplication
- Prevents sending duplicate emails if the cron runs more than once on the same day.
- Logs all dispatched emails to the `AuditLog` table for tracking.
