# Question Paper Cloning Across Different Subjects/Codes

Sometimes, the same subject content is taught across different branches/sections with different subject codes (e.g., English for Mechanical vs. English for Civil). Under the current design, faculty members cannot clone question papers between these different subject codes because the UI limits cloning to papers matching the exact same `subjectId`.

Here are the options and details for how this can be implemented in the system.

---

## Option A: Loosen the UI Restriction to "Any Subject" (Recommended)
This is the simplest and most flexible option. The backend database and API endpoints are already fully capable of copying questions between different subjects, so we only need to adjust the frontend UI filters.

### Implementation Details:
1. **File to Modify**: `src/app/faculty/mid-exam/page.tsx`
2. **Current Filter**:
   ```typescript
   const selectedMapping = mappings.find(m => m.id === createForm.mappingId);
   const eligibleClonePapers = selectedMapping
     ? papers.filter(p => p.subjectId === selectedMapping.subject.id && p.examType === createForm.examType && p.sectionId !== selectedMapping.section.id)
     : [];
   ```
3. **New Filter**:
   ```typescript
   const selectedMapping = mappings.find(m => m.id === createForm.mappingId);
   const eligibleClonePapers = selectedMapping
     ? papers.filter(p => p.examType === createForm.examType && p.id !== selectedMapping.id)
     : [];
   ```
4. **Dropdown Label Update**:
   Update the option label in the select element to display the subject name and code so the faculty member can easily identify their target paper:
   ```html
   <option key={p.id} value={p.id}>
     Copy from {p.subject?.name} ({p.subject?.code}) - Sec {p.section?.name}
   </option>
   ```

---

## Option B: Name-Matching Filter
Limit the cloning choices to subjects that have the exact same name but different subject codes.

### Implementation Details:
1. **File to Modify**: `src/app/faculty/mid-exam/page.tsx`
2. **New Filter**:
   ```typescript
   const selectedMapping = mappings.find(m => m.id === createForm.mappingId);
   const eligibleClonePapers = selectedMapping
     ? papers.filter(p => p.subject?.name === selectedMapping.subject.name && p.examType === createForm.examType && p.id !== selectedMapping.id)
     : [];
   ```

---

## What to Ask Later for Implementation:
To have this feature implemented, you can ask:
> *"Please apply Option A from `scratch/cloning_question_paper.md` to allow faculty to clone question papers across different subject codes."*
