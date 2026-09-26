"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaSync,
  FaPrint,
  FaSearch,
  FaClipboardList,
  FaBook,
  FaUserTie,
  FaGraduationCap,
  FaLayerGroup
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface SubjectItem {
  code: string;
  name: string;
  type: string;
  faculty: string;
  isOpenElective?: boolean;
  submittedCount?: number;
  draftCount?: number;
  statusType?: string;
  reason?: string;
  dept?: string;
}

interface SectionReport {
  id: string;
  title: string;
  dept: string;
  section: string;
  postedMarks: SubjectItem[];
  notPostedMarks: SubjectItem[];
}

export default function MidExamPostingStatusPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<{ [year: string]: SectionReport[] }>({});
  const [academicYear, setAcademicYear] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>("ALL"); // "ALL", "4", "3"
  const [selectedDept, setSelectedDept] = useState<string>("ALL"); // "ALL", "CIVIL", "CSE", "ECE", "CSM", "MECH", "OE"
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/mid-exam/posting-status");
      if (res.ok) {
        const json = await res.json();
        setData(json.data || {});
        setAcademicYear(json.academicYear || "");
        setGeneratedAt(json.generatedAt || new Date().toISOString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const userRole = (session?.user as any)?.role?.toUpperCase();
  const isAuthorized = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(userRole);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <FaExclamationTriangle className="text-4xl text-amber-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-sm text-slate-600 mt-1">This report is accessible only to Admin and Director logins.</p>
        <Link
          href="/admin/mid-exam"
          className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Back to Mid Exam Engine
        </Link>
      </div>
    );
  }

  // Calculate totals
  let totalPostedCount = 0;
  let totalNotPostedCount = 0;
  let totalDraftCount = 0;

  Object.values(data).forEach(sections => {
    sections.forEach(sec => {
      totalPostedCount += sec.postedMarks.length;
      totalNotPostedCount += sec.notPostedMarks.length;
      totalDraftCount += sec.notPostedMarks.filter(s => s.statusType === "DRAFT_ONLY").length;
    });
  });

  const totalSubjects = totalPostedCount + totalNotPostedCount;
  const overallPercentage = totalSubjects > 0 ? Math.round((totalPostedCount / totalSubjects) * 100) : 0;

  // Filter sections to display
  const getFilteredSections = () => {
    const yearsToShow = selectedYear === "ALL" ? ["4", "3"] : [selectedYear];
    const results: { year: string; sections: SectionReport[] }[] = [];

    yearsToShow.forEach(yr => {
      const secList = data[yr] || [];
      const filtered = secList.filter(sec => {
        // Dept filter
        if (selectedDept !== "ALL") {
          if (selectedDept === "OE") {
            if (sec.dept !== "OE") return false;
          } else {
            if (sec.dept !== selectedDept) return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = sec.title.toLowerCase().includes(q);
          const matchPosted = sec.postedMarks.some(
            s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.faculty.toLowerCase().includes(q)
          );
          const matchNotPosted = sec.notPostedMarks.some(
            s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.faculty.toLowerCase().includes(q)
          );
          if (!matchTitle && !matchPosted && !matchNotPosted) return false;
        }

        return true;
      });

      if (filtered.length > 0) {
        results.push({ year: yr, sections: filtered });
      }
    });

    return results;
  };

  const filteredYears = getFilteredSections();

  return (
    <div className="min-h-screen bg-slate-50/80 print:bg-white text-slate-800">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-xs print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/mid-exam"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <FaArrowLeft className="text-slate-400" /> Back to Mid Exam
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FaClipboardList className="text-blue-600" /> Mid-Exam Marks Posting Status Report
              </h1>
              <p className="text-[11px] text-slate-500">
                Live submission status &bull; Academic Year: <strong>{academicYear || "2026-2027"}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <FaSync className={refreshing ? "animate-spin text-blue-600" : "text-slate-500"} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
            >
              <FaPrint /> Print / Export
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 print:p-0">
        {/* KPI Summary Cards */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Subjects</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900">{totalSubjects}</span>
              <span className="text-xs text-slate-500">Across 3rd & 4th Yr</span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Marks Posted</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700">{totalPostedCount}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                {overallPercentage}% Done
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Saved in Draft Only</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-800">{totalDraftCount}</span>
              <span className="text-[11px] text-amber-700">Submit not clicked</span>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Pending Submission</span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700">{totalNotPostedCount}</span>
              <span className="text-xs font-semibold text-rose-600">{100 - overallPercentage}% Remaining</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Filter */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Year</span>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {[
                  { label: "All Years", val: "ALL" },
                  { label: "4th Year 1st Sem", val: "4" },
                  { label: "3rd Year 1st Sem", val: "3" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setSelectedYear(opt.val)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      selectedYear === opt.val
                        ? "bg-white text-blue-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Department / OE</span>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="ALL">All Departments & OE</option>
                <option value="CIVIL">Civil Engineering</option>
                <option value="CSE">Computer Science & Engineering</option>
                <option value="ECE">Electronics & Communication</option>
                <option value="CSM">CSE (AI & ML)</option>
                <option value="MECH">Mechanical Engineering</option>
                <option value="OE">Open Electives Only</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="flex flex-1 flex-col min-w-[200px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Search Subject or Faculty</span>
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="e.g. Highway, Surveying, Pallavi..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>

            {/* Reset Filter Button */}
            {(selectedYear !== "ALL" || selectedDept !== "ALL" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedYear("ALL");
                  setSelectedDept("ALL");
                  setSearchQuery("");
                }}
                className="self-end rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-red-600 transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Section-Wise Side-by-Side Cards */}
        {filteredYears.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FaClipboardList className="mx-auto text-4xl text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-700">No records found matching filters</h3>
            <p className="text-xs text-slate-400 mt-1">Try resetting the department or search filters.</p>
          </div>
        ) : (
          filteredYears.map(yearGroup => (
            <div key={yearGroup.year} className="mb-10">
              {/* Year Header Banner */}
              <div className="mb-4 flex items-center justify-between border-b-2 border-slate-300 pb-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <FaGraduationCap className="text-blue-600" />
                  {yearGroup.year === "4" ? "4TH YEAR 1ST SEMESTER" : "3RD YEAR 1ST SEMESTER"}
                </h2>
                <span className="text-xs font-semibold text-slate-500">
                  {yearGroup.sections.length} Section{yearGroup.sections.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Sections Grid */}
              <div className="space-y-6">
                {yearGroup.sections.map(sec => {
                  const totalInSec = sec.postedMarks.length + sec.notPostedMarks.length;
                  const secPct = totalInSec > 0 ? Math.round((sec.postedMarks.length / totalInSec) * 100) : 0;

                  return (
                    <div
                      key={sec.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:shadow-sm"
                    >
                      {/* Section Card Title Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-2xs">
                            {sec.dept === "OE" ? "OE" : sec.dept}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">
                            {sec.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-slate-600">
                            <strong>{sec.postedMarks.length}</strong> of {totalInSec} Posted
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-20 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${secPct}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-black ${secPct === 100 ? "text-emerald-700" : secPct > 0 ? "text-blue-700" : "text-rose-700"}`}>
                              {secPct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Side-by-Side Content Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                        {/* LEFT COLUMN: POSTED MARKS */}
                        <div className="p-4 sm:p-5 bg-emerald-50/20">
                          <div className="mb-3 flex items-center justify-between border-b border-emerald-100 pb-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                              <FaCheckCircle className="text-emerald-600" />
                              Posted Marks ({sec.postedMarks.length})
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                              Submit Draft Clicked
                            </span>
                          </div>

                          {sec.postedMarks.length === 0 ? (
                            <div className="py-6 text-center text-xs font-medium text-slate-400 italic">
                              No marks posted yet
                            </div>
                          ) : (
                            <ul className="space-y-2.5">
                              {sec.postedMarks.map((sub, idx) => (
                                <li
                                  key={idx}
                                  className="rounded-xl border border-emerald-200/80 bg-white p-3 shadow-2xs transition hover:border-emerald-300"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="text-xs font-bold text-slate-900 leading-snug">
                                          {sub.name}
                                        </p>
                                        {sub.isOpenElective && (
                                          <span className="rounded-md bg-purple-100 text-purple-800 border border-purple-200/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                            OPEN ELECTIVE
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] font-semibold text-slate-500 font-mono mt-0.5">
                                        {sub.code} &bull; <span className="text-slate-400">{sub.type}</span>
                                        {sub.dept && sub.dept !== "All" && (
                                          <span className="text-slate-400"> &bull; {sub.dept}</span>
                                        )}
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                      {sub.submittedCount ? `${sub.submittedCount} entries` : "Finalized"}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700 border-t border-slate-100 pt-1.5">
                                    <FaUserTie className="text-slate-400 text-[11px]" />
                                    <span className="font-semibold text-slate-800">{sub.faculty}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* RIGHT COLUMN: NOT POSTED */}
                        <div className="p-4 sm:p-5 bg-rose-50/10">
                          <div className="mb-3 flex items-center justify-between border-b border-rose-100 pb-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-800">
                              <FaTimesCircle className="text-rose-600" />
                              Not Posted ({sec.notPostedMarks.length})
                            </span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-full">
                              Action Required
                            </span>
                          </div>

                          {sec.notPostedMarks.length === 0 ? (
                            <div className="py-6 text-center text-xs font-medium text-emerald-600 font-semibold">
                              🎉 All marks posted for this section!
                            </div>
                          ) : (
                            <ul className="space-y-2.5">
                              {sec.notPostedMarks.map((sub, idx) => {
                                const isDraft = sub.statusType === "DRAFT_ONLY";
                                const isPaperCreated = sub.statusType === "PAPER_CREATED";

                                return (
                                  <li
                                    key={idx}
                                    className={`rounded-xl border p-3 shadow-2xs transition ${
                                      isDraft
                                        ? "border-amber-200 bg-amber-50/30 hover:border-amber-300"
                                        : isPaperCreated
                                        ? "border-rose-200/70 bg-white hover:border-rose-300"
                                        : "border-slate-200/80 bg-white hover:border-slate-300"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-xs font-bold text-slate-900 leading-snug">
                                            {sub.name}
                                          </p>
                                          {sub.isOpenElective && (
                                            <span className="rounded-md bg-purple-100 text-purple-800 border border-purple-200/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                              OPEN ELECTIVE
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] font-semibold text-slate-500 font-mono mt-0.5">
                                          {sub.code} &bull; <span className="text-slate-400">{sub.type}</span>
                                          {sub.dept && sub.dept !== "All" && (
                                            <span className="text-slate-400"> &bull; {sub.dept}</span>
                                          )}
                                        </p>
                                      </div>

                                      {isDraft ? (
                                        <span className="shrink-0 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800" title="Marks entered but Submit Draft not clicked">
                                          ⚠️ Draft Only ({sub.draftCount || 0})
                                        </span>
                                      ) : isPaperCreated ? (
                                        <span className="shrink-0 rounded-full bg-rose-100 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                          Paper (0 marks)
                                        </span>
                                      ) : (
                                        <span className="shrink-0 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                          Not Started
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5 text-xs">
                                      <div className="flex items-center gap-1.5 text-slate-700 truncate">
                                        <FaUserTie className="text-slate-400 text-[11px] shrink-0" />
                                        <span className="font-semibold text-slate-800 truncate">{sub.faculty}</span>
                                      </div>
                                      {sub.reason && (
                                        <span className="text-[10px] text-slate-500 italic shrink-0">
                                          {isDraft ? "Submit Draft Pending" : ""}
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
