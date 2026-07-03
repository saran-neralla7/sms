"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft, FaSave, FaCheck, FaSpinner, FaClipboardList, FaInfoCircle
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface AssignmentRow {
  studentId: string;
  rollNumber: string;
  name: string;
  marksObtained: number | null;
  maxMarks: number;
  isDraft: boolean;
}

function AssignmentMarksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const subjectId = searchParams ? searchParams.get("subjectId") : null;
  const sectionId = searchParams ? searchParams.get("sectionId") : null;
  const year = searchParams ? searchParams.get("year") : null;
  const semester = searchParams ? searchParams.get("semester") : null;
  const academicYearId = searchParams ? searchParams.get("ayId") : null;

  const { data: session } = useSession();

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<{ name: string; code: string } | null>(null);
  const [sectionInfo, setSectionInfo] = useState<{ name: string } | null>(null);

  // Keyboard navigation refs
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!subjectId || !sectionId || !academicYearId) return;

    try {
      const [marksRes, subjectRes, sectionRes] = await Promise.all([
        fetch(`/api/mid-exam/assignment?academicYearId=${academicYearId}&departmentId=${(session?.user as any).departmentId}&year=${year}&semester=${semester}&sectionId=${sectionId}&subjectId=${subjectId}`),
        fetch(`/api/subjects?id=${subjectId}`),
        fetch(`/api/sections?id=${sectionId}`)
      ]);

      if (marksRes.ok) {
        const data = await marksRes.json();
        setRows(data.rows || []);
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
  }, [subjectId, sectionId, academicYearId, year, semester, session]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

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
          academicYearId,
          departmentId: (session?.user as any).departmentId,
          year,
          semester,
          sectionId,
          subjectId,
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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-bold text-slate-900">Assignment Marks</h1>
                <p className="text-xs text-slate-500">
                  {subjectInfo?.name} ({subjectInfo?.code}) · Section {sectionInfo?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save Draft
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <FaCheck /> Submit Final
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Info Box */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Assignment Assessment Guidelines</p>
            <p>Maximum marks for Assignment is <strong>10 marks</strong> per student. Use arrow keys <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↑</kbd> <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↓</kbd> or <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">Enter</kbd> to quickly navigate vertically.</p>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-100">
          <div className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <div
                key={row.studentId}
                className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-1" title={row.name}>
                  <p className="font-bold text-slate-900 text-sm font-mono leading-tight">{row.rollNumber}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[200px] leading-tight">{row.name}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      ref={el => {
                        inputRefs.current[row.studentId] = el;
                      }}
                      type="number"
                      value={row.marksObtained === null ? "" : row.marksObtained}
                      onChange={e => handleMarksChange(row.studentId, e.target.value)}
                      onKeyDown={e => handleKeyDown(e, idx)}
                      className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-slate-300 focus:border-blue-500 text-slate-800"
                      placeholder="-"
                      min={0}
                      max={row.maxMarks}
                      step={0.5}
                    />
                    <span className="text-xs text-slate-400">/ {row.maxMarks}</span>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    row.isDraft
                      ? "bg-slate-100 text-slate-600"
                      : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {row.isDraft ? "Draft" : "Final"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons at the bottom */}
        <div className="mt-6 flex justify-end gap-2 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-sm">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
            Save Draft
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <FaCheck /> Submit Final
          </button>
        </div>
      </div>

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
