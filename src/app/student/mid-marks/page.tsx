"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBookOpen, FaAward, FaCalendarAlt, FaChartLine, FaCheckCircle,
  FaFileInvoice, FaArrowLeft, FaInfoCircle, FaPrint
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface StudentInfo {
  name: string;
  rollNumber: string;
  year: string;
  semester: string;
}

interface SubjectMark {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  mid1: string;
  mid2: string;
  assignment: number;
  calculatedInternal: number;
  coPerformance: Record<string, { obtained: number; max: number; percentage: number }>;
}

export default function StudentMidMarksPage() {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [marks, setMarks] = useState<SubjectMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/mid-marks")
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setStudent(data.student);
        setMarks(data.marks || []);
        if (data.marks && data.marks.length > 0) {
          setSelectedSubject(data.marks[0].subjectId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  if (!student) return <div className="flex min-h-screen items-center justify-center text-slate-500">Marks profile not loaded.</div>;

  const currentSubject = marks.find(m => m.subjectId === selectedSubject);

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
      {/* Title */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">My Continuous Internal Evaluation (CIE)</h1>
          <p className="mt-1 text-sm text-slate-500">View real-time MID examinations, assignment scores, and CO-wise academic progress</p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm print:hidden"
        >
          <FaPrint /> Print CIE Memo
        </button>
      </div>

      {/* Grid Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Subject Selector List */}
        <div className="lg:col-span-1 space-y-4 print:hidden">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Registered Subjects</h3>
          <div className="space-y-3">
            {marks.map(m => (
              <button
                key={m.subjectId}
                onClick={() => setSelectedSubject(m.subjectId)}
                className={`w-full text-left p-4 rounded-2xl border transition-all ${
                  selectedSubject === m.subjectId
                    ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className={`text-xs font-bold uppercase ${selectedSubject === m.subjectId ? "text-blue-200" : "text-slate-400"}`}>
                  {m.subjectCode}
                </p>
                <p className="font-bold mt-1 text-sm truncate">{m.subjectName}</p>
                <div className="mt-3 flex justify-between items-center text-xs font-semibold">
                  <span>Final Internal</span>
                  <span className={`px-2 py-0.5 rounded-lg ${
                    selectedSubject === m.subjectId ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
                  }`}>
                    {m.calculatedInternal} marks
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Detailed Breakdown Card */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {currentSubject ? (
              <motion.div
                key={currentSubject.subjectId}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-8"
              >
                {/* Header info */}
                <div>
                  <span className="font-mono text-sm font-bold text-blue-600">{currentSubject.subjectCode}</span>
                  <h2 className="text-2xl font-bold text-slate-900 mt-1">{currentSubject.subjectName}</h2>
                </div>

                {/* Score breakdown metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">MID-I Exam</span>
                    <span className="text-xl font-bold text-slate-800 mt-2">{currentSubject.mid1}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">MID-II Exam</span>
                    <span className="text-xl font-bold text-slate-800 mt-2">{currentSubject.mid2}</span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Assignment Mark</span>
                    <span className="text-xl font-bold text-slate-800 mt-2">{currentSubject.assignment} / 10</span>
                  </div>
                </div>

                {/* Scaled Final Internal Gauge */}
                <div className="flex items-center gap-6 rounded-2xl bg-blue-50/50 p-6 border border-blue-50">
                  <div className="h-16 w-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-200 shrink-0">
                    {currentSubject.calculatedInternal}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Final Internal Mark</h4>
                    <p className="text-xs text-slate-500 mt-1">Computed as: (MID I scale-out + MID II scale-out) / 2 + Assignment score</p>
                  </div>
                </div>

                {/* CO-wise Analytics progress bars */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <FaChartLine /> Outcome-Based Education (OBE) Metrics
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(currentSubject.coPerformance).map(([co, data]: [string, any]) => (
                      <div key={co} className="rounded-xl border border-slate-100 p-4 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-700">{co} Attainment</span>
                          <span className="text-blue-600">{data.percentage}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${data.percentage}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Scored {data.obtained} out of {data.max} mapped question marks.</p>
                      </div>
                    ))}
                    {Object.keys(currentSubject.coPerformance).length === 0 && (
                      <p className="text-slate-400 text-xs italic col-span-full">No granular outcome mappings available for this subject.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-12 text-slate-400">Select a subject from the left panel.</div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
