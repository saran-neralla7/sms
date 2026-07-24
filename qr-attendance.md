# Dynamic QR Code & Device-Locked Attendance System Specification

Comprehensive feature and security specification for the **Dynamic QR Code Attendance System**, designed for proxy-free, high-speed attendance in large classrooms (200+ students).

---

## 1. Core Workflow & Speed Optimization

* **Faculty Display**:
  * Faculty opens "QR Attendance Mode" on their laptop, tablet, or projector screen.
  * A large **Dynamic Rolling QR Code** is displayed.
  * Faculty sees a real-time grid of enrolled students turning **GREEN** as they scan.
  * Total time for 200+ students: **Under 90 seconds**.

* **Student Scan**:
  * Student opens their Student Portal on their mobile browser and clicks **"Scan Class Attendance QR"**.
  * Pointing the camera at the screen validates and records attendance instantly.

---

## 2. Anti-Proxy & Security Controls

### A. Dynamic 5-Second Rolling QR Token
* The QR code refreshes automatically **every 5 seconds** with a time-sensitive encrypted token.
* **Effect**: Prevents students from taking a photo of the QR code and sharing it on WhatsApp/Telegram with absent friends outside the classroom.

### B. Hardware Device Lock (1 Phone = 1 Student)
* On first login, the system registers the student's unique **Browser Hardware & Canvas Fingerprint** (GPU renderer, WebGL signature, screen resolution, CPU cores, device memory).
* **Multi-Browser & Incognito Protection**: The hardware fingerprint remains identical across Chrome, Firefox, Safari, and Incognito mode on the same physical phone.
* **Effect**: A student cannot log out and log in as an absent friend on their phone. Attempting to scan for another student yields:  
  `❌ Proxy Blocked: This physical device is bound to Roll No 22951A0501.`

### C. Strict Cross-Class & Subject Locking
* The QR payload embeds `{ subjectId, sectionId, academicYearId }`.
* **Database Verification**: The server verifies that the scanning student is explicitly enrolled in that year, semester, section, and subject.
* **Effect**: Students from other rooms or branches cannot scan a QR code from another class.

---

## 3. Administrative Workflows & Edge Cases

### A. Faculty Manual Override (No-Phone / No-Internet Exception Handling)
* Faculty screen displays:
  * 🟢 **Present (Auto-Marked via QR)**
  * 🔴 **Unscanned / Absent**
* If a student's battery dies or they have no mobile data, the faculty simply taps that student's name on their screen to manually set them to **PRESENT (Faculty Override)**.

### B. HOD / Director Device Reset Approval Workflow
* If a student purchases a new phone, repairs their screen, or resets their browser:
  1. Student clicks **"Request Device Reset"** on their portal.
  2. Request appears on the **HOD / Director / Admin Panel** under **"Pending Device Reset Requests"**.
  3. HOD / Director clicks **"Approve Reset"**.
  4. System records the action in `AuditLog`:  
     `DEVICE_RESET_APPROVED: HOD [Username] approved reset for Student [Roll No] on [Date & Time].`
  5. The student can now bind their new phone on their next scan.

---

## Status
* **Document Status**: SAVED & SPECIFIED (`qr-attendance.md`)
* **Next Action**: Awaiting user instruction to implement when ready.
