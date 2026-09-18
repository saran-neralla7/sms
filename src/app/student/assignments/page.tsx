"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaTasks,
  FaCalendarAlt,
  FaCheckCircle,
  FaHourglassHalf,
  FaBook,
  FaClock,
  FaLayerGroup,
  FaInfoCircle
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function StudentAssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/student/assignments");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.assignments?.length > 0) {
          setSelectedAssignment(json.assignments[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  const assignments = data?.assignments || [];

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <FaTasks className="text-purple-600" /> My Subject Assignments
          </h1>
          <p className="text-sm text-slate-500">
            View assignment instructions, questions, submission deadlines, and evaluation status.
          </p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-purple-600">
            <FaTasks size={24} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">No Assignments Posted Yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Your faculty have not scheduled or published any assignments for this semester yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left List */}
          <div className="space-y-4 lg:col-span-1">
            {assignments.map((a: any) => {
              const isSelected = selectedAssignment?.id === a.id;
              const isSubmitted = a.myStatus === "SUBMITTED";

              let deadlineText = "No deadline set";
              let isOverdue = false;
              if (a.dueDate) {
                const due = new Date(a.dueDate);
                const now = new Date();
                isOverdue = due < now;
                deadlineText = due.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                });
              }

              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedAssignment(a)}
                  className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                    isSelected
                      ? "border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700">
                      {a.subject?.shortName || a.subject?.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        isSubmitted
                          ? "bg-emerald-100 text-emerald-700"
                          : isOverdue
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isSubmitted ? (
                        <>
                          <FaCheckCircle size={10} /> Submitted
                        </>
                      ) : (
                        <>
                          <FaHourglassHalf size={10} /> Pending
                        </>
                      )}
                    </span>
                  </div>

                  <h3 className="mt-3 font-bold text-slate-900 line-clamp-1">{a.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{a.subject?.name}</p>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FaCalendarAlt className={isOverdue ? "text-red-500" : "text-slate-400"} />
                      {deadlineText}
                    </span>
                    <span className="font-bold text-slate-700">Max: {a.totalMarks}M</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Detail Pane */}
          <div className="lg:col-span-2">
            {selectedAssignment ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">
                        {selectedAssignment.subject?.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        Section {selectedAssignment.section?.name}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-black text-slate-900">
                      {selectedAssignment.title}
                    </h2>
                    <p className="text-sm font-medium text-slate-600">
                      {selectedAssignment.subject?.name}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-xs text-slate-500">Assignment Evaluation</span>
                    <span className="text-2xl font-black text-purple-600">
                      {selectedAssignment.myMarksObtained !== null
                        ? `${selectedAssignment.myMarksObtained} / ${selectedAssignment.totalMarks}`
                        : `-- / ${selectedAssignment.totalMarks}`}
                    </span>
                  </div>
                </div>

                {/* Deadlines & Info Cards */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <FaCalendarAlt />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Submission Due Date</p>
                      <p className="text-sm font-bold text-slate-900">
                        {selectedAssignment.dueDate
                          ? new Date(selectedAssignment.dueDate).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })
                          : "No Deadline Specified"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <FaCheckCircle />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">My Status</p>
                      <p className="text-sm font-bold text-slate-900">
                        {selectedAssignment.myStatus === "SUBMITTED"
                          ? "Submitted & Graded"
                          : "Pending Submission"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedAssignment.description && (
                  <div className="mt-6 rounded-xl bg-slate-50 p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Instructions
                    </h4>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {selectedAssignment.description}
                    </p>
                  </div>
                )}

                {/* Questions */}
                <div className="mt-6">
                  <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <FaBook className="text-purple-600" /> Assignment Questions
                  </h3>

                  {Array.isArray(selectedAssignment.questions) &&
                  selectedAssignment.questions.length > 0 ? (
                    <div className="space-y-3">
                      {selectedAssignment.questions.map((q: any, idx: number) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-xs font-bold text-purple-700">
                              Q{q.qNo || idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-800">{q.text}</p>
                              {q.marks && (
                                <span className="mt-1 inline-block text-xs font-bold text-slate-400">
                                  [{q.marks} Marks]
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                      Faculty has not listed individual questions. Please refer to classroom / course instructions.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-slate-400">
                Select an assignment to view its details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
