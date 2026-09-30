"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft, FaSave, FaCheck, FaSpinner, FaPlus, FaTrash,
  FaPrint, FaCalendarAlt, FaBookOpen, FaTimes, FaLayerGroup,
  FaCalculator, FaEye, FaBullhorn, FaInfoCircle, FaPen
} from "react-icons/fa";
import dynamic from "next/dynamic";
import LogoSpinner from "@/components/LogoSpinner";
import MathRenderer from "@/components/MathRenderer";
import MathToolbar from "@/components/MathToolbar";

const MathFieldEditor = dynamic(() => import("@/components/MathFieldEditor"), { ssr: false });

interface SubQuestion {
  subLabel: string; // e.g. "a", "b", "c"
  questionText: string;
  marks: number;
  coMapping: string;
  btLevel: string;
}

interface Question {
  qNo: number;
  subQuestions: SubQuestion[];
}

interface AssignmentData {
  id: string;
  title: string;
  description?: string | null;
  totalMarks: number;
  dueDate?: string | null;
  isFrozen: boolean;
  academicYearId: string;
  departmentId: string;
  year: string;
  semester: string;
  sectionId: string;
  subjectId: string;
  questions: any;
  subject: {
    id: string;
    name: string;
    code: string;
    type: string;
    syllabus?: any;
    department?: { id: string; name: string; code: string };
  };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
  department: { id: string; code: string; name: string };
  marks: any[];
  createdAt?: string | Date;
}

const BT_LEVELS = [
  { value: "L1", label: "L1 - Remember" },
  { value: "L2", label: "L2 - Understand" },
  { value: "L3", label: "L3 - Apply" },
  { value: "L4", label: "L4 - Analyze" },
  { value: "L5", label: "L5 - Evaluate" },
  { value: "L6", label: "L6 - Create" },
];

export default function AssignmentBuilderPage() {
  const params = useParams();
  const id = params ? (params.id as string) : "";
  const router = useRouter();
  const { data: session, status } = useSession();

  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalMarks, setTotalMarks] = useState<number>(10);
  const [dueDate, setDueDate] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);

  // Math field editor state tracking: Set of "qIdx-sqIdx"
  const [mathModeFields, setMathModeFields] = useState<Set<string>>(new Set());

  // Clones
  const [peerSections, setPeerSections] = useState<any[]>([]);
  const [selectedCloneSections, setSelectedCloneSections] = useState<string[]>([]);
  const [showCloneModal, setShowCloneModal] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch Assignment Data
  const fetchAssignment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/assignments/${id}`);
      if (!res.ok) {
        showToast("Failed to load assignment", "error");
        return;
      }
      const data: AssignmentData = await res.json();
      setAssignment(data);
      setTitle(data.title || "Assignment 1");
      setDescription(data.description || "");
      setTotalMarks(data.totalMarks || 10);
      setDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");

      // Parse questions JSON
      let parsedQuestions: Question[] = [];
      const rawQ = data.questions;

      if (Array.isArray(rawQ) && rawQ.length > 0) {
        parsedQuestions = rawQ.map((q: any, qIdx: number) => {
          // If already structured with subQuestions
          if (Array.isArray(q.subQuestions) && q.subQuestions.length > 0) {
            return {
              qNo: q.qNo || qIdx + 1,
              subQuestions: q.subQuestions.map((sq: any, sIdx: number) => ({
                subLabel: sq.subLabel || String.fromCharCode(97 + sIdx),
                questionText: sq.questionText || sq.text || "",
                marks: sq.marks !== undefined ? Number(sq.marks) : 5,
                coMapping: sq.coMapping || "CO1",
                btLevel: sq.btLevel || "L2"
              }))
            };
          }
          // Legacy format where question itself was flat
          return {
            qNo: q.qNo || qIdx + 1,
            subQuestions: [
              {
                subLabel: "a",
                questionText: q.text || "",
                marks: q.marks !== undefined ? Number(q.marks) : Number(data.totalMarks) || 5,
                coMapping: q.coMapping || "CO1",
                btLevel: q.btLevel || "L2"
              }
            ]
          };
        });
      } else {
        // Default initial question
        parsedQuestions = [
          {
            qNo: 1,
            subQuestions: [
              { subLabel: "a", questionText: "", marks: 5, coMapping: "CO1", btLevel: "L2" },
              { subLabel: "b", questionText: "", marks: 5, coMapping: "CO2", btLevel: "L3" }
            ]
          }
        ];
      }

      setQuestions(parsedQuestions);

      // Fetch peer sections for cloning
      if (data.subjectId) {
        fetchPeerSections(data.subjectId, data.sectionId, data.academicYearId);
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading assignment", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPeerSections = async (subId: string, currentSecId: string, ayId: string) => {
    try {
      const res = await fetch(`/api/faculty-mappings?academicYearId=${ayId}`);
      if (res.ok) {
        const mappings = await res.json();
        if (Array.isArray(mappings)) {
          const peers = mappings
            .filter((m: any) => m.subjectId === subId && m.sectionId !== currentSecId)
            .map((m: any) => m.section)
            .filter(Boolean);
          // deduplicate
          const uniquePeers = Array.from(new Map(peers.map((s: any) => [s.id, s])).values());
          setPeerSections(uniquePeers);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchAssignment();
    }
  }, [status, fetchAssignment, router]);

  // Extract CO options from subject syllabus
  const coOptions = useMemo((): string[] => {
    if (assignment?.subject?.syllabus) {
      const sObj = typeof assignment.subject.syllabus === "string"
        ? JSON.parse(assignment.subject.syllabus)
        : assignment.subject.syllabus;
      if (Array.isArray(sObj?.outcomes) && sObj.outcomes.length > 0) {
        return sObj.outcomes.map((co: any) => {
          const code = typeof co === "string" ? co : (co.code || co.id);
          return String(code).replace(/<[^>]*>/g, "").trim();
        });
      }
    }
    return ["CO1", "CO2", "CO3", "CO4", "CO5"];
  }, [assignment]);

  // Calculate sum of question marks
  const calculatedSum = useMemo(() => {
    let sum = 0;
    questions.forEach(q => {
      q.subQuestions.forEach(sq => {
        sum += sq.marks || 0;
      });
    });
    return sum;
  }, [questions]);

  // Question manipulation
  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        qNo: prev.length + 1,
        subQuestions: [
          { subLabel: "a", questionText: "", marks: 5, coMapping: coOptions[0] || "CO1", btLevel: "L2" }
        ]
      }
    ]);
  };

  const removeQuestion = (qIdx: number) => {
    setQuestions(prev => {
      const updated = prev.filter((_, idx) => idx !== qIdx);
      return updated.map((q, idx) => ({ ...q, qNo: idx + 1 }));
    });
  };

  const addSubQuestion = (qIdx: number) => {
    setQuestions(prev =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        const nextChar = String.fromCharCode(97 + q.subQuestions.length);
        return {
          ...q,
          subQuestions: [
            ...q.subQuestions,
            { subLabel: nextChar, questionText: "", marks: 5, coMapping: coOptions[0] || "CO1", btLevel: "L2" }
          ]
        };
      })
    );
  };

  const removeSubQuestion = (qIdx: number, sqIdx: number) => {
    setQuestions(prev =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        if (q.subQuestions.length <= 1) return q; // Keep at least one
        const filtered = q.subQuestions.filter((_, sIdx) => sIdx !== sqIdx);
        return {
          ...q,
          subQuestions: filtered.map((sq, sIdx) => ({
            ...sq,
            subLabel: String.fromCharCode(97 + sIdx)
          }))
        };
      })
    );
  };

  const updateSubQuestion = (
    qIdx: number,
    sqIdx: number,
    field: keyof SubQuestion,
    val: any
  ) => {
    setQuestions(prev =>
      prev.map((q, idx) => {
        if (idx !== qIdx) return q;
        return {
          ...q,
          subQuestions: q.subQuestions.map((sq, sIdx) =>
            sIdx === sqIdx ? { ...sq, [field]: val } : sq
          )
        };
      })
    );
  };

  // Math mode toggle
  const toggleMathMode = (qIdx: number, sqIdx: number) => {
    const key = `${qIdx}-${sqIdx}`;
    setMathModeFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Save handler
  const handleSave = async (notify: boolean = false) => {
    if (!title.trim()) {
      showToast("Please provide an assignment title", "error");
      return;
    }

    setSaving(true);
    if (notify) setNotifying(true);

    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          totalMarks: Number(totalMarks) || calculatedSum || 10,
          dueDate: dueDate || null,
          questions,
          notifyStudents: notify,
          cloneToSectionIds: selectedCloneSections
        })
      });

      if (res.ok) {
        showToast(
          notify
            ? "Assignment published & students notified!"
            : "Assignment changes saved successfully!",
          "success"
        );
        setShowCloneModal(false);
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save assignment", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error saving assignment", "error");
    } finally {
      setSaving(false);
      setNotifying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-8 text-center text-slate-500">
        Assignment not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* TOP HEADER / ACTION BAR (Hidden in Print) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/faculty/mid-exam/assignment?subjectId=${assignment.subjectId}&sectionId=${assignment.sectionId}`)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FaArrowLeft /> Back to Assignments
              </button>
              <div>
                <h1 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <span className="rounded bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-mono font-bold">
                    {assignment.subject.code}
                  </span>
                  <span>{title || "Assignment Builder"}</span>
                </h1>
                <p className="text-[11px] text-slate-500">
                  {assignment.subject.name} · Sec {assignment.section.name} · AY {assignment.academicYear.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                title="Print Draft"
              >
                <FaPrint /> Print Draft
              </button>

              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving && !notifying ? <FaSpinner className="animate-spin" /> : <FaSave />} Save Draft
              </button>

              <button
                onClick={() => {
                  if (peerSections.length > 0) {
                    setShowCloneModal(true);
                  } else {
                    handleSave(true);
                  }
                }}
                disabled={saving || notifying}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md"
              >
                {notifying ? <FaSpinner className="animate-spin" /> : <FaBullhorn />} Post & Notify Students
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* SCREEN EDITOR CONTENT (Hidden during Print) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="print:hidden mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        
        {/* Assignment Metadata Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FaPen className="text-purple-600" /> Assignment Details & Guidelines
            </h2>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1 bg-purple-50 text-purple-800 px-3 py-1 rounded-full border border-purple-100">
                Sum of Questions: <strong className="text-sm font-black">{calculatedSum}M</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Assignment Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Assignment 1"
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Total Max Marks *
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={totalMarks}
                onChange={e => setTotalMarks(parseFloat(e.target.value) || 10)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                Submission Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
              Instructions & Submission Notes for Students
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Submit in handwritten format on A4 sheets by due date. Answer all questions clearly with diagrams."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Questions & Sub-Questions Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <FaBookOpen className="text-purple-600" /> Assignment Questions ({questions.length})
            </h3>
            <button
              onClick={addQuestion}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-sm transition-all cursor-pointer"
            >
              <FaPlus size={10} /> Add Main Question
            </button>
          </div>

          {questions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-mono font-bold text-white">
                    Q{q.qNo}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Question {q.qNo} ({q.subQuestions.length} sub-parts)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addSubQuestion(qIdx)}
                    className="flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FaPlus size={9} /> Add Sub-part ({String.fromCharCode(97 + q.subQuestions.length)})
                  </button>
                  {questions.length > 1 && (
                    <button
                      onClick={() => removeQuestion(qIdx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <FaTrash size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Questions List */}
              <div className="space-y-4">
                {q.subQuestions.map((sq, sqIdx) => {
                  const mathKey = `${qIdx}-${sqIdx}`;
                  const isMathOpen = mathModeFields.has(mathKey);

                  return (
                    <div
                      key={sqIdx}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono">
                            Part ({sq.subLabel})
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">
                            Q{q.qNo}({sq.subLabel})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Marks */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Marks:</label>
                            <input
                              type="number"
                              min={0.5}
                              max={100}
                              step={0.5}
                              value={sq.marks}
                              onChange={e =>
                                updateSubQuestion(qIdx, sqIdx, "marks", parseFloat(e.target.value) || 0)
                              }
                              className="w-16 rounded-lg border border-slate-200 bg-white p-1 text-center text-xs font-bold text-slate-800"
                            />
                          </div>

                          {/* CO Mapping */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">CO:</label>
                            <select
                              value={sq.coMapping}
                              onChange={e => updateSubQuestion(qIdx, sqIdx, "coMapping", e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white p-1 text-xs font-bold text-slate-800"
                            >
                              {coOptions.map(co => (
                                <option key={co} value={co}>
                                  {co}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* BT Level */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Bloom:</label>
                            <select
                              value={sq.btLevel}
                              onChange={e => updateSubQuestion(qIdx, sqIdx, "btLevel", e.target.value)}
                              className="rounded-lg border border-slate-200 bg-white p-1 text-xs font-bold text-slate-800"
                            >
                              {BT_LEVELS.map(bt => (
                                <option key={bt.value} value={bt.value}>
                                  {bt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Math Mode Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleMathMode(qIdx, sqIdx)}
                            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold border transition-colors ${
                              isMathOpen
                                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <FaCalculator size={11} /> {isMathOpen ? "Close Math Editor" : "Formula / Math"}
                          </button>

                          {q.subQuestions.length > 1 && (
                            <button
                              onClick={() => removeSubQuestion(qIdx, sqIdx)}
                              className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                              title="Delete Sub-question"
                            >
                              <FaTimes size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Math Live Equation Editor & Toolbar */}
                      {isMathOpen && (
                        <div className="rounded-xl border border-purple-200 bg-white p-3 space-y-2 shadow-sm">
                          <MathToolbar
                            onInsert={(latex) => {
                              const newText = sq.questionText ? `${sq.questionText} $${latex}$` : `$${latex}$`;
                              updateSubQuestion(qIdx, sqIdx, "questionText", newText);
                            }}
                          />
                          <div className="pt-1">
                            <label className="text-[10px] font-bold text-purple-700 uppercase block mb-1">
                              WYSIWYG Math Equation Writer:
                            </label>
                            <MathFieldEditor
                              value={sq.questionText}
                              onChange={(val) => updateSubQuestion(qIdx, sqIdx, "questionText", val)}
                              placeholder="Type math formulas, fractions, matrices, symbols..."
                            />
                          </div>
                        </div>
                      )}

                      {/* Standard Text Input / Fallback */}
                      <div>
                        <textarea
                          rows={2}
                          value={sq.questionText}
                          onChange={e => updateSubQuestion(qIdx, sqIdx, "questionText", e.target.value)}
                          placeholder="Type question text here (LaTeX math can be written with $...$ or $$...$$)..."
                          className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      {/* Live KaTeX Rendered Preview */}
                      {sq.questionText.trim().length > 0 && (
                        <div className="rounded-lg bg-white border border-slate-100 p-2.5 text-xs">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1 flex items-center gap-1">
                            <FaEye size={10} /> Live Preview:
                          </span>
                          <div className="text-slate-800 font-serif leading-relaxed">
                            <MathRenderer text={sq.questionText} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* PRINT DRAFT SHEET (Visible in Print View) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="hidden print:block text-black bg-white p-6 max-w-4xl mx-auto font-serif">
        <style>{`
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 12mm 15mm;
          }
          @media print {
            body {
              background: white !important;
              color: black !important;
              font-family: "Times New Roman", Times, serif !important;
            }
          }
        `}</style>

        {/* Regd No Box */}
        <div className="flex justify-end items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold font-sans">Regd. No:</span>
          <div className="flex border border-black">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-4 border-r border-black last:border-r-0 bg-white"
              />
            ))}
          </div>
        </div>

        {/* Institution Header with Logo */}
        <div className="border-b-2 border-black pb-2 mb-2 text-center relative">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="GVP College Logo"
              className="w-14 h-14 object-contain shrink-0"
              onError={(e) => { (e.target as any).style.display = "none"; }}
            />
            <div>
              <h2 className="text-[13px] font-black uppercase tracking-wide leading-tight">
                GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND P.G. COURSES (AUTONOMOUS)
              </h2>
              <p className="text-[10px] font-bold text-gray-800">
                Accredited by NAAC | Approved by AICTE, New Delhi
              </p>
              <p className="text-[9.5px] font-semibold text-gray-700">
                Rushikonda, Visakhapatnam - 530 045.
              </p>
            </div>
          </div>

          <div className="mt-2 pt-1 border-t border-black flex justify-between items-center text-[10px] font-bold">
            <span>Branch: {assignment.subject.department?.code || assignment.department?.code || "CSE"}</span>
            <span className="uppercase text-[11px] tracking-wider">{title || "ASSIGNMENT"}</span>
            <span>Year {assignment.year} · Sem {assignment.semester} · Sec {assignment.section?.name}</span>
          </div>
        </div>

        {/* Assignment Metadata Table */}
        <table className="w-full border-collapse border border-black text-[10px] mb-3">
          <tbody>
            <tr>
              <td className="p-1 font-bold border border-black bg-gray-50" style={{ width: "18%" }}>
                Course Title
              </td>
              <td className="p-1 font-bold uppercase border border-black" style={{ width: "42%" }}>
                {assignment.subject.name}
              </td>
              <td className="p-1 font-bold border border-black bg-gray-50" style={{ width: "18%" }}>
                Course Code
              </td>
              <td className="p-1 font-bold uppercase font-mono border border-black" style={{ width: "22%" }}>
                {assignment.subject.code}
              </td>
            </tr>
            <tr>
              <td className="p-1 font-bold border border-black bg-gray-50">
                Date of Issue
              </td>
              <td className="p-1 border border-black">
                {new Date(assignment.createdAt || new Date()).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })}
              </td>
              <td className="p-1 font-bold border border-black bg-gray-50">
                Submission Due Date
              </td>
              <td className="p-1 font-bold border border-black">
                {dueDate
                  ? new Date(dueDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    })
                  : "As per instructions"}
              </td>
            </tr>
            <tr>
              <td className="p-1 font-bold border border-black bg-gray-50">
                Max. Marks
              </td>
              <td className="p-1 font-bold border border-black">
                {totalMarks} Marks
              </td>
              <td className="p-1 font-bold border border-black bg-gray-50">
                Academic Year
              </td>
              <td className="p-1 border border-black">
                {assignment.academicYear.name}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Instructions */}
        {description && (
          <div className="mb-3 text-[10px] italic border-l-2 border-black pl-2">
            <strong>Instructions:</strong> {description}
          </div>
        )}

        {/* Questions Table */}
        <div className="mb-4">
          <div className="text-center font-bold text-[11px] mb-1.5 pb-0.5 border-b border-black">
            <u>Answer All Questions</u>
          </div>

          <table className="w-full border-collapse border border-black text-[10px]">
            <thead>
              <tr className="bg-gray-100 font-bold border-b border-black text-center">
                <th className="p-1 border-r border-black" style={{ width: "8%" }}>Q.No</th>
                <th className="p-1 border-r border-black text-left" style={{ width: "66%" }}>Question Description</th>
                <th className="p-1 border-r border-black" style={{ width: "8%" }}>CO</th>
                <th className="p-1 border-r border-black" style={{ width: "8%" }}>BT</th>
                <th className="p-1" style={{ width: "10%" }}>Marks</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                q.subQuestions.map((sq, sqIdx) => (
                  <tr key={`${q.qNo}-${sqIdx}`} className="border-b border-black">
                    <td className="p-1.5 text-center font-bold border-r border-black align-top font-mono">
                      {sqIdx === 0 ? `${q.qNo}` : ""}({sq.subLabel})
                    </td>
                    <td className="p-1.5 text-left border-r border-black align-top leading-normal">
                      <MathRenderer text={sq.questionText} />
                    </td>
                    <td className="p-1.5 text-center font-bold border-r border-black align-top font-mono text-[9px]">
                      {sq.coMapping}
                    </td>
                    <td className="p-1.5 text-center font-bold border-r border-black align-top font-mono text-[9px]">
                      {sq.btLevel}
                    </td>
                    <td className="p-1.5 text-center font-bold align-top">
                      {sq.marks}M
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>

        {/* Student & Faculty Signature Blocks */}
        <div className="flex justify-between items-center text-[10px] font-bold mt-12 pt-4 px-2">
          <div className="text-center">
            <div className="w-36 border-t border-black mb-1"></div>
            <span>Signature of the Student</span>
          </div>
          <div className="text-center">
            <div className="w-36 border-t border-black mb-1"></div>
            <span>Signature of the Faculty</span>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* CLONE SECTIONS MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FaBullhorn className="text-purple-600" /> Post & Notify Students
              </h3>
              <button
                onClick={() => setShowCloneModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This assignment will be posted to <strong>Section {assignment.section.name}</strong>, and an instant notification will be delivered to all enrolled students.
            </p>

            {peerSections.length > 0 && (
              <div className="rounded-xl bg-purple-50/70 p-3.5 border border-purple-100 space-y-2">
                <label className="text-xs font-bold text-purple-900 block">
                  Also Clone & Post to Other Sections of this Subject?
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {peerSections.map((sec: any) => {
                    const checked = selectedCloneSections.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
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
                            setSelectedCloneSections(prev =>
                              checked ? prev.filter(sId => sId !== sec.id) : [...prev, sec.id]
                            );
                          }}
                        />
                        Section {sec.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCloneModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || notifying}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm flex items-center gap-1.5"
              >
                {notifying && <FaSpinner className="animate-spin" size={12} />}
                Confirm & Notify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
