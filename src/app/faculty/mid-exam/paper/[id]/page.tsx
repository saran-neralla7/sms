"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus, FaTrash, FaLock, FaUnlock, FaSpinner, FaSave,
  FaChevronDown, FaChevronUp, FaInfoCircle, FaCheck, FaExclamationTriangle,
  FaArrowLeft, FaPen, FaClipboardList, FaPrint, FaImage, FaTimes
} from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";
import MathRenderer from "@/components/MathRenderer";
import MathToolbar from "@/components/MathToolbar";
import dynamic from "next/dynamic";

const MathFieldEditor = dynamic(() => import("@/components/MathFieldEditor"), { ssr: false });

interface SubQuestion {
  id?: string;
  subLabel: string;
  questionText: string;
  imageUrl?: string | null;
  maxMarks: number;
  coMapping: string;
  btLevel: string;
  order?: number;
}

interface Question {
  id?: string;
  questionNo: number;
  isCompulsory: boolean;
  choiceGroupNo?: number | null;
  subQuestions: SubQuestion[];
}

interface Paper {
  id: string;
  examType: string;
  isFrozen: boolean;
  totalMarks: number;
  departmentId: string;
  year: string;
  semester: string;
  sectionId: string;
  subjectId: string;
  academicYearId: string;
  subject: { name: string; code: string; type: string; syllabus?: any; department?: { id: string; name: string; code: string } };
  section: { name: string };
  academicYear: { name: string };
  scheme: any;
  questions: any[];
  publishRecord: { isLocked: boolean; isPublished: boolean } | null;
  examDate?: string | null;
  isCommon?: boolean;
  commonText?: string | null;
  masterPaperId?: string | null;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const CO_OPTIONS = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6", "CO7", "CO8", "CO9", "CO10"];
const BT_LEVEL_OPTIONS = [
  { value: "L1", label: "L1 - Remember" },
  { value: "L2", label: "L2 - Understand" },
  { value: "L3", label: "L3 - Apply" },
  { value: "L4", label: "L4 - Analyze" },
  { value: "L5", label: "L5 - Evaluate" },
  { value: "L6", label: "L6 - Create" },
];

export default function QuestionPaperBuilderPage() {
  const params = useParams();
  const id = params ? (params.id as string) : "";
  const router = useRouter();
  const { data: session } = useSession();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [expandedQ, setExpandedQ] = useState<Set<number>>(new Set([0]));
  const [mathModeFields, setMathModeFields] = useState<Set<string>>(new Set());
  // Edit Text Only mode — active only on frozen papers
  const [editTextMode, setEditTextMode] = useState(false);

  const role = (session?.user as any)?.role;
  const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);
  const canEdit = !paper?.isFrozen || isAdmin;
  const isLinked = !!paper?.masterPaperId;
  const canEditQuestions = canEdit && !isLinked;
  // In Edit Text Only mode: question text is editable, everything else locked
  const isEditingTextOnly = editTextMode && !!paper?.isFrozen;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Dynamically extract CO options from subject syllabus if configured
  const getCoOptions = useCallback((): string[] => {
    if (paper?.subject?.syllabus) {
      const syllabusObj = paper.subject.syllabus as any;
      if (Array.isArray(syllabusObj.outcomes) && syllabusObj.outcomes.length > 0) {
        return syllabusObj.outcomes.map((co: any) => co.code || co.id || co);
      }
    }
    return CO_OPTIONS;
  }, [paper]);

  const getDefaultCo = useCallback((): string => {
    const cos = getCoOptions();
    return cos[0] || "CO1";
  }, [getCoOptions]);

  const loadPaper = useCallback(async () => {
    try {
      const res = await fetch(`/api/mid-exam/papers/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setPaper(data);

      // Parse questions from API into local state
      const qs: Question[] = (data.questions || []).map((q: any) => ({
        id: q.id,
        questionNo: q.questionNo,
        isCompulsory: q.isCompulsory,
        choiceGroupNo: q.choiceGroup?.groupNo ?? null,
        subQuestions: (q.subQuestions || []).map((sq: any) => ({
          id: sq.id,
          subLabel: sq.subLabel,
          questionText: sq.questionText,
          imageUrl: sq.imageUrl || null,
          maxMarks: sq.maxMarks,
          coMapping: sq.coMapping,
          btLevel: sq.btLevel || "L1",
        }))
      }));
      setQuestions(qs.length > 0 ? qs : [createDefaultQuestion(1)]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPaper(); }, [loadPaper]);

  const createDefaultQuestion = (questionNo: number): Question => ({
    questionNo,
    isCompulsory: true,
    choiceGroupNo: null,
    subQuestions: [{ subLabel: "a", questionText: "", imageUrl: null, maxMarks: 0, coMapping: getDefaultCo(), btLevel: "L1" }]
  });

  const addQuestion = () => {
    const nextNo = questions.length + 1;
    setQuestions(prev => [...prev, createDefaultQuestion(nextNo)]);
    setExpandedQ(prev => new Set([...prev, nextNo - 1]));
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => {
      const updated = prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, questionNo: i + 1 }));
      return updated;
    });
  };

  const updateQuestion = (idx: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const addSubQuestion = (qIdx: number) => {
    const q = questions[qIdx];
    const labels = ["a", "b", "c", "d", "e", "f"];
    const nextLabel = labels[q.subQuestions.length] || String.fromCharCode(97 + q.subQuestions.length);
    const newSq: SubQuestion = { subLabel: nextLabel, questionText: "", imageUrl: null, maxMarks: 0, coMapping: getDefaultCo(), btLevel: "L1" };
    setQuestions(prev => prev.map((q, i) => i === qIdx ? { ...q, subQuestions: [...q.subQuestions, newSq] } : q));
  };

  const removeSubQuestion = (qIdx: number, sqIdx: number) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? {
      ...q,
      subQuestions: q.subQuestions.filter((_, j) => j !== sqIdx)
        .map((sq, j) => ({ ...sq, subLabel: ["a", "b", "c", "d", "e", "f"][j] || sq.subLabel }))
    } : q));
  };

  const updateSubQuestion = (qIdx: number, sqIdx: number, field: keyof SubQuestion, value: any) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx ? {
      ...q,
      subQuestions: q.subQuestions.map((sq, j) => j === sqIdx ? { ...sq, [field]: value } : sq)
    } : q));
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (questions.length === 0) errors.push("Add at least one question");

    let calculatedTotal = 0;
    const choiceGroups: Record<number, number[]> = {};

    for (const q of questions) {
      if (q.subQuestions.length === 0) errors.push(`Q${q.questionNo}: Add at least one subquestion`);

      const qTotal = q.subQuestions.reduce((s, sq) => s + sq.maxMarks, 0);

      if (!q.isCompulsory && q.choiceGroupNo) {
        if (!choiceGroups[q.choiceGroupNo]) choiceGroups[q.choiceGroupNo] = [];
        choiceGroups[q.choiceGroupNo].push(qTotal);
      } else {
        calculatedTotal += qTotal;
      }

      for (const sq of q.subQuestions) {
        if (sq.maxMarks <= 0) errors.push(`Q${q.questionNo}${sq.subLabel}: Max marks must be > 0`);
        if (!sq.questionText.trim()) errors.push(`Q${q.questionNo}${sq.subLabel}: Question text is required`);
      }
    }

    // Add max of each choice group
    for (const marks of Object.values(choiceGroups)) {
      calculatedTotal += Math.max(...marks);
    }

    if (paper && Math.abs(calculatedTotal - paper.totalMarks) > 0.01) {
      errors.push(`Total marks mismatch: questions sum to ${calculatedTotal}, paper total is ${paper.totalMarks}. Adjust subquestion marks or paper total.`);
    }

    return errors;
  };

  const handleSave = async () => {
    if (!isLinked) {
      const errors = validate();
      if (errors.length > 0) { setValidationErrors(errors); return; }
    }
    setValidationErrors([]);
    setSaving(true);
    try {
      const payload: any = {
        totalMarks: paper?.totalMarks,
        examDate: paper?.examDate,
        isCommon: paper?.isCommon,
        commonText: paper?.commonText
      };
      if (!isLinked) {
        payload.questions = questions;
      }
      const res = await fetch(`/api/mid-exam/papers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("Paper saved successfully!", "success");
        await loadPaper();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to save", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // Safe text-only save — calls /text endpoint which never deletes or recreates questions
  const handleSaveTextOnly = async () => {
    setSavingText(true);
    try {
      // Build payload: only subQuestionId + questionText + imageUrl
      const payload = questions.flatMap(q =>
        q.subQuestions
          .filter(sq => !!sq.id) // only existing DB sub-questions
          .map(sq => ({
            id: sq.id as string,
            questionText: sq.questionText,
            imageUrl: sq.imageUrl ?? null,
          }))
      );
      const res = await fetch(`/api/mid-exam/papers/${id}/text`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subQuestions: payload }),
      });
      if (res.ok) {
        showToast("Question text saved successfully!", "success");
        setEditTextMode(false);
        await loadPaper();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to save text", "error");
      }
    } finally {
      setSavingText(false);
    }
  };

  const handleFreeze = async (action: "freeze" | "unfreeze") => {
    if (action === "freeze") {
      if (!isLinked) {
        const errors = validate();
        if (errors.length > 0) { setValidationErrors(errors); setShowFreezeModal(false); return; }
      }

      // Auto-save draft changes first
      setSaving(true);
      try {
        const payload: any = {
          totalMarks: paper?.totalMarks,
          examDate: paper?.examDate,
          isCommon: paper?.isCommon,
          commonText: paper?.commonText
        };
        if (!isLinked) {
          payload.questions = questions;
        }
        const res = await fetch(`/api/mid-exam/papers/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const data = await res.json();
          showToast(data.error || "Failed to save draft before freezing", "error");
          setSaving(false);
          return;
        }
      } catch (err) {
        showToast("Failed to save draft before freezing", "error");
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }
    setFreezing(true);
    try {
      const res = await fetch(`/api/mid-exam/papers/${id}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        showToast(action === "freeze" ? "Paper frozen! No further edits possible." : "Paper unfrozen.", "success");
        setShowFreezeModal(false);
        await loadPaper();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed", "error");
      }
    } finally {
      setFreezing(false);
    }
  };

  const totalFromQuestions = () => {
    let total = 0;
    const choiceGroups: Record<number, number[]> = {};
    for (const q of questions) {
      const qTotal = q.subQuestions.reduce((s, sq) => s + sq.maxMarks, 0);
      if (!q.isCompulsory && q.choiceGroupNo) {
        if (!choiceGroups[q.choiceGroupNo]) choiceGroups[q.choiceGroupNo] = [];
        choiceGroups[q.choiceGroupNo].push(qTotal);
      } else {
        total += qTotal;
      }
    }
    for (const marks of Object.values(choiceGroups)) total += Math.max(...marks);
    return total;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  if (!paper) return <div className="flex min-h-screen items-center justify-center text-slate-500">Paper not found</div>;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 print:hidden">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                  <FaArrowLeft /> Back
                </button>
                <div>
                  <h1 className="font-bold text-slate-900">
                    {paper.subject.name} — {paper.examType.replace("_", " ")}
                  </h1>
                  <p className="text-xs text-slate-500">
                    Section {paper.section.name} · {paper.academicYear.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Total marks indicator */}
                <div className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  Math.abs(totalFromQuestions() - paper.totalMarks) < 0.01
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {totalFromQuestions()} / {paper.totalMarks} marks
                </div>

                 {paper.isFrozen ? (
                  <>
                    <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                      <FaLock size={11} /> Frozen
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleFreeze("unfreeze")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200">
                        Unfreeze
                      </button>
                    )}
                    {/* Edit Text Only button — shown on all frozen papers */}
                    <button
                      onClick={() => setEditTextMode(prev => !prev)}
                      className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-medium transition-all ${
                        isEditingTextOnly
                          ? "bg-orange-500 text-white hover:bg-orange-600 shadow-md"
                          : "border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
                      }`}
                    >
                      <FaPen size={10} />
                      {isEditingTextOnly ? "Exit Text Edit" : "Edit Text Only"}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <FaPrint size={11} /> Print
                    </button>
                    <button
                      onClick={() => router.push(`/faculty/mid-exam/marks/${paper.id}`)}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <FaClipboardList size={11} /> Enter Marks
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
                    >
                      <FaPrint size={11} /> Print Draft
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                      Save Draft
                    </button>
                    <button
                      onClick={() => setShowFreezeModal(true)}
                      className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
                    >
                      <FaLock size={11} /> Freeze Paper
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Linked paper notice */}
          {isLinked && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
              <div className="flex items-start gap-2.5">
                <FaInfoCircle className="mt-0.5 text-blue-500 shrink-0" size={16} />
                <div>
                  <p className="font-semibold text-blue-800 text-sm">Linked Question Paper</p>
                  <p className="text-xs text-blue-700 mt-0.5">This paper is linked to a common master paper. Questions can only be updated on the master paper.</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/faculty/mid-exam/paper/${paper?.masterPaperId}`)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-all shadow-sm shrink-0 w-fit self-start sm:self-center"
              >
                Go to Master Paper
              </button>
            </div>
          )}

          {/* Validation errors */}
          <AnimatePresence>
            {validationErrors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 rounded-xl bg-red-50 p-4 ring-1 ring-red-200"
              >
                <div className="flex items-start gap-2">
                  <FaExclamationTriangle className="mt-0.5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-800">Fix these issues before saving/freezing:</p>
                    <ul className="mt-1 space-y-0.5 text-sm text-red-700">
                      {validationErrors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Frozen notice or Edit Text Only active banner */}
          {paper.isFrozen && (
            isEditingTextOnly ? (
              <div className="mb-6 flex items-start justify-between gap-3 rounded-xl bg-orange-50 p-4 ring-1 ring-orange-300">
                <div className="flex items-start gap-3">
                  <FaPen className="mt-0.5 text-orange-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-orange-800">✏️ Edit Text Only Mode — Active</p>
                    <p className="text-sm text-orange-700 mt-0.5">
                      Only question text can be changed. Marks, CO mapping, BT level and question structure are fully locked.
                      Existing marks data is completely safe.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditTextMode(false)}
                    className="rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTextOnly}
                    disabled={savingText}
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {savingText ? <FaSpinner className="animate-spin" /> : <FaSave />}
                    Save Text Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <FaLock className="text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Paper is frozen</p>
                  <p className="text-sm text-amber-700">This paper is locked for editing. Use <strong>Edit Text Only</strong> to update question wording without touching marks or COs.</p>
                </div>
              </div>
            )
          )}

          {/* Paper Settings (Common/Text) Card */}
          <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200/50 space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 border-b border-slate-100 pb-2">Paper Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Exam Date */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="exam-date-input" className="text-xs font-semibold text-slate-600">Exam Date</label>
                <input
                  id="exam-date-input"
                  type="date"
                  value={paper.examDate || ""}
                  onChange={(e) => {
                    setPaper(prev => prev ? { ...prev, examDate: e.target.value } : null);
                  }}
                  disabled={paper.isFrozen && !isAdmin}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              {/* Common Paper Option (Only editable if NOT linked child paper) */}
              {!isLinked && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Common Question Paper Options</span>
                  <div className="flex items-center gap-4 mt-1.5">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={paper.isCommon}
                        onChange={(e) => {
                          setPaper(prev => prev ? { ...prev, isCommon: e.target.checked } : null);
                        }}
                        disabled={paper.isFrozen && !isAdmin}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Make this a Common Question Paper
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Common Text Input (if isCommon or isLinked) */}
            {(paper.isCommon || isLinked) && (
              <div className="flex flex-col gap-1.5 pt-2">
                <label htmlFor="common-text-input" className="text-xs font-semibold text-slate-600">
                  Common Header Text (Printed on PDF)
                </label>
                <input
                  id="common-text-input"
                  type="text"
                  value={paper.commonText || ""}
                  onChange={(e) => {
                    setPaper(prev => prev ? { ...prev, commonText: e.target.value } : null);
                  }}
                  disabled={paper.isFrozen && !isAdmin}
                  placeholder="e.g., Common for CSE, CSM, CIVIL"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 w-full"
                />
                <p className="text-[11px] text-slate-500">This text will be printed prominently on the question paper PDF (e.g., "COMMON FOR CSE, CSM, CIVIL").</p>
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="mb-6 rounded-xl bg-blue-50 p-4 ring-1 ring-blue-100">
            <div className="flex gap-3">
              <FaInfoCircle className="mt-0.5 text-blue-500" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Question Structure Guide</p>
                <p>• <strong>Compulsory</strong>: Always counted in total marks</p>
                <p>• <strong>Choice Group</strong>: Questions in same group = "OR" choice (system picks best)</p>
                <p>• Total from all compulsory + max(each choice group) must equal <strong>{paper.totalMarks}</strong></p>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <motion.div
                key={qIdx}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
              >
                {/* Question Header */}
                <div
                  className={`flex items-center gap-4 px-6 py-4 cursor-pointer ${
                    q.isCompulsory ? "bg-blue-50/50" : "bg-purple-50/50"
                  }`}
                  onClick={() => setExpandedQ(prev => {
                    const n = new Set(prev);
                    n.has(qIdx) ? n.delete(qIdx) : n.add(qIdx);
                    return n;
                  })}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm ${
                    q.isCompulsory ? "bg-blue-600 text-white" : "bg-purple-600 text-white"
                  }`}>
                    Q{q.questionNo}
                  </div>

                  <div className="flex flex-1 items-center gap-4">
                    <div>
                      <p className="font-medium text-slate-800">Question {q.questionNo}</p>
                      <p className="text-xs text-slate-500">
                        {q.subQuestions.length} subquestion(s) ·
                        Total: {q.subQuestions.reduce((s, sq) => s + sq.maxMarks, 0)} marks
                      </p>
                    </div>
                  </div>

                  {canEditQuestions && (
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {/* Compulsory/Choice toggle */}
                      <select
                        value={q.isCompulsory ? "compulsory" : `choice_${q.choiceGroupNo || 1}`}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === "compulsory") {
                            updateQuestion(qIdx, "isCompulsory", true);
                            updateQuestion(qIdx, "choiceGroupNo", null);
                          } else {
                            const groupNo = parseInt(val.replace("choice_", ""));
                            updateQuestion(qIdx, "isCompulsory", false);
                            updateQuestion(qIdx, "choiceGroupNo", groupNo);
                          }
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="compulsory">Compulsory</option>
                        <option value="choice_1">Choice Group 1 (OR)</option>
                        <option value="choice_2">Choice Group 2 (OR)</option>
                        <option value="choice_3">Choice Group 3 (OR)</option>
                      </select>

                      <button
                        onClick={() => removeQuestion(qIdx)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  )}

                  {expandedQ.has(qIdx) ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                </div>

                {/* Subquestions */}
                <AnimatePresence>
                  {expandedQ.has(qIdx) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-100 p-6">
                        <div className="space-y-4">
                          {q.subQuestions.map((sq, sqIdx) => (
                            <div key={sqIdx} className="rounded-xl bg-slate-50 p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold text-slate-700">
                                  {sq.subLabel}
                                </span>
                                {canEditQuestions && q.subQuestions.length > 1 && (
                                  <button
                                    onClick={() => removeSubQuestion(qIdx, sqIdx)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    <FaTrash size={11} />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                                <div className="sm:col-span-8 space-y-3">
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <label className="block text-xs font-medium text-slate-600">Question Text *</label>
                                      {(canEditQuestions || isEditingTextOnly) && (
                                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const key = `${qIdx}-${sqIdx}`;
                                              const next = new Set(mathModeFields);
                                              next.delete(key);
                                              setMathModeFields(next);
                                            }}
                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                              !mathModeFields.has(`${qIdx}-${sqIdx}`)
                                                ? "bg-white text-slate-800 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                            }`}
                                          >
                                            <span className="flex items-center gap-1"><FaPen className="text-[9px]" /> Text Mode</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const key = `${qIdx}-${sqIdx}`;
                                              const next = new Set(mathModeFields);
                                              next.add(key);
                                              setMathModeFields(next);
                                            }}
                                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                              mathModeFields.has(`${qIdx}-${sqIdx}`)
                                                ? "bg-blue-600 text-white shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                            }`}
                                          >
                                            <span className="flex items-center gap-1">∑ Math Mode</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {mathModeFields.has(`${qIdx}-${sqIdx}`) ? (
                                      /* Visual WYSIWYG Math Equation Editor */
                                      <div className="space-y-2">
                                        <MathFieldEditor
                                          id={`mathfield-${qIdx}-${sqIdx}`}
                                          value={sq.questionText}
                                          onChange={(latex) => updateSubQuestion(qIdx, sqIdx, "questionText", latex)}
                                          disabled={!canEdit && !isEditingTextOnly}
                                          placeholder="Click here and type a math equation visually..."
                                        />
                                        <p className="text-[10px] text-slate-400 italic">Type fractions, integrals, greek letters and more visually. Use the virtual keyboard or type LaTeX directly.</p>
                                      </div>
                                    ) : (
                                      /* Traditional Text Mode with LaTeX helper toolbar */
                                      <>
                                        {(canEditQuestions || isEditingTextOnly) && (
                                          <MathToolbar
                                            onInsert={(latex) => {
                                              const textarea = document.getElementById(`textarea-${qIdx}-${sqIdx}`) as HTMLTextAreaElement;
                                              if (textarea) {
                                                const start = textarea.selectionStart;
                                                const end = textarea.selectionEnd;
                                                const text = sq.questionText;
                                                const before = text.substring(0, start);
                                                const after = text.substring(end, text.length);
                                                const newText = before + latex + after;
                                                updateSubQuestion(qIdx, sqIdx, "questionText", newText);
                                                setTimeout(() => {
                                                  textarea.focus();
                                                  textarea.setSelectionRange(start + latex.length, start + latex.length);
                                                }, 50);
                                              } else {
                                                updateSubQuestion(qIdx, sqIdx, "questionText", sq.questionText + latex);
                                              }
                                            }}
                                          />
                                        )}
                                        <textarea
                                          id={`textarea-${qIdx}-${sqIdx}`}
                                          value={sq.questionText}
                                          onChange={e => updateSubQuestion(qIdx, sqIdx, "questionText", e.target.value)}
                                          disabled={!canEdit && !isEditingTextOnly}
                                          rows={3}
                                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-100 disabled:text-slate-500 font-sans"
                                          placeholder="Enter question text... (Use $...$ for inline math and $$...$$ for block equations)"
                                        />
                                      </>
                                    )}
                                  </div>

                                  {/* Live Preview Box */}
                                  {sq.questionText.trim() && (
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/20 p-3 text-xs text-slate-800">
                                      <p className="text-[10px] font-bold text-blue-500 mb-1.5 uppercase tracking-wider">Live Equation Preview:</p>
                                      <MathRenderer text={sq.questionText} />
                                    </div>
                                  )}
                                </div>

                                <div className="sm:col-span-4 space-y-4">
                                  {/* Diagram Image Selector */}
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Drawing / Circuit Figure (Optional)</label>
                                    {sq.imageUrl ? (
                                      <div className="relative rounded-lg border border-slate-200 bg-white p-2 flex flex-col items-center shadow-sm">
                                        <img
                                          src={sq.imageUrl}
                                          alt={`Q${q.questionNo}(${sq.subLabel}) Figure`}
                                          className="max-h-24 object-contain rounded-md"
                                        />
                                        {(canEditQuestions || isEditingTextOnly) && (
                                          <button
                                            type="button"
                                            onClick={() => updateSubQuestion(qIdx, sqIdx, "imageUrl", null)}
                                            className="absolute top-1 right-1 rounded-full bg-red-100 p-1 text-red-600 hover:bg-red-200 transition-all shadow-sm"
                                            title="Remove Figure"
                                          >
                                            <FaTimes size={10} />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      (canEditQuestions || isEditingTextOnly) ? (
                                        <div className="flex items-center justify-center w-full">
                                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer bg-white hover:bg-slate-50 hover:border-blue-400 transition-all">
                                            <div className="flex flex-col items-center justify-center pt-2 pb-2">
                                              <FaImage className="w-5 h-5 text-slate-400 mb-1" />
                                              <p className="text-[10px] text-slate-500 font-semibold">Click to upload figure</p>
                                              <p className="text-[9px] text-slate-400">PNG, JPG, SVG</p>
                                            </div>
                                            <input
                                              type="file"
                                              className="hidden"
                                              accept="image/*"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 2 * 1024 * 1024) {
                                                    showToast("File size too large. Keep under 2MB.", "error");
                                                    return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    updateSubQuestion(qIdx, sqIdx, "imageUrl", reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                        </div>
                                      ) : (
                                        <div className="flex h-24 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-[11px] text-slate-400 italic">
                                          No figure attached
                                        </div>
                                      )
                                    )}
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-slate-600">Marks *</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={30}
                                        step={1}
                                        value={sq.maxMarks}
                                        onChange={e => {
                                          const val = parseFloat(e.target.value);
                                          updateSubQuestion(qIdx, sqIdx, "maxMarks", isNaN(val) ? 0 : val);
                                        }}
                                        disabled={!canEditQuestions || isEditingTextOnly}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 bg-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-slate-600">CO Mapping</label>
                                      <select
                                        value={sq.coMapping}
                                        onChange={e => updateSubQuestion(qIdx, sqIdx, "coMapping", e.target.value)}
                                        disabled={!canEditQuestions || isEditingTextOnly}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                      >
                                        {getCoOptions().map(co => <option key={co} value={co}>{co}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-xs font-medium text-slate-600">BT Level</label>
                                      <select
                                        value={sq.btLevel}
                                        onChange={e => updateSubQuestion(qIdx, sqIdx, "btLevel", e.target.value)}
                                        disabled={!canEditQuestions || isEditingTextOnly}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                                      >
                                        {BT_LEVEL_OPTIONS.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {canEditQuestions && (
                          <button
                            onClick={() => addSubQuestion(qIdx)}
                            className="mt-3 flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                          >
                            <FaPlus size={10} /> Add Subquestion
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {/* Add Question */}
          {canEditQuestions && (
            <button
              onClick={addQuestion}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-4 text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
            >
              <FaPlus /> Add Question
            </button>
          )}

          {/* Bottom action bar */}
          {canEdit && (
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                {isLinked ? "Save Details" : "Save Draft"}
              </button>
              {!paper.isFrozen && (
                <button
                  onClick={() => setShowFreezeModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-medium text-white hover:bg-amber-600"
                >
                  <FaLock /> Freeze & Finalize
                </button>
              )}
            </div>
          )}
        </div>

        {/* Freeze Confirmation Modal */}
        <Modal isOpen={showFreezeModal} onClose={() => setShowFreezeModal(false)} title="Freeze Question Paper" maxWidth="max-w-md">
          <div className="p-6">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 p-4">
              <FaLock className="text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800">This action is important</p>
                <p className="text-sm text-amber-700">After freezing, no further edits are allowed without admin override. Faculty can then enter student marks.</p>
              </div>
            </div>
            {!isLinked && (
              <p className="mb-6 text-sm text-slate-600">
                Total marks: <strong>{totalFromQuestions()}</strong> (Paper total: {paper.totalMarks})
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowFreezeModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button
                onClick={() => handleFreeze("freeze")}
                disabled={freezing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {freezing ? <FaSpinner className="animate-spin" /> : <FaLock />}
                Freeze Paper
              </button>
            </div>
          </div>
        </Modal>

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}>
            {toast.msg}
          </div>
        )}
      </div>

      {/* Printable Area - Only visible when printing (Times New Roman layout) */}
      <div className="hidden print:block font-serif text-black p-0 bg-white leading-tight printable-paper-area" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Style tag to ensure landscape printing and hide all website navigation */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              height: 100%;
            }
            body {
              visibility: hidden !important;
            }
            .printable-paper-area, .printable-paper-area * {
              visibility: visible !important;
            }
            .printable-paper-area {
              visibility: visible !important;
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            nav, header, footer, button, .no-print, [role="navigation"], .print\\:hidden {
              display: none !important;
              height: 0 !important;
              overflow: hidden !important;
            }
            @page {
              size: A4 landscape;
              margin: 6mm !important;
            }
          }
        `}} />

        {/* Dynamic Double Column side-by-side Landscape booklet layout */}
        {(() => {
          // Reusable Paper Content Renderer for perfect side-by-side alignment
          const renderPaperCopy = () => {
            // Flatten all subquestions to construct the columns
            const cols: { qNo: number; subLabel: string; co: string }[] = [];
            questions.forEach((q) => {
              q.subQuestions.forEach((sq) => {
                const cleanCo = sq.coMapping.replace(/[^0-9]/g, "") || sq.coMapping;
                cols.push({
                  qNo: q.questionNo,
                  subLabel: sq.subLabel,
                  co: cleanCo,
                });
              });
            });

            // Calculate colspans per top-level question
            const qSpans: { qNo: number; span: number }[] = [];
            questions.forEach((q) => {
              const qCols = cols.filter(c => c.qNo === q.questionNo);
              if (qCols.length > 0) {
                qSpans.push({ qNo: q.questionNo, span: qCols.length });
              }
            });

            return (
              <div className="flex flex-col text-[10px] font-serif text-black leading-tight">
                {/* Registration Number boxes */}
                <div className="flex justify-end items-center gap-1.5 mb-1">
                  <span className="text-[9.5px] font-bold">Regd No:</span>
                  <div className="flex" style={{ border: "1.5px solid black" }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="bg-white" style={{
                        width: "15px",
                        height: "15px",
                        borderRight: i < 9 ? "1.5px solid black" : "none"
                      }}></div>
                    ))}
                  </div>
                </div>

                {/* Institution Title Header */}
                <div className="text-center mb-1">
                  <h2 className="text-[11px] font-bold leading-normal">Gayatri Vidya Parishad College for Degree and P G Courses (A)</h2>
                  <h3 className="text-[10.5px] font-bold leading-normal">Engineering and Technology Program</h3>
                  <p className="text-[9px] font-semibold tracking-wide text-gray-700">Rushikonda, Visakhapatnam-530 045</p>
                  
                  {paper.commonText && (
                    <p className="text-[9.5px] font-bold tracking-wider mt-0.5 uppercase border-y border-black py-0.5">{paper.commonText}</p>
                  )}
                  
                  <div className="flex justify-between items-center text-[10px] font-bold px-2 mt-1">
                    <span>{paper.year === "I" ? "I" : paper.year === "II" ? "II" : paper.year === "III" ? "III" : paper.year === "IV" ? "IV" : paper.year} B. Tech</span>
                    <span>Branch: {paper.subject.department?.code || "CSE"}</span>
                    <span>Semester - {paper.semester}</span>
                  </div>
                </div>

                {/* Course Details Grid Table */}
                <table className="w-full border-collapse text-left text-[9.5px] font-bold mb-1" style={{ border: "1.5px solid black" }}>
                  <tbody>
                    <tr>
                      {/* Course Title */}
                      <td className="p-0.5 pl-1" style={{ width: "16%", borderRight: "1px solid black", borderBottom: "1px solid black" }}>Course Title</td>
                      <td className="p-0.5 pl-1 uppercase font-bold truncate max-w-[120px]" style={{ width: "22%", borderRight: "1.2px solid black", borderBottom: "1px solid black" }}>
                        {paper.subject.name}
                      </td>
                      {/* MID Label */}
                      <td className="p-0.5 text-center font-bold text-xs" rowSpan={3} style={{ width: "24%", borderRight: "1.2px solid black", verticalAlign: "middle" }}>
                        {paper.examType === "MID_I" ? "MID-I" : "MID-II"}
                      </td>
                      {/* Course Code */}
                      <td className="p-0.5 pl-1" style={{ width: "16%", borderRight: "1px solid black", borderBottom: "1px solid black" }}>Course Code</td>
                      <td className="p-0.5 pl-1 uppercase font-bold truncate max-w-[120px]" style={{ width: "22%", borderBottom: "1px solid black" }}>
                        {paper.subject.code}
                      </td>
                    </tr>
                    <tr>
                      {/* Date */}
                      <td className="p-0.5 pl-1" style={{ borderRight: "1px solid black", borderBottom: "1px solid black" }}>Date</td>
                      <td className="p-0.5 pl-1 font-serif text-[10px]" style={{ borderRight: "1.2px solid black", borderBottom: "1px solid black" }}>
                        {formatDate(paper.examDate) || "____________________"}
                      </td>
                      {/* Academic Year */}
                      <td className="p-0.5 pl-1" style={{ borderRight: "1px solid black", borderBottom: "1px solid black" }}>Academic Year</td>
                      <td className="p-0.5 pl-1" style={{ borderBottom: "1px solid black" }}>{paper.academicYear.name}</td>
                    </tr>
                    <tr>
                      {/* Time */}
                      <td className="p-0.5 pl-1" style={{ borderRight: "1px solid black" }}>Time</td>
                      <td className="p-0.5 pl-1" style={{ borderRight: "1.2px solid black" }}>90 min</td>
                      {/* Max Marks */}
                      <td className="p-0.5 pl-1" style={{ borderRight: "1px solid black" }}>Max. Marks</td>
                      <td className="p-0.5 pl-1">{paper.totalMarks}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signature of Invigilator line */}
                <div className="relative text-right text-[9.5px] font-bold mb-1.5 px-1">
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 font-bold">|</div>
                  Signature of Invigilator: ___________________________
                </div>

                {/* Dynamic Marks Grid Table */}
                {cols.length > 0 && (
                  <table className="w-full border-collapse text-center text-[9px] font-bold mb-1" style={{ border: "1.2px solid black" }}>
                    <tbody>
                      {/* Row 1: Top-level Question numbers */}
                      <tr style={{ borderBottom: "1.2px solid black" }}>
                        <td className="p-0.5" rowSpan={2} style={{ width: "60px", borderRight: "1.2px solid black" }}></td>
                        {qSpans.map((qs, i) => (
                          <td key={i} colSpan={qs.span} style={{ borderRight: "1.2px solid black" }} className="p-0.5">
                            {qs.qNo}
                          </td>
                        ))}
                        <td className="p-0.5 text-[8.5px]" rowSpan={2} style={{ width: "60px" }}>Total Marks</td>
                      </tr>

                      {/* Row 2: Sub-question letters */}
                      <tr style={{ borderBottom: "1.2px solid black" }}>
                        {cols.map((col, i) => (
                          <td key={i} style={{ borderRight: "1.2px solid black" }} className="p-0.5 text-[8.5px]">
                            {col.subLabel}
                          </td>
                        ))}
                      </tr>

                      {/* Row 3: Course Outcomes (CO) */}
                      <tr style={{ borderBottom: "1.2px solid black" }}>
                        <td style={{ borderRight: "1.2px solid black" }} className="p-0.5">CO</td>
                        {cols.map((col, i) => (
                          <td key={i} style={{ borderRight: "1.2px solid black" }} className="p-0.5 text-[8.5px]">
                            {col.co}
                          </td>
                        ))}
                        <td className="p-0.5"></td>
                      </tr>

                      {/* Row 4: Marks blank fields */}
                      <tr>
                        <td style={{ borderRight: "1.2px solid black" }} className="p-0.5">Marks</td>
                        {cols.map((_, i) => (
                          <td key={i} style={{ borderRight: "1.2px solid black" }} className="p-0.5 h-4.5"></td>
                        ))}
                        <td className="p-0.5"></td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Student & Faculty Signatures */}
                <div className="flex justify-between items-center text-[9.5px] font-bold mb-1.5 px-1" style={{ marginTop: "24px" }}>
                  <span>Signature of the student</span>
                  <span>Signature of the faculty</span>
                </div>

                {/* Main Instruction Heading with dynamic marks formula */}
                <div className="text-center font-bold text-[10.5px] my-1 border-b border-black pb-1 relative">
                  <u>Answer All Questions</u>
                  <span className="absolute right-0 bottom-1 text-[9.5px] font-bold">
                    {(() => {
                      const q1 = questions.find(q => q.questionNo === 1);
                      if (q1) {
                        const count = q1.subQuestions.length;
                        const each = q1.subQuestions[0]?.maxMarks || 2;
                        return `${count}x${each}=${count * each}M`;
                      }
                      return "3x2=6M";
                    })()}
                  </span>
                </div>

                {/* Printable Questions List */}
                <div className="space-y-0.5">
                  {(() => {
                    const elements: React.ReactNode[] = [];
                    let lastChoiceGroup: number | null | undefined = undefined;

                    questions.forEach((q, idx) => {
                      // Standard italic divider
                      if (!q.isCompulsory && q.choiceGroupNo && lastChoiceGroup === q.choiceGroupNo) {
                        elements.push(
                          <div key={`or-${idx}`} className="text-center font-bold my-0.5 text-[10px] italic">
                            (or)
                          </div>
                        );
                      }

                      lastChoiceGroup = q.choiceGroupNo;

                      // Long-answers header
                      if (q.questionNo === 2) {
                        elements.push(
                          <div key="long-answers-header" className="flex justify-end text-[9.5px] font-bold my-0.5">
                            {(() => {
                              const choiceQuestions = questions.filter(curr => !curr.isCompulsory);
                              const uniqueGroups = new Set(choiceQuestions.map(curr => curr.choiceGroupNo).filter(Boolean));
                              const groupCount = uniqueGroups.size || 2;
                              const representativeQ = choiceQuestions.find(curr => curr.choiceGroupNo === Array.from(uniqueGroups)[0]);
                              const maxMarks = representativeQ ? representativeQ.subQuestions.reduce((s, sq) => s + sq.maxMarks, 0) : 12;
                              return `${groupCount}x${maxMarks}=${groupCount * maxMarks}M`;
                            })()}
                          </div>
                        );
                      }

                      elements.push(
                        <div key={`print-q-${idx}`} className="space-y-0.5">
                          <div className="space-y-0.5">
                            {q.subQuestions.map((sq, sqIdx) => {
                              const isFirst = sqIdx === 0;
                              return (
                                <div key={sqIdx} className="space-y-0.5 py-0.25">
                                  <div className="flex items-start text-[10px]">
                                    {/* Merged question number and subquestion letter for compact layout */}
                                    <span className="flex shrink-0 font-bold" style={{ width: "36px" }}>
                                      {isFirst ? (
                                        <>
                                          <span style={{ width: "18px" }}>{q.questionNo}.</span>
                                          <span style={{ width: "18px" }}>{sq.subLabel})</span>
                                        </>
                                      ) : (
                                        <>
                                          <span style={{ width: "18px" }}></span>
                                          <span style={{ width: "18px" }}>{sq.subLabel})</span>
                                        </>
                                      )}
                                    </span>
                                    <div className="flex-1 pr-4 text-justify">
                                      <MathRenderer text={sq.questionText} className="inline font-serif text-black text-[10px] leading-tight" />
                                      <span className="font-bold ml-1">[{sq.maxMarks}M] [{sq.btLevel}]</span>
                                    </div>
                                  </div>
                                  {sq.imageUrl && (
                                    <div className="pl-9 pb-0.5 text-center">
                                      <img
                                        src={sq.imageUrl}
                                        alt={`Figure Q${q.questionNo}(${sq.subLabel})`}
                                        className="max-h-[80px] mx-auto object-contain border border-black/10 p-0.5 bg-white print:border-none"
                                      />
                                      <p className="text-[7.5px] font-bold uppercase tracking-wider mt-0.5 text-gray-700">
                                        Figure Q{q.questionNo}({sq.subLabel})
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });

                    return elements;
                  })()}
                </div>

                {/* Center aligned All the Best Footer */}
                <div className="text-center font-bold text-[9.5px] mt-2 italic tracking-widest">
                  ******All the Best*****
                </div>
              </div>
            );
          };

          return (
            <div className="grid grid-cols-2 gap-8 w-full h-full p-2 bg-white" style={{ minHeight: "100%" }}>
              {/* Left Column (Copy 1 / Page 1) */}
              <div className="pr-4" style={{ borderRight: "1px dashed #777" }}>
                {renderPaperCopy()}
              </div>
              
              {/* Right Column (Copy 2 / Page 2) */}
              <div className="pl-4">
                {renderPaperCopy()}
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
