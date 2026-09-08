# Implementation Plan — Multi-Assignment & Question Management System

Design and implement a complete **Multi-Assignment & Question Management System** for faculty and students with strict section-level isolation, assignment cloning across sections, total assignment marks, student deadline tracking, dedicated faculty dashboard access, and 100% data preservation.

---

## Key Refinements & User Requirements Incorporated

1. **Total Assignment Marks**: Each assignment has a single **Total Marks** value (e.g. 10, 20, 50). Individual question marks are omitted.
2. **Dedicated Faculty Dashboard Card**: A dedicated **Subject Assignments** card will be added directly on the Faculty Dashboard (`/faculty`).
3. **Deadline Dates & Student Portal**: Faculty can specify **Deadline / Due Dates**. Students can view their subject assignments, questions, total marks, deadline dates, and submission status in their Student Portal.
4. **Strict Security & Section Isolation**: Assignments are strictly scoped to `[academicYearId, departmentId, year, semester, sectionId, subjectId]`. Only students belonging to that specific department, year, semester, and section can view the assignment or have marks entered.
5. **Assignment Cloning Across Sections**: If a faculty member teaches the same subject across multiple sections (e.g. CSE-A and CSE-B), they can click **Clone Assignment** to copy the assignment (title, description, questions, total marks, deadline) to another section in 1 click!
6. **Always-ROUNDUP Scaling to 10 Marks**:
   - $\text{Score}_k = \frac{\text{marksObtained}_k}{\text{totalMarks}_k} \times 10$
   - $\text{Final Score} = \min(10, \lceil \text{Average of } \text{Score}_k \rceil)$ (**Always ROUNDUP using `Math.ceil()`**).
7. **Zero Data Loss Guarantee**: Legacy assignment records from previous academic years will map seamlessly to Assignment 1 without breaking historic internal mark reports or student transcripts.

---

## Proposed Changes

### Database Schema Layer (`prisma/schema.prisma`)

```prisma
model Assignment {
  id             String    @id @default(uuid())
  title          String    // e.g. "Assignment 1"
  description    String?   @db.Text
  questions      Json?     // [{ qNo: 1, text: "Explain Compiler Design Architecture" }]
  totalMarks     Float     @default(10) // Total marks for the assignment
  dueDate        DateTime? // Deadline date
  academicYearId String
  departmentId   String
  year           String
  semester       String
  sectionId      String
  subjectId      String
  createdById    String
  isFrozen       Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  academicYear AcademicYear     @relation(fields: [academicYearId], references: [id])
  subject      Subject          @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  section      Section          @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  marks        AssignmentMark[]

  @@index([academicYearId, departmentId, year, semester, sectionId, subjectId])
}

model AssignmentMark {
  id             String      @id @default(uuid())
  assignmentId   String?     // Links to Assignment. Nullable for legacy data
  assignment     Assignment? @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  academicYearId String
  departmentId   String
  year           String
  semester       String
  sectionId      String
  subjectId      String
  studentId      String
  marksObtained  Float?
  maxMarks       Float       @default(10)
  status         String      @default("NOT_SUBMITTED") // SUBMITTED | NOT_SUBMITTED
  enteredById    String
  isDraft        Boolean     @default(true)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  student      Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  subject      Subject      @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  academicYear AcademicYear @relation(fields: [academicYearId], references: [id])

  @@unique([assignmentId, studentId], name: "unique_assignment_student")
  @@index([academicYearId, departmentId, year, semester, sectionId, subjectId])
}
```

---

## Verification Plan

### Automated Tests & Type Checking
- Run `npx prisma db push` to verify database schema.
- Run `npm run build` to verify type safety and compilation.

### Manual End-to-End Verification Flow
1. **Faculty Assignment Creation & Question Entry**:
   - Log in as faculty, click **Subject Assignments** card on dashboard.
   - Select 3rd Year 1st Sem CSE Section A (CD Subject).
   - Create "Assignment 1": Total Marks = 20, Deadline = Sep 20, 2026. Enter 3 questions.
2. **Section Cloning Test**:
   - Click **Clone Assignment** $\rightarrow$ select CSE Section B.
   - Switch to Section B $\rightarrow$ Verify "Assignment 1" exists with identical questions and total marks.
3. **Student Security & Isolation Test**:
   - Log in as CSE Section A student $\rightarrow$ Verify Assignment 1 is visible under CD subject with deadline.
   - Log in as ECE or CSE Section B student $\rightarrow$ Verify Section A assignment is NOT visible.
4. **Marks Entry & Submission Status Auto-Switch**:
   - Faculty enters 15/20 for Student A $\rightarrow$ Status changes to `Submitted` (green).
   - Faculty enters 0/20 for Student B $\rightarrow$ Status changes to `Not Submitted` (gray/red).
5. **Always-ROUNDUP Calculation Test**:
   - Student gets 15/20 in Assignment 1 ($7.5$) and 12/20 in Assignment 2 ($6.0$). Average = $6.75 \rightarrow \text{Roundup} = \mathbf{7/10}$.
