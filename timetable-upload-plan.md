# Timetable Bulk Upload and Cell Locking Implementation Plan

This document outlines the design and technical specification for implementing bulk timetable imports via Excel. It supports cell protection, parallel theory subjects, lab batch splits, and elective slots.

---

## 1. Excel Template Structure & Sheet Protection

The template will be dynamically generated based on the selected filters (Department, Year, Semester, and Section).

* **Header & Metadata**: Contains selected Department, Year, Semester, and Section (locked cells).
* **Timetable Grid**:
  * **Rows**: Days of the week (Monday to Saturday) (locked cells).
  * **Columns**: Active Periods (e.g., `09:00 - 09:50 / P1`) dynamically fetched from the database (locked cells).
  * **Grid Cells**: The editable slots where users enter subjects (unlocked cells).
* **Reference Legend & Rules (Rows below the grid)**:
  * Contains rules explaining formatting for parallel classes, lab batches, and empty slots (locked cells).
  * Lists valid Subject Codes/Short Names for the selected semester group as a reference guide.

### Cell Locking Logic (Sheet Protection)
To restrict edits to the timetable grid cells only:
1. All instruction, header, and legend cells are kept with the default `locked: true` property.
2. The timetable grid cells (intersections of days and periods) are marked with `locked: false` (unlocked) cell style formatting.
3. Sheet protection is activated in the sheet workbook:
   ```typescript
   worksheet['!protect'] = {
       password: 'sms-timetable-protect',
       selectLockedCells: false,          // Disallow selecting read-only cells
       selectUnlockedCells: true          // Allow selecting and editing active grid cells
   };
   ```

---

## 2. Formatting Rules for Complex Schedules

The bulk importer will parse cell values using these patterns:

* **Regular Subjects**: Enter the subject short name or code (e.g., `DBMS`, `OS`, `FLAT`).
* **Empty/Free Periods**: Leave the cell blank or write `Empty`.
* **Lunch Breaks**: Write `LUNCH` (marks the block with `isLunch: true`).
* **Parallel Classes (Section Splits)**: Use the pipe (`|`) separator to run multiple subjects at the same time:
  * *Example*: `Cloud Computing | Cryptography` (generates two parallel theory entries).
* **Lab Batches**: Specify the batch name in parentheses next to the lab subject:
  * *Example*: `Computer Networks Lab (Batch-1) | Database Lab (Batch-2)` (maps the respective labs to Batch-1 and Batch-2 in the same period).
* **Open Electives**: Write the category code (e.g., `OE-3`) to map the period to the elective slot.

---

## 3. Backend Architecture

Two new API endpoints will be created under `src/app/api/timetables/bulk/`:

### A. Template Downloader (GET `/api/api/timetables/bulk/template`)
* Queries all active `Period` records sorted by order.
* Queries all `Subject` records belonging to the selected `departmentId`, `year`, and `semester`.
* Generates the Excel workbook using the `xlsx` library with locked/unlocked attributes and cell styling.
* Sets headers to download as `Timetable_Template_[SectionName].xlsx`.

### B. Bulk Importer (POST `/api/timetables/bulk/upload`)
* Reads the uploaded workbook file.
* Iterates through the grid rows (days) and columns (periods).
* For each cell, splits the string using the `|` separator.
* Resolves each token:
  * Looks up the corresponding `Subject` by name/code (case-insensitive).
  * Looks up `LabBatch` if parentheses are present.
  * Validates that all entered names are correct. If any name is invalid, returns a clean error detailing the cell (e.g., *"Row 3 (Wednesday), Period P2 has invalid subject 'XYZ'"*).
* **Database Write**: Runs a Prisma transaction:
  1. Marks all current active timetable entries for that section as outdated (`validTo: now`).
  2. Inserts all the new parsed entries with `validFrom: now` and `validTo: null`.

---

## 4. Frontend UI Integration (`src/app/timetables/page.tsx`)

* Add a **"Download Excel Template"** button next to the **"Load Timetable"** button. This button will be enabled once the user selects all filters (Department, Year, Semester, Section).
* Add an **"Upload Timetable Excel"** button/drag-and-drop zone inside the timetable toolbar that appears once the timetable grid is loaded.
* Display success/error toasts indicating validation results or upload status.
