"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

interface Semester {
  year: string;
  semester: string;
  label: string;
}

export default function StudentMidMarksPage() {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [availableSemesters, setAvailableSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<{ year: string; semester: string } | null>(null);
  const [marks, setMarks] = useState<SubjectMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMarks, setFetchingMarks] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/mid-marks")
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setStudent(data.student);
        setAvailableSemesters(data.availableSemesters || []);
        setActiveSemester(data.selectedSemester || null);
        setMarks(data.marks || []);
        if (data.marks && data.marks.length > 0) {
          setSelectedSubject(data.marks[0].subjectId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSemesterChange = (sem: Semester) => {
    if (activeSemester?.year === sem.year && activeSemester?.semester === sem.semester) return;

    setFetchingMarks(true);
    setActiveSemester({ year: sem.year, semester: sem.semester });

    fetch(`/api/student/mid-marks?year=${sem.year}&semester=${sem.semester}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setMarks(data.marks || []);
        if (data.marks && data.marks.length > 0) {
          setSelectedSubject(data.marks[0].subjectId);
        } else {
          setSelectedSubject(null);
        }
      })
      .catch(() => {})
      .finally(() => setFetchingMarks(false));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  if (!student) return <div className="flex min-h-screen items-center justify-center text-slate-500">Marks profile not loaded.</div>;

  const currentSubject = marks.find(m => m.subjectId === selectedSubject);

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
      {/* Title & Semester Selector */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">My Continuous Internal Evaluation (CIE)</h1>
          <p className="mt-1 text-sm text-slate-500">
            View real-time MID examinations and assignment scores for{" "}
            <span className="font-bold text-blue-600">Semester {activeSemester?.year}-{activeSemester?.semester}</span>
          </p>
        </div>

        {/* Semester Selector Tabs */}
        {availableSemesters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200/50 print:hidden self-start md:self-auto">
            {availableSemesters.map(sem => {
              const isActive = activeSemester?.year === sem.year && activeSemester?.semester === sem.semester;
              return (
                <button
                  key={`${sem.year}-${sem.semester}`}
                  onClick={() => handleSemesterChange(sem)}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/40"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {sem.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid Summary */}
      <div className="relative min-h-[400px]">
        {fetchingMarks && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/40 backdrop-blur-[1px] rounded-3xl">
            <LogoSpinner fullScreen={false} />
          </div>
        )}

        {marks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 text-center shadow-sm">
            <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-4 border border-slate-100">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 text-lg">No Subjects Found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">No registered subjects or marks records were found for Semester {activeSemester?.year}-{activeSemester?.semester}.</p>
          </div>
        ) : (
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
                        {typeof m.calculatedInternal === "number" ? `${m.calculatedInternal} marks` : m.calculatedInternal}
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
                        <p className="text-xs text-slate-500 mt-1">
                          {typeof currentSubject.calculatedInternal === "number"
                            ? "Computed as: (MID I scale-out + MID II scale-out) / 2 + Assignment score"
                            : "Marks will be calculated once all exams are published"}
                        </p>
                      </div>
                    </div>

                  </motion.div>
                ) : (
                  <div className="text-center py-12 text-slate-400">Select a subject from the left panel.</div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
