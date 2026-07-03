"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft, FaSave, FaSpinner, FaClipboardList, FaInfoCircle
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface LabRow {
  studentId: string;
  rollNumber: string;
  name: string;
  marksObtained: number | null;
  maxMarks: number;
}

function LabMarksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const subjectId = searchParams ? searchParams.get("subjectId") : null;
  const sectionId = searchParams ? searchParams.get("sectionId") : null;
  const year = searchParams ? searchParams.get("year") : null;
  const semester = searchParams ? searchParams.get("semester") : null;
  const academicYearId = searchParams ? searchParams.get("ayId") : null;

  const { data: session } = useSession();

  const [rows, setRows] = useState<LabRow[]>([]);
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
        fetch(`/api/mid-exam/lab?academicYearId=${academicYearId}&departmentId=${(session?.user as any).departmentId}&year=${year}&semester=${semester}&sectionId=${sectionId}&subjectId=${subjectId}`),
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
      showToast("Error loading lab marks", "error");
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

  const handleSave = async () => {
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
      const res = await fetch("/api/mid-exam/lab", {
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
        })
      });

      if (res.ok) {
        showToast("Lab internal marks saved successfully!", "success");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-purple-100 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-bold text-slate-900">Lab Internal Marks</h1>
                <p className="text-xs text-slate-500">
                  {subjectInfo?.name} ({subjectInfo?.code}) · Section {sectionInfo?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-purple-100 hover:bg-purple-700 disabled:opacity-50 transition-all"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save Internal Marks
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Info Box */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-purple-50 p-4 ring-1 ring-purple-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-purple-500 flex-shrink-0" />
          <div className="text-sm text-purple-800">
            <p className="font-semibold">Lab Marks Guidelines</p>
            <p>Direct entry for Practical/Lab Internal marks. Maximum marks is <strong>50 marks</strong> per student. Use arrow keys <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↑</kbd> <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↓</kbd> or <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">Enter</kbd> to quickly navigate vertically.</p>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-100">
          <div className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No active students in this section.</div>
            ) : (
              rows.map((row, idx) => (
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
                        className="w-28 rounded-xl border border-purple-200 px-3 py-2 text-center text-sm font-bold focus:outline-none focus:ring-4 focus:ring-purple-100 hover:border-purple-300 focus:border-purple-500 text-slate-800"
                        placeholder="-"
                        min={0}
                        max={row.maxMarks}
                        step={0.5}
                      />
                      <span className="text-xs text-slate-400 font-medium">/ {row.maxMarks}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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

export default function LabMarksPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>}>
      <LabMarksContent />
    </Suspense>
  );
}
