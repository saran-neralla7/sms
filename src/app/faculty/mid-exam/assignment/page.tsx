"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft, FaSave, FaCheck, FaSpinner, FaClipboardList, FaInfoCircle,
  FaTimes, FaPlus, FaTasks, FaCalendarAlt, FaCopy, FaEdit, FaTrash, FaBookOpen, FaChalkboardTeacher
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import Modal from "@/components/Modal";

interface AssignmentRow {
  studentId: string;
  rollNumber: string;
  name: string;
  marksObtained: number | null;
  calculatedFinal?: number | null;
  maxMarks: number;
  isDraft: boolean;
  status?: string;
}

function AssignmentMarksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mappings, setMappings] = useState<any[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>("");
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedAY, setSelectedAY] = useState<string>("");

  const urlSubjectId = searchParams ? searchParams.get("subjectId") : null;
  const urlSectionId = searchParams ? searchParams.get("sectionId") : null;
  const urlYear = searchParams ? searchParams.get("year") : null;
  const urlSemester = searchParams ? searchParams.get("semester") : null;
  const urlAyId = searchParams ? searchParams.get("ayId") : null;

  const { data: session, status } = useSession();

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<{ name: string; code: string } | null>(null);
  const [sectionInfo, setSectionInfo] = useState<{ name: string } | null>(null);

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("Assignment 1");
  const [formDescription, setFormDescription] = useState("");
  const [formTotalMarks, setFormTotalMarks] = useState<number>(10);
  const [formDueDate, setFormDueDate] = useState<string>("");
  const [formQuestions, setFormQuestions] = useState<Array<{ qNo: number; text: string; marks?: number }>>([
    { qNo: 1, text: "", marks: 5 }
  ]);
  const [cloneSectionIds, setCloneSectionIds] = useState<string[]>([]);
  const [submittingModal, setSubmittingModal] = useState(false);

  // Keyboard navigation refs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch Academic Years & Faculty Mappings
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/academic-years")
      .then(res => res.json())
      .then(ays => {
        if (Array.isArray(ays)) {
          setAcademicYears(ays);
          const current = ays.find((a: any) => a.isCurrent) || ays[0];
          const defaultAyId = urlAyId || current?.id || "";
          setSelectedAY(defaultAyId);
          fetchMappings(defaultAyId);
        }
      })
      .catch(console.error);
  }, [status, urlAyId]);

  const fetchMappings = async (ayId: string) => {
    try {
      const res = await fetch(`/api/faculty-mappings?academicYearId=${ayId}`);
      if (res.ok) {
        const data = await res.json();
        const mList = Array.isArray(data) ? data : [];
        setMappings(mList);

        if (urlSubjectId && urlSectionId) {
          const match = mList.find(
            (m: any) => m.subjectId === urlSubjectId && m.sectionId === urlSectionId
          );
          if (match) setSelectedMappingId(match.id);
          else if (mList.length > 0) setSelectedMappingId(mList[0].id);
        } else if (mList.length > 0) {
          setSelectedMappingId(mList[0].id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // Derive active mapping strictly to guarantee class & section isolation
  const activeMapping = mappings.find((m: any) => m.id === selectedMappingId) || null;

  const effectiveSubjectId = activeMapping ? activeMapping.subjectId : urlSubjectId;
  const effectiveSectionId = activeMapping ? activeMapping.sectionId : urlSectionId;
  const effectiveDepartmentId = activeMapping?.subject?.departmentId || activeMapping?.subject?.department?.id || (session?.user as any)?.departmentId || "";
  const effectiveYear = activeMapping ? String(activeMapping.subject?.year) : urlYear;
  const effectiveSemester = activeMapping ? String(activeMapping.subject?.semester) : urlSemester;
  const effectiveAyId = selectedAY || urlAyId;

  // Other sections of the SAME subject & year & semester that this faculty teaches (strictly isolated)
  const peerSectionsOfSameSubject = mappings.filter(
    (m: any) =>
      m.id !== selectedMappingId &&
      m.subjectId === effectiveSubjectId &&
      String(m.subject?.year) === String(effectiveYear) &&
      String(m.subject?.semester) === String(effectiveSemester)
  );

  // 2. Load Assignment & Student Marks Data
  const loadData = useCallback(async () => {
    if (!effectiveSubjectId || !effectiveSectionId || !effectiveAyId || !effectiveYear || !effectiveSemester) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const assignmentQuery = selectedAssignmentId ? `&assignmentId=${selectedAssignmentId}` : "";

      const [marksRes, subjectRes, sectionRes] = await Promise.all([
        fetch(
          `/api/mid-exam/assignment?academicYearId=${effectiveAyId}&departmentId=${effectiveDepartmentId}&year=${effectiveYear}&semester=${effectiveSemester}&sectionId=${effectiveSectionId}&subjectId=${effectiveSubjectId}${assignmentQuery}`
        ),
        fetch(`/api/subjects?id=${effectiveSubjectId}`),
        fetch(`/api/sections?id=${effectiveSectionId}`)
      ]);

      if (marksRes.ok) {
        const data = await marksRes.json();
        setRows(data.rows || []);
        setAssignments(data.assignments || []);
      }
      if (subjectRes.ok) {
        const sub = await subjectRes.json();
        setSubjectInfo(sub);
      }
      if (sectionRes.ok) {
        const sec = await sectionRes.json();
        setSectionInfo(sec);
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading assignment marks", "error");
    } finally {
      setLoading(false);
    }
  }, [
    effectiveSubjectId,
    effectiveSectionId,
    effectiveDepartmentId,
    effectiveAyId,
    effectiveYear,
    effectiveSemester,
    selectedAssignmentId
  ]);

  useEffect(() => {
    if (selectedMappingId || (urlSubjectId && urlSectionId)) {
      loadData();
    }
  }, [selectedMappingId, selectedAssignmentId, loadData]);

  const handleMarksChange = (studentId: string, value: string) => {
    const val = value === "" ? null : parseFloat(value);
    setRows(prev =>
      prev.map(row => (row.studentId === studentId ? { ...row, marksObtained: val } : row))
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const nextIndex = Math.min(rows.length - 1, index + 1);
      const nextRow = rows[nextIndex];
      inputRefs.current[nextRow.studentId]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = Math.max(0, index - 1);
      const prevRow = rows[prevIndex];
      inputRefs.current[prevRow.studentId]?.focus();
    }
  };

  const handleSave = async (isDraft: boolean = true) => {
    const errors: string[] = [];
    const entries = rows.map(r => {
      if (r.marksObtained !== null && (r.marksObtained < 0 || r.marksObtained > r.maxMarks)) {
        errors.push(`Marks for ${r.rollNumber} must be between 0 and ${r.maxMarks}`);
      }
      return {
        studentId: r.studentId,
        marksObtained: r.marksObtained,
        maxMarks: r.maxMarks,
        rollNumber: r.rollNumber,
      };
    });

    if (errors.length > 0) {
      showToast(errors[0], "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mid-exam/assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: effectiveAyId,
          departmentId: effectiveDepartmentId,
          year: effectiveYear,
          semester: effectiveSemester,
          sectionId: effectiveSectionId,
          subjectId: effectiveSubjectId,
          assignmentId: selectedAssignmentId,
          entries,
          isDraft,
        })
      });

      if (res.ok) {
        showToast(isDraft ? "Draft saved successfully!" : "Marks submitted successfully!", "success");
        await loadData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to save", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setFormTitle(`Assignment ${assignments.length + 1}`);
    setFormDescription("");
    setFormTotalMarks(10);
    setFormDueDate("");
    setFormQuestions([{ qNo: 1, text: "", marks: 5 }]);
    setCloneSectionIds([]);
    setShowModal(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast("Assignment title is required", "error");
      return;
    }

    setSubmittingModal(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle,
            description: formDescription,
            questions: formQuestions.filter(q => q.text.trim().length > 0),
            totalMarks: formTotalMarks,
            dueDate: formDueDate || null,
            academicYearId: effectiveAyId,
            departmentId: effectiveDepartmentId,
            year: effectiveYear,
            semester: effectiveSemester,
            sectionId: effectiveSectionId,
            subjectId: effectiveSubjectId,
            cloneToSectionIds: cloneSectionIds
          })
        });

        if (res.ok) {
          showToast("Assignment posted & students notified!", "success");
          setShowModal(false);
          await loadData();
        } else {
          const err = await res.json();
          showToast(err.error || "Failed to create", "error");
        }
      }
    } catch (err) {
      showToast("Failed to save assignment", "error");
    } finally {
      setSubmittingModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16">
      {/* Top Navbar Bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-extrabold text-slate-900 flex items-center gap-2 text-base sm:text-lg">
                  <FaTasks className="text-purple-600" /> Subject Assignments
                </h1>
                <p className="text-xs text-slate-500">
                  {subjectInfo?.name || "Subject"} ({subjectInfo?.code || ""}) · Section {sectionInfo?.name || ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm transition-all"
              >
                <FaPlus size={10} /> Post Assignment
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-sm"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />} Save Draft
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
              >
                <FaCheck /> Submit Final
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Class Selection Pills / Dropdown */}
        {mappings.length > 0 && (
          <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <FaChalkboardTeacher className="text-purple-600" />
                <span>My Assigned Classes & Sections ({mappings.length}):</span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Academic Year: <strong>{academicYears.find(y => y.id === selectedAY)?.name || "2026-2027"}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {mappings.map(m => {
                const isSelected = m.id === selectedMappingId;
                const deptCode = m.subject?.department?.code || "CSE";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedMappingId(m.id);
                      setSelectedAssignmentId("ALL");
                    }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-purple-600 bg-purple-50/70 shadow-sm ring-2 ring-purple-100"
                        : "border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                        {deptCode} · Yr {m.subject?.year} Sem {m.subject?.semester}
                      </span>
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                        Sec {m.section?.name}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm truncate" title={m.subject?.name}>
                      {m.subject?.name}
                    </div>
                    <div className="text-xs font-mono text-slate-500">{m.subject?.code}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Assignment Selector Pills */}
        <div className="mb-6 flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
            View / Enter:
          </span>
          <button
            onClick={() => setSelectedAssignmentId("ALL")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedAssignmentId === "ALL"
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Assignments (Scaled Final 10M)
          </button>
          {assignments.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAssignmentId(a.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedAssignmentId === a.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span>{a.title}</span>
              {a.dueDate && (
                <span className="text-[10px] opacity-75">
                  ({new Date(a.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Assignment Info Card */}
        {selectedAssignmentId !== "ALL" && (() => {
          const currentA = assignments.find(a => a.id === selectedAssignmentId);
          if (!currentA) return null;
          return (
            <div className="mb-6 rounded-2xl bg-white p-5 border border-purple-100 shadow-sm ring-1 ring-purple-50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                    Max Marks: {currentA.totalMarks}M
                  </span>
                  <h2 className="text-lg font-black text-slate-900 mt-2">{currentA.title}</h2>
                  {currentA.description && (
                    <p className="text-xs text-slate-600 mt-1">{currentA.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <FaCalendarAlt className="text-purple-600" />
                    Due Date: {currentA.dueDate ? new Date(currentA.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No deadline"}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Info Box */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Section & Student Strict Isolation</p>
            <p>
              Assignments and student marks are strictly separated by Department, Year, Semester, and Section.
              Currently viewing: <strong>{activeMapping?.subject?.department?.code || "CSE"} Yr {effectiveYear} Sem {effectiveSemester} - Sec {sectionInfo?.name}</strong> ({rows.length} students).
            </p>
          </div>
        </div>

        {/* Student Marks List */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-100">
          <div className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                No students found for this class section.
              </div>
            ) : (
              rows.map((row, idx) => (
                <div
                  key={row.studentId}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex-1" title={row.name}>
                    <p className="font-bold text-slate-900 text-sm font-mono leading-tight">{row.rollNumber}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[260px] leading-tight">{row.name}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    {row.calculatedFinal !== undefined && row.calculatedFinal !== null && (
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Scaled (10M)</span>
                        <span className="text-sm font-black text-purple-700">{row.calculatedFinal} / 10</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        ref={el => {
                          inputRefs.current[row.studentId] = el;
                        }}
                        type="number"
                        value={row.marksObtained === null ? "" : row.marksObtained}
                        onChange={e => handleMarksChange(row.studentId, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, idx)}
                        className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-100 hover:border-slate-300 focus:border-purple-500 text-slate-800"
                        placeholder="-"
                        min={0}
                        max={row.maxMarks}
                        step={0.5}
                      />
                      <span className="text-xs text-slate-400 font-bold">/ {row.maxMarks}</span>
                    </div>

                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.isDraft
                        ? "bg-slate-100 text-slate-600"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {row.isDraft ? "Draft" : "Submitted"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === "create" ? "Post New Assignment" : "Edit Assignment"}
      >
        <form onSubmit={handleModalSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Assignment Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Assignment 1"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                Total Marks *
              </label>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={formTotalMarks}
                onChange={e => setFormTotalMarks(parseFloat(e.target.value) || 10)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
                Submission Due Date
              </label>
              <input
                type="date"
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              Instructions / Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief submission guidelines or instructions for students..."
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase text-slate-500">
                Questions
              </label>
              <button
                type="button"
                onClick={() =>
                  setFormQuestions(prev => [
                    ...prev,
                    { qNo: prev.length + 1, text: "", marks: 5 }
                  ])
                }
                className="text-xs text-purple-600 font-bold hover:underline"
              >
                + Add Question
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {formQuestions.map((q, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-6">Q{idx + 1}</span>
                  <input
                    type="text"
                    placeholder="Enter question text..."
                    value={q.text}
                    onChange={e => {
                      const val = e.target.value;
                      setFormQuestions(prev =>
                        prev.map((item, i) => (i === idx ? { ...item, text: val } : item))
                      );
                    }}
                    className="flex-1 rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  {formQuestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormQuestions(prev => prev.filter((_, i) => i !== idx))
                      }
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <FaTimes size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section Cloning Option - Strictly limited to peer sections of the SAME subject & year */}
          {modalMode === "create" && peerSectionsOfSameSubject.length > 0 && (
            <div className="rounded-xl bg-purple-50/70 p-3 border border-purple-100">
              <label className="text-xs font-bold text-purple-900 block mb-1">
                Clone to Other Sections of this Subject:
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {peerSectionsOfSameSubject.map((m: any) => {
                  const checked = cloneSectionIds.includes(m.sectionId);
                  return (
                    <label
                      key={m.id}
                      className={`cursor-pointer px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        checked
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => {
                          setCloneSectionIds(prev =>
                            checked
                              ? prev.filter(id => id !== m.sectionId)
                              : [...prev, m.sectionId]
                          );
                        }}
                      />
                      Section {m.section?.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingModal}
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              {submittingModal && <FaSpinner className="animate-spin" size={12} />}
              {modalMode === "create" ? "Post & Notify Students" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function AssignmentMarksPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>}>
      <AssignmentMarksContent />
    </Suspense>
  );
}
