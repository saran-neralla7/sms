"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBook, FaCalendarAlt, FaFileAlt, FaSpinner, FaUpload, FaTrash, FaCheckCircle,
  FaArrowLeft, FaExclamationTriangle, FaPlus, FaSave, FaListOl, FaGraduationCap,
  FaTimes
} from "react-icons/fa";
import Link from "next/link";
import LogoSpinner from "@/components/LogoSpinner";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";

interface Mapping {
  id: string;
  subject: { id: string; name: string; code: string; type: string; year: string; semester: string; departmentId: string };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
}

export default function FacultyCourseFilesPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; isCurrent: boolean }[]>([]);
  const [selectedAY, setSelectedAY] = useState("");
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<Mapping | null>(null);

  // Course file specific state
  const [cfData, setCfData] = useState<any>(null);
  const [fetchingCf, setFetchingCf] = useState(false);

  // Forms inputs
  const [teachingSupportText, setTeachingSupportText] = useState("");
  const [lecturePlan, setLecturePlan] = useState<{ unit: string; topic: string; plannedPeriods: number; actualDate: string; aid: string }[]>([]);
  const [assignmentQuestions, setAssignmentQuestions] = useState<{ unit: string; questions: string[] }[]>([
    { unit: "Unit I", questions: ["", ""] },
    { unit: "Unit II", questions: ["", ""] },
    { unit: "Unit III", questions: ["", ""] },
    { unit: "Unit IV", questions: ["", ""] },
    { unit: "Unit V", questions: ["", ""] }
  ]);
  const [remedialClasses, setRemedialClasses] = useState<{ date: string; topics: string; studentRolls: string[] }[]>([]);

  // Files paths
  const [academicCalendarPath, setAcademicCalendarPath] = useState("");
  const [mid1SchemePath, setMid1SchemePath] = useState("");
  const [mid2SchemePath, setMid2SchemePath] = useState("");
  const [prevPapersPaths, setPrevPapersPaths] = useState<string[]>([]);

  // Slow learners threshold
  const [thresholdType, setThresholdType] = useState<"40" | "50" | "custom">("40");
  const [customThreshold, setCustomThreshold] = useState<number>(40);

  const [showSlowLearnersModal, setShowSlowLearnersModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Active section inside the checklist for input editing
  const [activeFormTab, setActiveFormTab] = useState<"lecture" | "assignments" | "remedial" | "support" | "uploads">("lecture");

  // Loading indicator for file uploads
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch initial Academic Years
  useEffect(() => {
    fetch("/api/academic-years")
      .then(res => res.json())
      .then(data => {
        setAcademicYears(data);
        const current = data.find((ay: any) => ay.isCurrent);
        if (current) setSelectedAY(current.id);
        else if (data.length > 0) setSelectedAY(data[0].id);
      })
      .catch(err => {
        console.error("Error fetching academic years:", err);
        showToast("Failed to load academic years", "error");
      });
  }, []);

  // Fetch mappings when Academic Year changes
  useEffect(() => {
    if (!selectedAY) return;
    setLoading(true);
    fetch(`/api/faculty-mappings?academicYearId=${selectedAY}`)
      .then(res => res.json())
      .then(data => {
        setMappings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching mappings:", err);
        showToast("Failed to load subject mappings", "error");
        setLoading(false);
      });
  }, [selectedAY]);

  // Load Course File details once a subject-section mapping is selected
  const selectSubjectMapping = async (mapping: Mapping) => {
    setSelectedMapping(mapping);
    setFetchingCf(true);
    try {
      const res = await fetch(
        `/api/course-files?academicYearId=${mapping.academicYear.id}&departmentId=${mapping.subject.departmentId}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&sectionId=${mapping.section.id}&subjectId=${mapping.subject.id}`
      );
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setCfData(data);

      const cf = data.courseFile;
      if (cf) {
        setTeachingSupportText(cf.teachingSupportText || "");
        setLecturePlan(cf.lecturePlan || []);
        if (cf.assignmentQuestions && Array.isArray(cf.assignmentQuestions)) {
          setAssignmentQuestions(cf.assignmentQuestions);
        } else {
          setAssignmentQuestions([
            { unit: "Unit I", questions: ["", ""] },
            { unit: "Unit II", questions: ["", ""] },
            { unit: "Unit III", questions: ["", ""] },
            { unit: "Unit IV", questions: ["", ""] },
            { unit: "Unit V", questions: ["", ""] }
          ]);
        }
        setRemedialClasses(cf.remedialClasses || []);
        setAcademicCalendarPath(cf.academicCalendarPath || "");
        setMid1SchemePath(cf.mid1SchemePath || "");
        setMid2SchemePath(cf.mid2SchemePath || "");
        setPrevPapersPaths(cf.prevPapersPaths || []);
      } else {
        // Reset inputs
        setTeachingSupportText("");
        setLecturePlan([]);
        setAssignmentQuestions([
          { unit: "Unit I", questions: ["", ""] },
          { unit: "Unit II", questions: ["", ""] },
          { unit: "Unit III", questions: ["", ""] },
          { unit: "Unit IV", questions: ["", ""] },
          { unit: "Unit V", questions: ["", ""] }
        ]);
        setRemedialClasses([]);
        setAcademicCalendarPath("");
        setMid1SchemePath("");
        setMid2SchemePath("");
        setPrevPapersPaths([]);
      }
    } catch (err: any) {
      console.error(err);
      showToast("Error loading course file details: " + err.message, "error");
    } finally {
      setFetchingCf(false);
    }
  };

  // Handle Save
  const handleSave = async () => {
    if (!selectedMapping) return;
    setSaving(true);
    try {
      const res = await fetch("/api/course-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedMapping.academicYear.id,
          departmentId: selectedMapping.subject.departmentId,
          year: selectedMapping.subject.year,
          semester: selectedMapping.subject.semester,
          sectionId: selectedMapping.section.id,
          subjectId: selectedMapping.subject.id,
          facultyId: (session?.user as any)?.facultyId || (session?.user as any)?.id || "system",
          teachingSupportText,
          assignmentQuestions,
          lecturePlan,
          remedialClasses,
          academicCalendarPath,
          mid1SchemePath,
          mid2SchemePath,
          prevPapersPaths
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      showToast("Course file saved successfully!", "success");
      // Reload details to keep state in sync
      selectSubjectMapping(selectedMapping);
    } catch (err: any) {
      showToast(err.message || "Failed to save course file", "error");
    } finally {
      setSaving(false);
    }
  };

  // Upload file API handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "calendar" | "mid1" | "mid2" | "prev") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verify it is a PDF
    if (file.type !== "application/pdf") {
      showToast("Please upload PDF files only.", "error");
      return;
    }

    setUploadingFile(target);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/course-files/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (target === "calendar") setAcademicCalendarPath(data.url);
      else if (target === "mid1") setMid1SchemePath(data.url);
      else if (target === "mid2") setMid2SchemePath(data.url);
      else if (target === "prev") setPrevPapersPaths([...prevPapersPaths, data.url]);

      showToast(`${file.name} uploaded successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploadingFile(null);
      e.target.value = ""; // clear file input
    }
  };

  if (status === "loading" || loading) {
    return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  }

  // Active threshold value
  const activeThreshold = thresholdType === "custom" ? customThreshold : parseInt(thresholdType);

  // Calculate slow learners list and progress
  const getSlowLearnersData = () => {
    if (!cfData || !cfData.students) {
      return { slowLearners: [], progressStudents: [] };
    }

    const students = cfData.students || [];
    const mid1Paper = cfData.mid1Paper;
    const mid2Paper = cfData.mid2Paper;
    const mid1Marks = cfData.mid1Marks || [];
    const mid2Marks = cfData.mid2Marks || [];

    const mid1MarksMap: Record<string, number> = {};
    const mid1AbsentMap: Record<string, boolean> = {};
    const mid2MarksMap: Record<string, number> = {};
    const smid2AbsentMap: Record<string, boolean> = {};

    if (mid1Paper) {
      const choiceGroups1 = mid1Paper.choiceGroups || [];
      const questions1 = (mid1Paper.questions || []).map((q: any) => ({
        ...q,
        subQuestions: q.subQuestions || [],
      }));

      for (const student of students) {
        const studentEntries = mid1Marks.filter((m: any) => m.studentId === student.id);
        const isAbs = studentEntries.some((m: any) => m.isAbsent);
        const entryMap: Record<string, number | null> = {};
        for (const e of studentEntries) {
          entryMap[e.subQuestionId] = e.marksObtained;
        }
        const { total } = calculateStudentTotal(questions1, choiceGroups1, entryMap, isAbs);
        mid1MarksMap[student.id] = total;
        mid1AbsentMap[student.id] = isAbs;
      }
    }

    if (mid2Paper) {
      const choiceGroups2 = mid2Paper.choiceGroups || [];
      const questions2 = (mid2Paper.questions || []).map((q: any) => ({
        ...q,
        subQuestions: q.subQuestions || [],
      }));

      for (const student of students) {
        const studentEntries = mid2Marks.filter((m: any) => m.studentId === student.id);
        const isAbs = studentEntries.some((m: any) => m.isAbsent);
        const entryMap: Record<string, number | null> = {};
        for (const e of studentEntries) {
          entryMap[e.subQuestionId] = e.marksObtained;
        }
        const { total } = calculateStudentTotal(questions2, choiceGroups2, entryMap, isAbs);
        mid2MarksMap[student.id] = total;
        smid2AbsentMap[student.id] = isAbs;
      }
    }

    const maxMarks1 = mid1Paper?.totalMarks || 30;
    const maxMarks2 = mid2Paper?.totalMarks || 30;

    const slowLearners = students.map((student: any) => {
      const isAbs = mid1AbsentMap[student.id];
      const score = mid1MarksMap[student.id] || 0;
      const pct = isAbs ? 0 : Math.round((score / maxMarks1) * 100);
      return {
        ...student,
        score,
        pct,
        isAbsent: isAbs
      };
    }).filter((student: any) => {
      if (student.isAbsent) return false;
      return student.pct < activeThreshold;
    });

    const progressStudents = students.map((student: any) => {
      const isAbs1 = mid1AbsentMap[student.id];
      const score1 = mid1MarksMap[student.id] || 0;
      const pct1 = isAbs1 ? 0 : Math.round((score1 / maxMarks1) * 100);
      const wasSlow = !isAbs1 && pct1 < activeThreshold;

      const isAbs2 = smid2AbsentMap[student.id];
      const score2 = mid2MarksMap[student.id] || 0;
      const pct2 = isAbs2 ? 0 : Math.round((score2 / maxMarks2) * 100);
      const improved = !isAbs2 && pct2 >= activeThreshold;

      return {
        ...student,
        score1,
        pct1,
        isAbsent1: isAbs1,
        wasSlow,
        score2,
        pct2,
        isAbsent2: isAbs2,
        improved
      };
    }).filter((student: any) => {
      return student.wasSlow && student.improved;
    });

    return { slowLearners, progressStudents };
  };

  const { slowLearners, progressStudents } = getSlowLearnersData();

  // Helper to detect missing/pending items
  const getPendingItems = () => {
    const pending: string[] = [];
    if (selectedMapping && cfData) {
      if (!cfData.subject?.syllabus) pending.push("Syllabus details");
      if (!cfData.subject?.syllabus?.objectives) pending.push("Course Objectives & Outcomes");
      if (!cfData.coPoMappings?.length) pending.push("CO-PO Mappings");
      if (!academicCalendarPath) pending.push("Academic Calendar Upload");
      if (!lecturePlan.length) pending.push("Lecture Plan entries");
      if (!cfData.students?.length) pending.push("Registered Student Roster");
      if (!cfData.timetable?.length) pending.push("Faculty Timetable mapping");
      if (teachingSupportText.trim().length <= 10) pending.push("Teaching Support Material details");
      if (!assignmentQuestions.some(q => q.questions.some(qn => qn.trim().length > 2))) pending.push("Assignment Questions");
      if (!cfData.mid1Paper) pending.push("I Mid Exam Question Paper");
      if (!mid1SchemePath) pending.push("I Mid Exam Scheme of Evaluation");
      if (!cfData.mid1Marks?.length) pending.push("I Mid Exam Marks List");
      if (!remedialClasses.length) pending.push("Remedial Classes & Logs");
      if (!cfData.mid2Paper) pending.push("II Mid Exam Question Paper");
      if (!mid2SchemePath) pending.push("II Mid Exam Scheme of Evaluation");
      if (!cfData.mid2Marks?.length) pending.push("II Mid Exam Marks List");
      if (!cfData.internalMarks?.length) pending.push("Final Sessional Marks (OBE)");
      if (!prevPapersPaths.length) pending.push("Previous Semester Question Papers");
      if (!cfData.semesterResults?.length) pending.push("Semester End Results data");
    }
    return pending;
  };

  const handlePrintClick = () => {
    if (!selectedMapping) return;
    const pending = getPendingItems();
    if (pending.length > 0) {
      setShowPendingModal(true);
    } else {
      const printUrl = `/faculty/course-files/print?academicYearId=${selectedMapping.academicYear.id}&departmentId=${selectedMapping.subject.departmentId}&year=${selectedMapping.subject.year}&semester=${selectedMapping.subject.semester}&sectionId=${selectedMapping.section.id}&subjectId=${selectedMapping.subject.id}&threshold=${activeThreshold}`;
      window.open(printUrl, "_blank");
    }
  };

  const handleForcePrint = () => {
    if (!selectedMapping) return;
    setShowPendingModal(false);
    const printUrl = `/faculty/course-files/print?academicYearId=${selectedMapping.academicYear.id}&departmentId=${selectedMapping.subject.departmentId}&year=${selectedMapping.subject.year}&semester=${selectedMapping.subject.semester}&sectionId=${selectedMapping.section.id}&subjectId=${selectedMapping.subject.id}&threshold=${activeThreshold}`;
    window.open(printUrl, "_blank");
  };

  // Dynamic counts for completion status
  const totalItems = 23;
  let completedCount = 0;

  if (selectedMapping && cfData) {
    // 1. Syllabus - Auto (always complete if subject exists)
    if (cfData.subject?.syllabus) completedCount++;
    // 2. Objectives - Auto
    if (cfData.subject?.syllabus?.objectives) completedCount++;
    // 3. CO-PO - Auto
    if (cfData.coPoMappings?.length > 0) completedCount++;
    // 4. Academic Calendar - Manual Upload
    if (academicCalendarPath) completedCount++;
    // 5. Lecture Plan & Text Books - Auto (Text books) & Manual (Lecture plan has rows)
    if (lecturePlan.length > 0) completedCount++;
    // 6. Student List - Auto
    if (cfData.students?.length > 0) completedCount++;
    // 7. Timetable - Auto
    if (cfData.timetable?.length > 0) completedCount++;
    // 8. Teaching support - Manual
    if (teachingSupportText.trim().length > 10) completedCount++;
    // 9. Assignments - Manual
    if (assignmentQuestions.some(q => q.questions.some(qn => qn.trim().length > 2))) completedCount++;
    // 10. Mid 1 paper - Auto
    if (cfData.mid1Paper) completedCount++;
    // 11. Mid 1 scheme - Manual
    if (mid1SchemePath) completedCount++;
    // 12. Mid 1 marks - Auto
    if (cfData.mid1Marks?.length > 0) completedCount++;
    // 13. Slow learners - Auto
    completedCount++; // Dynamic calculation
    // 14. Remedial classes - Manual
    if (remedialClasses.length > 0) completedCount++;
    // 15. Mid 2 paper - Auto
    if (cfData.mid2Paper) completedCount++;
    // 16. Mid 2 scheme - Manual
    if (mid2SchemePath) completedCount++;
    // 17. Mid 2 marks - Auto
    if (cfData.mid2Marks?.length > 0) completedCount++;
    // 18. Slow learners progress - Auto
    completedCount++; // Dynamic calculation
    // 19. Mid marks CO mapping - Auto
    if (cfData.mid1Paper || cfData.mid2Paper) completedCount++;
    // 20. Sessional marks - Auto
    if (cfData.internalMarks?.length > 0) completedCount++;
    // 21. Previous papers - Manual
    if (prevPapersPaths.length > 0) completedCount++;
    // 22. Semester Results - Auto
    if (cfData.semesterResults?.length > 0) completedCount++;
    // 23. CO PO Attainment - Auto
    completedCount++; // Dynamic calculation
  }

  const completionPct = Math.round((completedCount / totalItems) * 100);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Toast alerts */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-white ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
            >
              <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
              <span className="font-medium text-sm">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back navigation header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedMapping ? (
              <button
                onClick={() => {
                  setSelectedMapping(null);
                  setCfData(null);
                }}
                className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FaArrowLeft className="h-4.5 w-4.5" /> Back to Subjects
              </button>
            ) : (
              <Link
                href="/faculty"
                className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FaArrowLeft className="h-4.5 w-4.5" /> Gateway
              </Link>
            )}
            <h1 className="text-2xl font-bold text-slate-800">Subject Course Files</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Academic Year:</span>
            <select
              value={selectedAY}
              onChange={(e) => setSelectedAY(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              disabled={!!selectedMapping}
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject selector Grid */}
        {!selectedMapping ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mappings.length === 0 ? (
              <div className="col-span-full rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500 font-medium">
                No subjects assigned to you for the selected Academic Year.
              </div>
            ) : (
              mappings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => selectSubjectMapping(m)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden hover:border-teal-400"
                >
                  <div className="absolute top-0 right-0 h-16 w-16 bg-teal-50/50 rounded-bl-full flex items-center justify-center group-hover:bg-teal-50 transition-colors">
                    <FaBook className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 mb-4">
                      {m.subject.code}
                    </span>
                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-teal-700 transition-colors pr-8">
                      {m.subject.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2 font-medium">
                      Section {m.section.name} • Year {m.subject.year}, Sem {m.subject.semester}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-medium text-slate-400">
                      Click to manage Course File
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-teal-600">
                      Open Workspace →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* WORKSPACE VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Progress & Checklist */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-bold text-slate-800 text-lg">{selectedMapping.subject.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Section {selectedMapping.section.name} ({selectedMapping.subject.code})
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1">
                    Faculty Workspace
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between items-center text-sm font-semibold mb-2">
                    <span className="text-slate-600">Course File Checklist</span>
                    <span className="text-teal-600">{completedCount} / {totalItems} ({completionPct}%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Generate / Print trigger */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handlePrintClick}
                    className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 text-sm transition-colors shadow-sm cursor-pointer"
                  >
                    <FaFileAlt className="h-4 w-4" /> View Print Booklet
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-sm transition-colors shadow-sm disabled:opacity-60"
                  >
                    {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>

                {/* Slow Learners Configuration */}
                <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                  <div className="flex items-center gap-2 text-orange-800 font-bold text-sm mb-3">
                    <FaGraduationCap className="h-4.5 w-4.5" />
                    Slow Learners Calculator Settings
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Pass Threshold</label>
                      <select
                        value={thresholdType}
                        onChange={(e) => setThresholdType(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      >
                        <option value="40">Below 40%</option>
                        <option value="50">Below 50%</option>
                        <option value="custom">Custom Score</option>
                      </select>
                    </div>
                    {thresholdType === "custom" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Percentage (1-100)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={customThreshold}
                          onChange={(e) => setCustomThreshold(Math.max(1, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Checklist details list */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm max-h-[500px] overflow-y-auto">
                <h3 className="font-bold text-slate-800 text-sm mb-3 px-2 flex justify-between items-center">
                  <span>Checklist Index</span>
                  <span className="text-xs text-slate-400 font-medium">Auto = System Generated</span>
                </h3>
                <ul className="divide-y divide-slate-100 text-xs">
                  {/* 1 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">1. Syllabus</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 2 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">2. Course Objectives & Outcomes</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 3 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">3. CO-PO / PSO Mapping Table</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 4 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">4. Academic Calendar</span>
                    {academicCalendarPath ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Upload</span>
                    )}
                  </li>
                  {/* 5 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">5. Lecture Plan & Text Books</span>
                    {lecturePlan.length > 0 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Completed</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Table</span>
                    )}
                  </li>
                  {/* 6 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">6. Student Roster Ranks</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 7 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">7. Mapped Class Timetable</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 8 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">8. Teaching Support Materials</span>
                    {teachingSupportText.trim().length > 10 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Completed</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Text</span>
                    )}
                  </li>
                  {/* 9 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">9. Assignment Questions (I-V)</span>
                    {assignmentQuestions.some(q => q.questions.some(qn => qn.trim().length > 2)) ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Completed</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Items</span>
                    )}
                  </li>
                  {/* 10 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">10. I Mid Question Paper</span>
                    {cfData?.mid1Paper ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">🛑 Paper Not Built</span>
                    )}
                  </li>
                  {/* 11 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">11. I Mid Scheme of Evaluation</span>
                    {mid1SchemePath ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Upload</span>
                    )}
                  </li>
                  {/* 12 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">12. I Mid Exam Marks List</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 13 */}
                  <li className="flex flex-col gap-1.5 py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-slate-600 font-medium">13. Dynamic Slow Learners List</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSlowLearnersModal(true)}
                          className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2 py-0.5 rounded font-semibold transition-colors"
                        >
                          View List
                        </button>
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 Auto Calculated</span>
                      </div>
                    </div>
                  </li>
                  {/* 14 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">14. Remedial Classes & Logs</span>
                    {remedialClasses.length > 0 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Logs Added</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Log</span>
                    )}
                  </li>
                  {/* 15 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">15. II Mid Question Paper</span>
                    {cfData?.mid2Paper ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">🛑 Paper Not Built</span>
                    )}
                  </li>
                  {/* 16 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">16. II Mid Scheme of Evaluation</span>
                    {mid2SchemePath ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Upload</span>
                    )}
                  </li>
                  {/* 17 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">17. II Mid Exam Marks List</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 18 */}
                  <li className="flex flex-col gap-1.5 py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-slate-600 font-medium">18. Slow Learners Progress Status</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowProgressModal(true)}
                          className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2 py-0.5 rounded font-semibold transition-colors"
                        >
                          View List
                        </button>
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 Auto Calculated</span>
                      </div>
                    </div>
                  </li>
                  {/* 19 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">19. Mid Marks mappings with COs</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 20 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">20. Final Sessional Marks (OBE)</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 21 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">21. Previous Question Papers</span>
                    {prevPapersPaths.length > 0 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ {prevPapersPaths.length} Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Upload</span>
                    )}
                  </li>
                  {/* 22 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">22. Semester-End Results Summary</span>
                    {cfData?.semesterResults?.length > 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">🛑 Grades Not Posted</span>
                    )}
                  </li>
                  {/* 23 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">23. CO PO Attainment Attained Level</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 Auto Calculated</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Dynamic Form Editors */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {fetchingCf ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm flex flex-col justify-center items-center gap-4">
                  <FaSpinner className="h-8 w-8 text-teal-600 animate-spin" />
                  <p className="text-slate-500 font-semibold text-sm">Fetching workspace details from DB...</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Tabs header */}
                  <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <button
                      onClick={() => setActiveFormTab("lecture")}
                      className={`flex-1 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "lecture" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      Lecture Plan
                    </button>
                    <button
                      onClick={() => setActiveFormTab("assignments")}
                      className={`flex-1 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "assignments" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      Assignments
                    </button>
                    <button
                      onClick={() => setActiveFormTab("remedial")}
                      className={`flex-1 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "remedial" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      Remedial Logs
                    </button>
                    <button
                      onClick={() => setActiveFormTab("support")}
                      className={`flex-1 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "support" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      Support Materials
                    </button>
                    <button
                      onClick={() => setActiveFormTab("uploads")}
                      className={`flex-1 py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "uploads" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                    >
                      File Uploads
                    </button>
                  </div>

                  {/* Tab Contents */}
                  <div className="p-6">
                    {/* 1. LECTURE PLAN */}
                    {activeFormTab === "lecture" && (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-slate-800 text-md">Unit-wise Lecture Plan Periods</h4>
                          <button
                            onClick={() => setLecturePlan([...lecturePlan, { unit: "Unit I", topic: "", plannedPeriods: 1, actualDate: "", aid: "Chalk & Board" }])}
                            className="flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors"
                          >
                            <FaPlus className="h-3 w-3" /> Add Topic Row
                          </button>
                        </div>

                        {lecturePlan.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                            No lecture topics entered yet. Click "Add Topic Row" to begin.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-left text-slate-600 border border-slate-200 rounded-xl">
                              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold">
                                <tr>
                                  <th className="px-3 py-2 border-b">Unit</th>
                                  <th className="px-3 py-2 border-b">Topic / Details</th>
                                  <th className="px-3 py-2 border-b">Periods</th>
                                  <th className="px-3 py-2 border-b">Actual Date</th>
                                  <th className="px-3 py-2 border-b">Teaching Aid</th>
                                  <th className="px-3 py-2 border-b text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lecturePlan.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-1.5 border-b">
                                      <select
                                        value={row.unit}
                                        onChange={(e) => {
                                          const copy = [...lecturePlan];
                                          copy[idx].unit = e.target.value;
                                          setLecturePlan(copy);
                                        }}
                                        className="rounded border border-slate-300 p-1"
                                      >
                                        <option value="Unit I">Unit I</option>
                                        <option value="Unit II">Unit II</option>
                                        <option value="Unit III">Unit III</option>
                                        <option value="Unit IV">Unit IV</option>
                                        <option value="Unit V">Unit V</option>
                                      </select>
                                    </td>
                                    <td className="px-3 py-1.5 border-b">
                                      <input
                                        type="text"
                                        value={row.topic}
                                        onChange={(e) => {
                                          const copy = [...lecturePlan];
                                          copy[idx].topic = e.target.value;
                                          setLecturePlan(copy);
                                        }}
                                        className="w-full rounded border border-slate-300 p-1 font-medium"
                                        placeholder="Topic details..."
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 border-b">
                                      <input
                                        type="number"
                                        min="1"
                                        value={row.plannedPeriods}
                                        onChange={(e) => {
                                          const copy = [...lecturePlan];
                                          copy[idx].plannedPeriods = parseInt(e.target.value) || 1;
                                          setLecturePlan(copy);
                                        }}
                                        className="w-16 rounded border border-slate-300 p-1 text-center"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 border-b">
                                      <input
                                        type="date"
                                        value={row.actualDate}
                                        onChange={(e) => {
                                          const copy = [...lecturePlan];
                                          copy[idx].actualDate = e.target.value;
                                          setLecturePlan(copy);
                                        }}
                                        className="rounded border border-slate-300 p-1"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 border-b">
                                      <select
                                        value={row.aid}
                                        onChange={(e) => {
                                          const copy = [...lecturePlan];
                                          copy[idx].aid = e.target.value;
                                          setLecturePlan(copy);
                                        }}
                                        className="rounded border border-slate-300 p-1"
                                      >
                                        <option value="Chalk & Board">Chalk & Board</option>
                                        <option value="PPT Projector">PPT Projector</option>
                                        <option value="Online Virtual Lab">Online Virtual Lab</option>
                                        <option value="Mixed (Board + Projector)">Mixed Mode</option>
                                      </select>
                                    </td>
                                    <td className="px-3 py-1.5 border-b text-center">
                                      <button
                                        onClick={() => {
                                          const copy = [...lecturePlan];
                                          copy.splice(idx, 1);
                                          setLecturePlan(copy);
                                        }}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <FaTrash className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. ASSIGNMENT QUESTIONS */}
                    {activeFormTab === "assignments" && (
                      <div className="flex flex-col gap-6">
                        <h4 className="font-bold text-slate-800 text-md">Unit-wise Assignment Questions (Item 9)</h4>
                        {assignmentQuestions.map((unitQ, unitIdx) => (
                          <div key={unitQ.unit} className="border border-slate-200 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="font-bold text-slate-700 text-sm">{unitQ.unit} Assignment</h5>
                              <button
                                onClick={() => {
                                  const copy = [...assignmentQuestions];
                                  copy[unitIdx].questions.push("");
                                  setAssignmentQuestions(copy);
                                }}
                                className="text-xs text-teal-600 font-semibold hover:underline"
                              >
                                + Add Question
                              </button>
                            </div>
                            <div className="flex flex-col gap-2">
                              {unitQ.questions.map((qText, qIdx) => (
                                <div key={qIdx} className="flex gap-2 items-center">
                                  <span className="text-slate-400 font-medium text-xs w-6">Q{qIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={qText}
                                    onChange={(e) => {
                                      const copy = [...assignmentQuestions];
                                      copy[unitIdx].questions[qIdx] = e.target.value;
                                      setAssignmentQuestions(copy);
                                    }}
                                    className="flex-grow rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                    placeholder="Enter assignment question content..."
                                  />
                                  <button
                                    onClick={() => {
                                      const copy = [...assignmentQuestions];
                                      copy[unitIdx].questions.splice(qIdx, 1);
                                      setAssignmentQuestions(copy);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <FaTrash className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3. REMEDIAL LOGS */}
                    {activeFormTab === "remedial" && (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-slate-800 text-md">Remedial Classes for Slow Learners (Item 14)</h4>
                          <button
                            onClick={() => setRemedialClasses([...remedialClasses, { date: "", topics: "", studentRolls: [] }])}
                            className="flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors"
                          >
                            <FaPlus className="h-3 w-3" /> Add Remedial Log
                          </button>
                        </div>

                        {remedialClasses.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                            No remedial logs recorded yet. Add logs to record topics and student attendance.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {remedialClasses.map((item, idx) => (
                              <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 relative">
                                <button
                                  onClick={() => {
                                    const copy = [...remedialClasses];
                                    copy.splice(idx, 1);
                                    setRemedialClasses(copy);
                                  }}
                                  className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                                >
                                  <FaTrash className="h-3.5 w-3.5" />
                                </button>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Date Conducted</label>
                                    <input
                                      type="date"
                                      value={item.date}
                                      onChange={(e) => {
                                        const copy = [...remedialClasses];
                                        copy[idx].date = e.target.value;
                                        setRemedialClasses(copy);
                                      }}
                                      className="rounded-lg border border-slate-300 p-2 text-xs w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Topics Discussed</label>
                                    <input
                                      type="text"
                                      value={item.topics}
                                      onChange={(e) => {
                                        const copy = [...remedialClasses];
                                        copy[idx].topics = e.target.value;
                                        setRemedialClasses(copy);
                                      }}
                                      className="rounded-lg border border-slate-300 p-2 text-xs w-full font-medium"
                                      placeholder="e.g. Solving Mid 1 numerical questions"
                                    />
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                                    Attending Student Roll Numbers (Comma Separated)
                                  </label>
                                  <input
                                    type="text"
                                    value={item.studentRolls.join(", ")}
                                    onChange={(e) => {
                                      const copy = [...remedialClasses];
                                      copy[idx].studentRolls = e.target.value.split(",").map(r => r.trim()).filter(Boolean);
                                      setRemedialClasses(copy);
                                    }}
                                    className="rounded-lg border border-slate-300 p-2 text-xs w-full font-medium"
                                    placeholder="e.g. 23811A0501, 23811A0503"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. SUPPORT MATERIALS */}
                    {activeFormTab === "support" && (
                      <div>
                        <h4 className="font-bold text-slate-800 text-md mb-4">Teaching Support Materials (Item 8)</h4>
                        <p className="text-xs text-slate-500 mb-3 font-medium">
                          Provide links (such as Google Drive, OneDrive) or descriptions of notes, slides, web links, or videos used.
                        </p>
                        <textarea
                          value={teachingSupportText}
                          onChange={(e) => setTeachingSupportText(e.target.value)}
                          className="w-full min-h-[250px] rounded-xl border border-slate-300 p-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Example:
- Unit 1 PowerPoint PDF: https://drive.google.com/open?id=xxxxxx
- Virtual Laboratory simulations link: https://vlab.co.in/
- Text book chapters PDF shared on MSTeams..."
                        />
                      </div>
                    )}

                    {/* 5. UPLOADS */}
                    {activeFormTab === "uploads" && (
                      <div className="flex flex-col gap-6">
                        <h4 className="font-bold text-slate-800 text-md">Document File Uploads (PDF format only)</h4>

                        {/* Item 4: Academic Calendar */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">Academic Calendar</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload the current semester calendar.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "calendar" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "calendar")}
                                  disabled={uploadingFile === "calendar"}
                                />
                              </label>
                            </div>
                          </div>
                          {academicCalendarPath && (
                            <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-slate-700 shadow-sm">
                              <span className="text-emerald-700 flex items-center gap-1.5">
                                <FaCheckCircle className="h-4 w-4" /> Calendar attached!
                              </span>
                              <button
                                onClick={() => setAcademicCalendarPath("")}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Item 11: MID-I Scheme */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">MID-I Scheme of Evaluation</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload the evaluation answer key blueprint.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "mid1" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "mid1")}
                                  disabled={uploadingFile === "mid1"}
                                />
                              </label>
                            </div>
                          </div>
                          {mid1SchemePath && (
                            <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-slate-700 shadow-sm">
                              <span className="text-emerald-700 flex items-center gap-1.5">
                                <FaCheckCircle className="h-4 w-4" /> MID-I Scheme attached!
                              </span>
                              <button
                                onClick={() => setMid1SchemePath("")}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Item 16: MID-II Scheme */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">MID-II Scheme of Evaluation</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload the evaluation answer key blueprint.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "mid2" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "mid2")}
                                  disabled={uploadingFile === "mid2"}
                                />
                              </label>
                            </div>
                          </div>
                          {mid2SchemePath && (
                            <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-slate-700 shadow-sm">
                              <span className="text-emerald-700 flex items-center gap-1.5">
                                <FaCheckCircle className="h-4 w-4" /> MID-II Scheme attached!
                              </span>
                              <button
                                onClick={() => setMid2SchemePath("")}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Item 21: Previous Question Papers */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">Previous Question Papers</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload past years' semester question papers.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "prev" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "prev")}
                                  disabled={uploadingFile === "prev"}
                                />
                              </label>
                            </div>
                          </div>
                          {prevPapersPaths.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                              {prevPapersPaths.map((p, pIdx) => (
                                <div key={pIdx} className="flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2 text-xs font-semibold text-slate-700 shadow-sm">
                                  <span className="text-blue-700">Question Paper #{pIdx + 1}</span>
                                  <button
                                    onClick={() => {
                                      const copy = [...prevPapersPaths];
                                      copy.splice(pIdx, 1);
                                      setPrevPapersPaths(copy);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <FaTrash className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slow Learners Modal */}
      <AnimatePresence>
        {showSlowLearnersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowSlowLearnersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <FaGraduationCap className="text-orange-500 h-5 w-5" />
                    Slow Learners List (Mid-I)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Students who scored below {activeThreshold}% in Mid-I exam.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSlowLearnersModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                {slowLearners.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-semibold text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    No students match the criteria for slow learners under the current {activeThreshold}% threshold.
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                    <table className="min-w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Roll Number</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-center">Mid-I Score</th>
                          <th className="px-4 py-3 text-center">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {slowLearners.map((student: any) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{student.rollNumber}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{student.name}</td>
                            <td className="px-4 py-2.5 text-center font-semibold text-slate-600">{student.score} / {cfData?.mid1Paper?.totalMarks || 30}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-block bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                {student.pct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSlowLearnersModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slow Learners Progress Status Modal */}
      <AnimatePresence>
        {showProgressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowProgressModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <FaGraduationCap className="text-emerald-500 h-5 w-5" />
                    Slow Learners Progress Status
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Students who were slow learners in Mid-I (&lt; {activeThreshold}%) but improved to &ge; {activeThreshold}% in Mid-II.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                {progressStudents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-semibold text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    No slow learners show progress status matching this threshold.
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                    <table className="min-w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Roll Number</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-center">Mid-I %</th>
                          <th className="px-4 py-3 text-center">Mid-II %</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {progressStudents.map((student: any) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{student.rollNumber}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{student.name}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600 font-semibold">{student.pct1}%</td>
                            <td className="px-4 py-2.5 text-center text-slate-600 font-semibold">{student.pct2}%</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                Improved
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Items Warning Modal */}
      <AnimatePresence>
        {showPendingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowPendingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-red-50 border-b border-red-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-red-800 text-lg flex items-center gap-2">
                    <FaExclamationTriangle className="text-red-600 h-5 w-5 animate-pulse" />
                    Missing Course File Data
                  </h3>
                  <p className="text-xs text-red-700 mt-1 font-medium">
                    The following checklist items are pending or have no uploaded data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingModal(false)}
                  className="text-red-400 hover:text-red-600 rounded-lg p-1.5 hover:bg-red-100/50 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                <p className="text-slate-600 text-xs font-semibold mb-4 leading-relaxed">
                  If you choose to continue printing, the booklet will render empty headings and blank template spaces for these pending items. This ensures the generated booklet is still print-ready.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[40vh] overflow-y-auto">
                  <span className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wide">Pending Items ({getPendingItems().length}):</span>
                  <ul className="space-y-1.5">
                    {getPendingItems().map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-700 font-semibold flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowPendingModal(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Go Back & Complete
                </button>
                <button
                  type="button"
                  onClick={handleForcePrint}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Yes, Continue to Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
