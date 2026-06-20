# Implementation Plan - Course Files Feature

This plan outlines the architecture, database additions, API routes, and user interface layouts to implement the **Course Files** feature.

---

## 1. Current System Analysis (What We Have vs. What is Missing)

We analyzed the checklist of 23 required contents for a Course File and mapped them against the existing student management system database:

| S.No | Checklist Item | Current Status in System | Action Required |
|---|---|---|---|
| **1** | **Syllabus** | **Available** (`Subject.syllabus` JSON) | Render dynamically from subject catalog |
| **2** | **Course Objectives & Outcomes (COs)** | **Available** (`Subject.syllabus`) | Render dynamically |
| **3** | **CO-PO & CO-PSO Mapping** | **Available** (`coPoMappings` / `coPsoMappings`) | Render dynamically as a grid table |
| **4** | **Academic Calendar** | *Missing* | Faculty will upload as a PDF file per course file |
| **5** | **Lecture Plan & Textbook List** | *Partial* (Textbooks available in syllabus) | Add input form/JSON for unit-wise lecture plans |
| **6** | **Student List** | **Available** (`Student` records via mapping) | Render table of registered students with Roll Nos |
| **7** | **Faculty Timetable** | **Available** (`Timetable` model) | Filter and render the faculty's timetable periods |
| **8** | **Teaching Support Material** | *Missing* | Add rich text / Link input fields |
| **9** | **Assignment Questions (Unit-Wise)** | *Missing* | Add unit-wise text input fields |
| **10** | **I Mid Exam Question Paper** | **Available** (`MidExamPaper` model) | Render blueprint and questions dynamically |
| **11** | **I Mid Scheme of Evaluation** | *Missing* | Add text input / PDF upload field |
| **12** | **I Mid Exam Marks** | **Available** (`MidExamMarksEntry`) | Render marksheet table |
| **13** | **List of Slow Learners** | *Missing* | Auto-calculate: Students scoring < 40% in Mid-I |
| **14** | **Remedial Classes Log** | *Missing* | Add entry form (date, topic, and student attendance) |
| **15** | **II Mid Exam Question Paper** | **Available** (`MidExamPaper` model) | Render questions dynamically |
| **16** | **II Mid Scheme of Evaluation** | *Missing* | Add text input / PDF upload field |
| **17** | **II Mid Exam Marks** | **Available** (`MidExamMarksEntry`) | Render marksheet table |
| **18** | **Slow Learners Progress Status** | *Missing* | Auto-calculate: Students who scored < 40% in Mid-I but >= 40% in Mid-II |
| **19** | **Mid Marks mapping with COs** | **Available** (Derived from question blueprints) | Render attainment stats dynamically |
| **20** | **Final Sessional Marks** | **Available** (`InternalMark` model) | Render final internal marks |
| **21** | **Previous Question Papers** | *Missing* | Add upload area for historical exam PDFs |
| **22** | **Semester-End Exam Results** | **Available** (`SemesterResult` model) | Render student grades (once available in DB) |
| **23** | **CO PO Mapping (Attainment)** | **Available** | Render target vs attained levels |

---

## 2. Proposed Database Changes

To store the missing manual inputs (Academic Calendar, Lecture Plans, Schemes, Teaching Material, Remedial Logs, Assignment Questions) without cluttering the DB, we propose a single unified model per subject mapping:

```prisma
model CourseFile {
  id             String       @id @default(uuid())
  academicYearId String
  departmentId   String
  year           String
  semester       String
  sectionId      String
  subjectId      String
  facultyId      String

  // Rich Text / Text Inputs
  teachingSupportText   String?   @db.Text
  assignmentQuestions   Json?     // Array of { unit: string, questions: string[] }
  lecturePlan           Json?     // Array of { unit: string, topic: string, plannedPeriods: number, actualDate: string, aid: string }
  remedialClasses       Json?     // Array of { date: string, topics: string, studentRolls: string[] }

  // Uploaded PDF Files (Paths / URLs)
  academicCalendarPath  String?
  mid1SchemePath        String?
  mid2SchemePath        String?
  prevPapersPaths       Json?     // Array of string paths

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  // Relationships
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  department     Department   @relation(fields: [departmentId], references: [id])
  section        Section      @relation(fields: [sectionId], references: [id])
  subject        Subject      @relation(fields: [subjectId], references: [id])
  faculty        Faculty      @relation(fields: [facultyId], references: [id])

  @@unique([academicYearId, departmentId, year, semester, sectionId, subjectId])
}
```

---

## 3. Faculty Portal: Course Files Management Workspace

We will add a new tab **"Course Files"** in the Faculty dashboard:
1. **Subject Selection Grid**: Lists the faculty's mapped subjects and sections.
2. **Workspace Checklist**: Displays all 23 items. Items will have indicators:
   - 🟢 **Auto-Generated** (e.g. Syllabus, Student List, Marks, Timetable) — Ready to view.
   - 🟡 **Requires Input / Action** (e.g. Upload Scheme of Evaluation, Add Lecture Plan, Upload Previous Papers).
3. **Interactive Sections**:
   - **Lecture Plan Editor**: Tabular interface to input topics, periods, dates, and teaching aids.
   - **Assignment & Remedial Log Manager**: Quick forms to type assignment questions and record remedial session details.
   - **File Upload Area**: Drag-and-drop widget for Academic Calendar, MID schemes, and Previous Papers.
4. **"Generate Course File" Action**: Opens a dedicated print-ready HTML page containing the institutional headers, showing all 23 sections styled perfectly, ready for printing or saving as PDF via browser print (`Ctrl + P`).

---

## 4. Admin / HOD Portal: Course Files Monitor

We will add a **"Course Files"** tab in the Admin and HOD dashboards:
1. **Global Dashboard**: Select Academic Year, Department, Semester, and Section.
2. **Submission Progress Tracker**: Lists all mapped subjects, assigned faculty names, status (e.g., *Draft*, *Completed*, or *Submitted*), and percentage of checklist items completed.
3. **Verification & Download Page**: Allows HOD/Admin to open any course file checklist, verify the content entered by the faculty, and download the compiled course file print-ready HTML/PDF directly.

---

## 5. Verification Plan

### Automated / Manual Tests
1. **Model creation**: Verify schema push compiles with no data loss.
2. **Form Entry**: Faculty enters academic calendar, assignments, and support materials. Verify successful auto-saving in the DB.
3. **Slow Learners Computation**: Validate students scoring `< 40%` in Mid-I are listed. Validate that students scoring `< 40%` in Mid-I but `>= 40%` in Mid-II are listed under "Slow Learners Progress Status".
4. **Print Generation**: Check that the generated HTML print page prints beautifully with margins and headers.
