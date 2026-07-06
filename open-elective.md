# Open Elective Integration and Cross-Departmental Attendance Design Plan

This document outlines the proposed technical implementation to support:
1. **Excel import of elective student mappings** from `department_wise_selections.xlsx`.
2. **Subject-wise marks entry filtering** to show only students enrolled in the specific elective subject.
3. **Cross-departmental attendance posting and reports** for mixed classes of students from multiple departments/sections.

---

## 1. Importing Elective Selections via Excel

We will modify the **Manage Elective Slots** page to include an Excel file uploader. When an administrator uploads `department_wise_selections.xlsx`, the system will:
1. Parse the sheets for each department (`CIVIL`, `CSE`, `CSM`, `ECE`, `MECHANICAL`).
2. Read columns: `Roll Number`, `Year`, `Elective Category`, `Subject Code`, `Subject Name`, `Offering Department`.
3. Post the parsed JSON array to `/api/elective-slots/import`.
4. In the backend handler:
   - Resolve the correct `ElectiveSlot` based on the category (e.g. `"OPEN ELECTIVE III"` $\rightarrow$ `OE-3`).
   - Find the student by roll number.
   - If the subject does not exist in the database, automatically create it under the offering department and link it to the correct `ElectiveSlot`.
   - Update the student's subjects relationship: disconnect them from any existing subject in that same slot and connect them to the new subject.

---

## 2. Subject-Wise Marks Entry Filtering

We will update the grading APIs (`/api/mid-exam/marks/route.ts`, `/api/mid-exam/assignment/route.ts`, `/api/mid-exam/lab/route.ts`):
* Check if the subject is an elective.
* If it is an elective subject, filter the students using a `subjects: { some: { id: subjectId } }` condition rather than fetching the entire class section.
* Non-elective (core) subjects will continue to display the entire section.
* General results and internal marks sheets will continue to consolidate marks for all options under a single column for the slot (e.g., `OE-3`) to keep it simple and clean.

---

## 3. Cross-Departmental Attendance posting and Reporting

Since Open Electives comprise students from various departments and sections:
1. **Student Fetching (GET `/api/students`)**:
   - If a `subjectId` is provided and the subject is an elective, bypass native `departmentId` and `sectionId` filters.
   - Query all students mapped to that elective: `subjects: { some: { id: subjectId } }`.
2. **Attendance Posting (POST `/api/attendance`)**:
   - Bypass native department-strict checks if the subject is an elective.
   - Validate and group students by their native sections, then record their attendance logs.
3. **Student Stats (GET `/api/students/[id]/stats`)**:
   - Modify the student's subject retrieval logic to fetch core subjects plus any elective subjects they are explicitly enrolled in (even if offered by another department).
   - Change the `AttendanceHistory` query to retrieve records using `details: { contains: student.rollNumber }` instead of strict `sectionId`/`departmentId` filters.
4. **Consolidated Reports (GET `/api/reports/consolidated`)**:
   - Fetch all subjects for the section (including electives where students are mapped).
   - Query `AttendanceHistory` records matching `subjectId: { in: subjectIds }`.
