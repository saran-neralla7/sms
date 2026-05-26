"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlus, FaTrash, FaLock, FaUnlock, FaSpinner, FaSave,
  FaChevronDown, FaChevronUp, FaInfoCircle, FaCheck, FaExclamationTriangle,
  FaArrowLeft, FaPen, FaClipboardList, FaPrint
} from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";

interface SubQuestion {
  id?: string;
  subLabel: string;
  questionText: string;
  maxMarks: number;
  coMapping: string;
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
  subject: { name: string; code: string; type: string };
  section: { name: string };
  academicYear: { name: string };
  scheme: any;
  questions: any[];
  publishRecord: { isLocked: boolean; isPublished: boolean } | null;
}

const CO_OPTIONS = ["CO1", "CO2", "CO3", "CO4", "CO5", "CO6", "CO7", "CO8", "CO9", "CO10"];

export default function QuestionPaperBuilderPage() {
  const params = useParams();
  const id = params ? (params.id as string) : "";
  const router = useRouter();
  const { data: session } = useSession();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [expandedQ, setExpandedQ] = useState<Set<number>>(new Set([0]));

  const role = (session?.user as any)?.role;
  const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);
  const canEdit = !paper?.isFrozen || isAdmin;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

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
          maxMarks: sq.maxMarks,
          coMapping: sq.coMapping,
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
    subQuestions: [{ subLabel: "a", questionText: "", maxMarks: 5, coMapping: "CO1" }]
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
    const newSq: SubQuestion = { subLabel: nextLabel, questionText: "", maxMarks: 5, coMapping: "CO1" };
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
    const errors = validate();
    if (errors.length > 0) { setValidationErrors(errors); return; }
    setValidationErrors([]);
    setSaving(true);
    try {
      const res = await fetch(`/api/mid-exam/papers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, totalMarks: paper?.totalMarks })
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

  const handleFreeze = async (action: "freeze" | "unfreeze") => {
    if (action === "freeze") {
      const errors = validate();
      if (errors.length > 0) { setValidationErrors(errors); setShowFreezeModal(false); return; }
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

          {/* Frozen notice */}
          {paper.isFrozen && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <FaLock className="text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Paper is frozen</p>
                <p className="text-sm text-amber-700">This paper is locked for editing. You can now enter student marks.</p>
              </div>
            </div>
          )}

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

                  {canEdit && (
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
                                {canEdit && q.subQuestions.length > 1 && (
                                  <button
                                    onClick={() => removeSubQuestion(qIdx, sqIdx)}
                                    className="text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    <FaTrash size={11} />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                                <div className="sm:col-span-6">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">Question Text *</label>
                                  <textarea
                                    value={sq.questionText}
                                    onChange={e => updateSubQuestion(qIdx, sqIdx, "questionText", e.target.value)}
                                    disabled={!canEdit}
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                                    placeholder="Enter question text..."
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">Max Marks *</label>
                                  <input
                                    type="number"
                                    value={sq.maxMarks}
                                    onChange={e => updateSubQuestion(qIdx, sqIdx, "maxMarks", parseFloat(e.target.value) || 0)}
                                    disabled={!canEdit}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                    min={0.5}
                                    step={0.5}
                                  />
                                </div>
                                <div className="sm:col-span-3">
                                  <label className="mb-1 block text-xs font-medium text-slate-600">CO Mapping</label>
                                  <select
                                    value={sq.coMapping}
                                    onChange={e => updateSubQuestion(qIdx, sqIdx, "coMapping", e.target.value)}
                                    disabled={!canEdit}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                                  >
                                    {CO_OPTIONS.map(co => <option key={co} value={co}>{co}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {canEdit && (
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
          {canEdit && (
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
                Save Draft
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
            <p className="mb-6 text-sm text-slate-600">
              Total marks: <strong>{totalFromQuestions()}</strong> (Paper total: {paper.totalMarks})
            </p>
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
      <div className="hidden print:block font-serif text-black p-10 bg-white leading-relaxed" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Style tag to ensure crisp printing styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4;
              margin: 20mm;
            }
            body {
              background: white !important;
              color: black !important;
            }
          }
        `}} />

        {/* Institution Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h2 className="text-lg font-bold uppercase tracking-wide">GAYATRI VIDYA PARISHAD COLLEGE OF ENGINEERING (Autonomous)</h2>
          <p className="text-xs font-semibold text-gray-800">Madhurawada, Visakhapatnam - 530048</p>
          <h3 className="text-base font-bold mt-3 uppercase border border-black inline-block px-6 py-1.5">
            {paper.examType === "MID_I" ? "MID-TERM I" : "MID-TERM II"} EXAMINATIONS
          </h3>
          
          <div className="grid grid-cols-2 gap-y-1.5 text-left mt-6 text-xs font-semibold">
            <div>Class & Semester: B.Tech {paper.year} Yr - Sem {paper.semester}</div>
            <div className="text-right">Academic Year: {paper.academicYear.name}</div>
            <div>Subject: {paper.subject.name} ({paper.subject.code})</div>
            <div className="text-right">Max. Marks: {paper.totalMarks} Marks</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6 text-xs font-semibold italic border-b border-gray-300 pb-2">
          <span>Instructions: Answer all compulsory questions. For choice questions, answer either one of the choices.</span>
        </div>

        {/* Printable Questions List */}
        <div className="space-y-6">
          {(() => {
            const elements: React.ReactNode[] = [];
            let lastChoiceGroup: number | null | undefined = undefined;

            questions.forEach((q, idx) => {
              if (!q.isCompulsory && q.choiceGroupNo && lastChoiceGroup === q.choiceGroupNo) {
                elements.push(
                  <div key={`or-${idx}`} className="text-center font-bold my-4 text-xs italic tracking-widest uppercase">
                    (OR)
                  </div>
                );
              }

              lastChoiceGroup = q.choiceGroupNo;

              elements.push(
                <div key={`print-q-${idx}`} className="space-y-2">
                  <div className="flex font-bold text-xs uppercase">
                    <span className="w-8">Q{q.questionNo}.</span>
                    <span className="flex-1">
                      {q.isCompulsory ? "" : `[Choice Group ${q.choiceGroupNo}]`}
                    </span>
                  </div>

                  <div className="pl-8 space-y-3">
                    {q.subQuestions.map((sq, sqIdx) => (
                      <div key={sqIdx} className="flex items-start text-xs">
                        <span className="w-6 font-bold">({sq.subLabel})</span>
                        <p className="flex-1 pr-6 leading-relaxed text-justify">{sq.questionText}</p>
                        <span className="whitespace-nowrap font-bold text-right">
                          [{sq.maxMarks}M · {sq.coMapping}]
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });

            return elements;
          })()}
        </div>
      </div>
    </>
  );
}
