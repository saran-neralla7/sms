"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaUserGraduate,
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaPhone,
  FaEnvelope,
  FaCalendarAlt,
  FaPlus,
  FaSearch,
  FaFilter,
  FaSync,
  FaBook,
  FaChartLine,
  FaCommentMedical,
  FaTimes,
  FaUserTie
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface Mentee {
  id: string;
  rollNumber: string;
  name: string;
  mobile: string;
  parentMobile: string;
  email?: string;
  photoUrl?: string;
  year: string;
  semester: string;
  department: string;
  deptCode: string;
  section: string;
  totalClasses: number;
  attendedClasses: number;
  attendancePercentage: number;
  healthTier: "SAFE" | "CONDONATION" | "DETENTION" | "NO_CLASSES";
  backlogsCount: number;
  mentorId?: string | null;
  mentorName?: string | null;
  mentorCode?: string | null;
  mentorDesignation?: string | null;
  lastCounselingDate?: string;
  lastCounselingRemarks?: string;
  lastCounselingRecordedBy?: string;
}

interface SubjectAttendance {
  id: string;
  name: string;
  code: string;
  type: string;
  totalClasses: number;
  attendedClasses: number;
  percentage: number;
}

interface MentoringLog {
  id: string;
  date: string;
  category: string;
  remarks: string;
  actionTaken?: string;
  parentInformed: boolean;
  recordedBy?: string;
  faculty?: {
    empName: string;
    designation: string;
  };
}

export default function FacultyMenteesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mentees, setMentees] = useState<Mentee[]>([]);
  const [stats, setStats] = useState({ total: 0, safe: 0, condonation: 0, detention: 0, noClasses: 0 });
  const [isHOD, setIsHOD] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [departmentFaculties, setDepartmentFaculties] = useState<any[]>([]);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedMentorFilter, setSelectedMentorFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 48;

  // Detail Modal / Drawer
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "MARKS" | "DIARY">("ATTENDANCE");
  const [selectedResultModal, setSelectedResultModal] = useState<any>(null);

  // Helper for 2-decimal GPA
  const formatGpa = (val: any) => {
    if (val === null || val === undefined || isNaN(Number(val))) return "-";
    return Number(val).toFixed(2);
  };

  // New Counseling Log Form
  const [logCategory, setLogCategory] = useState("ATTENDANCE");
  const [logRemarks, setLogRemarks] = useState("");
  const [logActionTaken, setLogActionTaken] = useState("");
  const [logParentInformed, setLogParentInformed] = useState(false);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState("");

  const user = session?.user as any;
  const isAllowed = user?.role === "FACULTY" || user?.role === "HOD" || user?.role === "ADMIN" || user?.role === "DIRECTOR";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && !isAllowed) {
      router.push("/dashboard");
    }
  }, [status, isAllowed, router]);

  useEffect(() => {
    if (isAllowed) {
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const qFac = urlParams.get("facultyId");
        const qDept = urlParams.get("departmentId");
        if (qDept) setSelectedDept(qDept);
        if (qFac) {
          setSelectedMentorFilter(qFac);
          fetchMentees(qDept || "ALL", qFac);
          return;
        }
        if (qDept) {
          fetchMentees(qDept, "ALL");
          return;
        }
      }
      fetchMentees();
    }
  }, [isAllowed]);

  const fetchMentees = async (deptFilter?: string, mentorFilter?: string) => {
    try {
      setLoading(true);
      const d = deptFilter !== undefined ? deptFilter : selectedDept;
      const m = mentorFilter !== undefined ? mentorFilter : selectedMentorFilter;

      const params = new URLSearchParams();
      if (d && d !== "ALL") params.set("departmentId", d);
      if (m && m !== "ALL") params.set("facultyId", m);

      const url = params.toString() ? `/api/faculty/mentees?${params.toString()}` : "/api/faculty/mentees";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setMentees(json.students || []);
        setStats(json.stats || { total: 0, safe: 0, condonation: 0, detention: 0, noClasses: 0 });
        if (json.isHOD !== undefined) setIsHOD(Boolean(json.isHOD));
        if (json.isAdmin !== undefined) setIsAdmin(Boolean(json.isAdmin));
        if (json.departments) setDepartments(json.departments);
        if (json.departmentFaculties) setDepartmentFaculties(json.departmentFaculties);
      }
    } catch (err) {
      console.error("Failed to load mentees:", err);
    } finally {
      setLoading(false);
    }
  };

  const openStudentModal = async (id: string) => {
    setSelectedStudentId(id);
    setActiveTab("ATTENDANCE");
    try {
      setLoadingDetails(true);
      const res = await fetch(`/api/faculty/mentees/${id}`);
      const json = await res.json();
      if (json.success) {
        setStudentDetails(json);
      }
    } catch (err) {
      console.error("Failed to load student details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddCounselingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logRemarks.trim() || !selectedStudentId) {
      setLogError("Remarks are required");
      return;
    }

    try {
      setSubmittingLog(true);
      setLogError("");
      const res = await fetch(`/api/faculty/mentees/${selectedStudentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: logCategory,
          remarks: logRemarks,
          actionTaken: logActionTaken,
          parentInformed: logParentInformed
        })
      });

      const json = await res.json();
      if (json.success) {
        setLogRemarks("");
        setLogActionTaken("");
        setLogParentInformed(false);
        // Refresh details
        const refreshed = await fetch(`/api/faculty/mentees/${selectedStudentId}`);
        const refJson = await refreshed.json();
        if (refJson.success) {
          setStudentDetails(refJson);
        }
        fetchMentees();
      } else {
        setLogError(json.error || "Failed to add counseling entry");
      }
    } catch (err: any) {
      setLogError(err.message || "An error occurred");
    } finally {
      setSubmittingLog(false);
    }
  };

  if (status === "loading" || loading && mentees.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  // Filter mentees
  const filteredMentees = mentees.filter((m) => {
    if (selectedTier !== "ALL" && m.healthTier !== selectedTier) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const rollMatch = m.rollNumber.toLowerCase().includes(q);
      const nameMatch = m.name.toLowerCase().includes(q);
      return rollMatch || nameMatch;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMentees.length / PAGE_SIZE));
  const paginatedMentees = filteredMentees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getTierBadge = (tier: string, pct: number) => {
    switch (tier) {
      case "NO_CLASSES":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            No Classes Held
          </span>
        );
      case "SAFE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            <FaCheckCircle className="text-emerald-600 text-[10px]" /> {pct}% (Safe)
          </span>
        );
      case "CONDONATION":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            <FaExclamationTriangle className="text-amber-600 text-[10px]" /> {pct}% (Condonation)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
            <FaTimesCircle className="text-rose-600 text-[10px]" /> {pct}% (Detention Risk)
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={isHOD || isAdmin ? "/dashboard" : "/faculty"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title={isHOD || isAdmin ? "Back to Dashboard" : "Back to Faculty Dashboard"}
              >
                <FaArrowLeft size={14} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                    {isAdmin
                      ? "Campus Mentees & Proctoring Oversight"
                      : isHOD
                      ? "Department Mentees & Proctoring Oversight"
                      : "My Mentees • Proctoring Portal"}
                  </h1>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    isAdmin
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : isHOD
                      ? "bg-purple-100 text-purple-800 border border-purple-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}>
                    {isAdmin ? "Admin Campus Oversight" : isHOD ? "HOD Department Control" : "Assigned Students"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdmin
                    ? "Monitor all campus students across departments, mentor allocations, attendance health, and proctoring diaries."
                    : isHOD
                    ? "Monitor all department students, assigned mentors, attendance health, mid marks, and proctoring diaries."
                    : "Track assigned student attendance health, mid marks, and log paperless 1-on-1 counseling diary entries."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(isHOD || isAdmin) && (
                <Link
                  href="/admin/mentors"
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition"
                >
                  <FaUserTie size={12} />
                  <span>Assign / Manage Mentors</span>
                </Link>
              )}
              <button
                onClick={() => fetchMentees()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
              >
                <FaSync className={loading ? "animate-spin text-blue-600" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Mentees</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FaUserGraduate />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Safe (&gt;75%)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                <FaCheckCircle />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-800 mt-2">{stats.safe}</p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Condonation (65-75%)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">
                <FaExclamationTriangle />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-800 mt-2">{stats.condonation}</p>
          </div>

          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Detention Risk (&lt;65%)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 font-bold">
                <FaTimesCircle />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-800 mt-2">{stats.detention}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <FaSearch className="absolute left-3.5 top-3 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student roll number or name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Attendance Tier Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "ALL", label: `All (${mentees.length})` },
                { id: "SAFE", label: `Safe (${stats.safe})` },
                { id: "CONDONATION", label: `Condonation (${stats.condonation})` },
                { id: "DETENTION", label: `Detention (${stats.detention})` },
                ...(stats.noClasses > 0 ? [{ id: "NO_CLASSES", label: `No Classes (${stats.noClasses})` }] : [])
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setSelectedTier(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    selectedTier === btn.id
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin & HOD Filter Controls */}
          {(isHOD || isAdmin) && (
            <div className="flex flex-wrap items-center gap-4 pt-2.5 border-t border-slate-100 text-xs">
              {/* Department Filter for Admin */}
              {isAdmin && departments.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">🏢 Department:</span>
                  <select
                    value={selectedDept}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedDept(val);
                      setSelectedMentorFilter("ALL");
                      setCurrentPage(1);
                      fetchMentees(val, "ALL");
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Departments (Entire Campus)</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Mentor Filter Dropdown */}
              {departmentFaculties.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 font-bold text-slate-700">
                    <FaUserTie className="text-purple-600" />
                    <span>Mentor:</span>
                  </div>
                  <select
                    value={selectedMentorFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMentorFilter(val);
                      setCurrentPage(1);
                      fetchMentees(selectedDept, val);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-purple-500"
                  >
                    <option value="ALL">All Mentors &amp; Students ({mentees.length})</option>
                    <option value="UNASSIGNED">Unassigned Students</option>
                    {departmentFaculties.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.empName} {f.empCode ? `(${f.empCode})` : ""} {f.department?.code ? `• ${f.department.code}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Student Cards Grid */}
        {filteredMentees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-2xs">
            <FaUserGraduate className="mx-auto text-3xl text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No Mentees Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {mentees.length === 0
                ? "No students have been assigned to you as a mentor yet. Please ask your HOD or Admin to assign mentees to your profile."
                : "No mentees matching the selected search or filter criteria."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedMentees.map((st) => (
              <div
                key={st.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-300 hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <Link
                    href={`/faculty/mentees/${st.id}`}
                    className="flex items-start justify-between gap-2 group/header"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-700 text-xs overflow-hidden border border-blue-100 shrink-0 group-hover/header:border-blue-400 transition">
                        {st.photoUrl ? (
                          <img src={st.photoUrl} alt={st.name} className="h-full w-full object-cover" />
                        ) : (
                          st.rollNumber.slice(-3)
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 leading-snug line-clamp-1 group-hover/header:text-blue-600 transition">
                          {st.name}
                        </h4>
                        <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">{st.rollNumber}</p>
                      </div>
                    </div>
                    {getTierBadge(st.healthTier, st.attendancePercentage)}
                  </Link>

                  {/* Section & Department Badges */}
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                      {st.deptCode} &bull; Sec {st.section}
                    </span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                      {st.year}th Yr &bull; Sem {st.semester}
                    </span>
                    {st.backlogsCount > 0 && (
                      <span className="rounded-md bg-rose-100 text-rose-800 px-2 py-0.5 font-bold">
                        ⚠️ {st.backlogsCount} Backlogs
                      </span>
                    )}
                    {isHOD && (
                      <span className={`rounded-md px-2 py-0.5 font-bold ${
                        st.mentorName
                          ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}>
                        👤 {st.mentorName ? `Mentor: ${st.mentorName}` : "Unassigned"}
                      </span>
                    )}
                  </div>

                  {/* Quick Attendance Stats */}
                  <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Classes Attended</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {st.attendedClasses} / {st.totalClasses}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          st.healthTier === "NO_CLASSES"
                            ? "bg-slate-300"
                            : st.healthTier === "SAFE"
                            ? "bg-emerald-500"
                            : st.healthTier === "CONDONATION"
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${st.healthTier === "NO_CLASSES" ? 0 : Math.min(100, st.attendancePercentage)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Last Counseling note preview if any */}
                  {st.lastCounselingRemarks && (
                    <div className="mt-2.5 text-[10px] text-slate-500 italic bg-blue-50/50 rounded-lg p-2 border border-blue-100/60 line-clamp-2">
                      💬 <span className="font-semibold text-slate-700">Last note:</span> {st.lastCounselingRemarks}
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${st.parentMobile}`}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
                    title={`Call Parent: ${st.parentMobile}`}
                  >
                    <FaPhone size={10} className="text-slate-500" />
                    <span>Call Parent</span>
                  </a>

                  <Link
                    href={`/faculty/mentees/${st.id}`}
                    className="flex-1 rounded-xl bg-blue-600 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 transition shadow-2xs flex items-center justify-center gap-1"
                  >
                    <FaChartLine size={10} />
                    <span>360° Profile &amp; Diary</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-800">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{" "}
              <span className="font-bold text-slate-800">{Math.min(currentPage * PAGE_SIZE, filteredMentees.length)}</span> of{" "}
              <span className="font-bold text-slate-800">{filteredMentees.length}</span> students
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={currentPage === 1}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-600 px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 360° Mentee Detail Modal */}
      {selectedStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="border-b border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs">
                  <FaUserGraduate />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {studentDetails?.student?.name || "Loading..."}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {studentDetails?.student?.rollNumber} &bull; {studentDetails?.student?.department} &bull; Sec {studentDetails?.student?.section}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedStudentId && (
                  <Link
                    href={`/faculty/mentees/${selectedStudentId}`}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <FaChartLine size={10} /> Full Page
                  </Link>
                )}
                <button
                  onClick={() => setSelectedStudentId(null)}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 transition"
                >
                  <FaTimes size={15} />
                </button>
              </div>
            </div>

            {/* Segmented Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("ATTENDANCE")}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                  activeTab === "ATTENDANCE"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FaBook className="text-xs" /> Subject Attendance
              </button>
              <button
                onClick={() => setActiveTab("MARKS")}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                  activeTab === "MARKS"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FaChartLine className="text-xs" /> Marks &amp; Results
              </button>
              <button
                onClick={() => setActiveTab("DIARY")}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
                  activeTab === "DIARY"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FaCommentMedical className="text-xs" /> Proctoring Diary ({studentDetails?.mentoringLogs?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin scrollbar-thumb-slate-200">
              {loadingDetails ? (
                <div className="flex h-48 items-center justify-center">
                  <LogoSpinner fullScreen={false} />
                </div>
              ) : (
                <>
                  {/* TAB 1: SUBJECT-WISE ATTENDANCE */}
                  {activeTab === "ATTENDANCE" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Subject-wise Attendance Breakdown
                        </span>
                        <span className="text-[11px] text-slate-500">Current Semester</span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2.5">Subject</th>
                              <th className="px-3 py-2.5">Type</th>
                              <th className="px-3 py-2.5 text-center">Classes</th>
                              <th className="px-3 py-2.5 text-center">Attended</th>
                              <th className="px-3 py-2.5 text-right">Percentage</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {studentDetails?.subjectBreakdown?.map((sub: SubjectAttendance) => (
                              <tr key={sub.id} className="hover:bg-slate-50/60">
                                <td className="px-3 py-2.5 font-bold text-slate-800">
                                  {sub.name}
                                  <span className="block font-mono text-[10px] text-slate-400 mt-0.5">{sub.code}</span>
                                </td>
                                <td className="px-3 py-2.5 text-slate-500 text-[11px]">{sub.type}</td>
                                <td className="px-3 py-2.5 text-center font-mono">{sub.totalClasses}</td>
                                <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">{sub.attendedClasses}</td>
                                <td className="px-3 py-2.5 text-right">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      sub.percentage >= 75
                                        ? "bg-emerald-100 text-emerald-800"
                                        : sub.percentage >= 65
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-rose-100 text-rose-800"
                                    }`}
                                  >
                                    {sub.percentage}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MARKS & RESULTS */}
                  {activeTab === "MARKS" && (
                    <div className="space-y-4">
                      {/* Mid Exam Marks */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mid Exam Marks</h4>
                        {studentDetails?.midMarks?.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-3">No mid exam marks recorded for this student yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="px-3 py-2">Subject</th>
                                  <th className="px-3 py-2">Exam</th>
                                  <th className="px-3 py-2 text-right">Marks Obtained</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {studentDetails?.midMarks?.map((m: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-bold text-slate-800">
                                      {m.subjectName || m.paper?.subject?.name || "Subject"}
                                      {m.subjectCode && <span className="text-[10px] text-slate-400 font-normal ml-1">({m.subjectCode})</span>}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500 font-medium">
                                      {m.examType === "MID_I" ? "Mid 1" : m.examType === "MID_II" ? "Mid 2" : (m.examType || "Mid Exam")}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-blue-600">
                                      {m.isAbsent ? (
                                        <span className="text-rose-600">Absent</span>
                                      ) : m.marksObtained !== null && m.marksObtained !== undefined ? (
                                        `${m.marksObtained} / ${m.totalMarks || 30}`
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Semester Results History */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Semester Results History
                          </h4>
                          <span className="text-[11px] text-blue-600 font-semibold">
                            Click semester card to view subject-wise grades
                          </span>
                        </div>
                        {studentDetails?.results?.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">No historical semester results found.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {studentDetails?.results?.map((r: any) => (
                              <div
                                key={r.id}
                                onClick={() => setSelectedResultModal(r)}
                                className="cursor-pointer group rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white p-2.5 text-center hover:border-blue-400 hover:shadow-xs transition transform hover:-translate-y-0.5"
                              >
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-1">
                                  <span>Yr {r.year} Sem {r.semester}</span>
                                  <span className="text-blue-600 group-hover:underline">&rarr;</span>
                                </div>
                                <p className="text-base font-extrabold text-slate-900">
                                  SGPA: <span className="text-blue-600 font-mono">{formatGpa(r.sgpa)}</span>
                                </p>
                                {r.cgpa && (
                                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    CGPA: <span className="font-bold text-slate-700">{formatGpa(r.cgpa)}</span>
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PROCTORING / COUNSELING DIARY */}
                  {activeTab === "DIARY" && (
                    <div className="space-y-5">
                      {/* Add New Counseling Note Form */}
                      <form onSubmit={handleAddCounselingLog} className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                        <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <FaPlus className="text-blue-600 text-[10px]" /> Record Counseling / Proctoring Entry
                        </h4>

                        {logError && <p className="text-xs text-rose-600 font-semibold">{logError}</p>}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                            <select
                              value={logCategory}
                              onChange={(e) => setLogCategory(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                            >
                              <option value="ATTENDANCE">Attendance Shortage</option>
                              <option value="ACADEMICS">Academic Performance / Backlogs</option>
                              <option value="PARENT_MEETING">Parent Discussion / Call</option>
                              <option value="BEHAVIORAL">Discipline / Behavioral</option>
                              <option value="HEALTH">Medical / Leave of Absence</option>
                              <option value="CAREER">Career &amp; Placement Guidance</option>
                              <option value="GENERAL">General Mentoring</option>
                            </select>
                          </div>

                          <div className="flex items-center pt-4">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={logParentInformed}
                                onChange={(e) => setLogParentInformed(e.target.checked)}
                                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                              />
                              <span>Parent Informed / Contacted</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Discussion Remarks / Notes
                          </label>
                          <textarea
                            rows={2}
                            value={logRemarks}
                            onChange={(e) => setLogRemarks(e.target.value)}
                            placeholder="e.g. Counseled student regarding attendance dip in BEE. Student cited transportation issues."
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 resize-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Action Taken / Recommendation (Optional)
                          </label>
                          <input
                            type="text"
                            value={logActionTaken}
                            onChange={(e) => setLogActionTaken(e.target.value)}
                            placeholder="e.g. Instructed student to submit medical certificate; follow-up scheduled for next week."
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingLog}
                          className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-2xs flex items-center gap-1.5"
                        >
                          <FaCheckCircle size={11} />
                          <span>{submittingLog ? "Saving..." : "Save Counseling Entry"}</span>
                        </button>
                      </form>

                      {/* Counseling History Timeline */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Counseling History ({studentDetails?.mentoringLogs?.length || 0})
                        </h4>

                        {studentDetails?.mentoringLogs?.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                            No counseling notes logged for this student yet.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {studentDetails?.mentoringLogs?.map((log: MentoringLog) => (
                              <div
                                key={log.id}
                                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-100 pb-1.5 mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded bg-indigo-50 font-bold text-indigo-700 px-1.5 py-0.2">
                                      {log.category}
                                    </span>
                                    {log.parentInformed && (
                                      <span className="rounded bg-emerald-100 font-bold text-emerald-800 px-1.5 py-0.2">
                                        Parent Informed
                                      </span>
                                    )}
                                  </div>
                                  <span>{new Date(log.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                                </div>

                                <p className="text-slate-800 font-medium leading-relaxed">{log.remarks}</p>

                                {log.actionTaken && (
                                  <p className="text-[11px] text-blue-700 font-semibold mt-1">
                                    Action: <span className="font-normal text-slate-600">{log.actionTaken}</span>
                                  </p>
                                )}

                                <p className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-50 font-semibold">
                                  {log.recordedBy || (log.faculty?.empName ? `Recorded through ${log.faculty.empName} (Mentor)` : "Recorded through Mentor")}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBJECT-WISE SEMESTER GRADES */}
      {selectedResultModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>Year {selectedResultModal.year} &bull; Semester {selectedResultModal.semester} Grades</span>
                </h3>
                <p className="text-xs text-blue-100 font-medium mt-0.5">
                  {studentDetails?.student?.name} ({studentDetails?.student?.rollNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResultModal(null)}
                className="rounded-xl p-1.5 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FaTimes size={18} />
              </button>
            </div>

            {/* GPA summary bar */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50 border-b border-slate-200 text-center py-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">SGPA</p>
                <p className="text-xl font-black text-blue-600 font-mono">
                  {formatGpa(selectedResultModal.sgpa)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">CGPA</p>
                <p className="text-xl font-black text-slate-700 font-mono">
                  {formatGpa(selectedResultModal.cgpa)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Backlogs</p>
                <p className={`text-xl font-black ${
                  Array.isArray(selectedResultModal.grades) &&
                  selectedResultModal.grades.some((g: any) => g.grade === "F")
                    ? "text-rose-600"
                    : "text-emerald-600"
                }`}>
                  {Array.isArray(selectedResultModal.grades)
                    ? selectedResultModal.grades.filter((g: any) => g.grade === "F").length
                    : 0}
                </p>
              </div>
            </div>

            {/* Grades Table */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Subject / Course</th>
                      <th className="px-4 py-3 text-center">Grade</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(selectedResultModal.grades) && selectedResultModal.grades.length > 0 ? (
                      selectedResultModal.grades.map((item: any, idx: number) => {
                        const isFail = item.grade === "F" || item.grade === "AB";
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 text-slate-400 font-medium">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {item.subjectCode || item.subject || `Subject ${idx + 1}`}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-md font-black text-xs ${
                                isFail
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : item.grade === "O" || item.grade === "A+"
                                  ? "bg-purple-100 text-purple-700 border border-purple-200"
                                  : "bg-blue-100 text-blue-700 border border-blue-200"
                              }`}>
                                {item.grade || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                                isFail ? "text-rose-600" : "text-emerald-600"
                              }`}>
                                {isFail ? <FaExclamationTriangle size={10} /> : <FaCheckCircle size={10} />}
                                {isFail ? "Fail" : "Pass"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">
                          No subject-wise grade entries found for this semester.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedResultModal(null)}
                className="rounded-xl px-5 py-2 text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
