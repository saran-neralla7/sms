"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  FaArrowLeft,
  FaPhone,
  FaEnvelope,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCalendarAlt,
  FaPlus,
  FaBook,
  FaChartLine,
  FaUserGraduate,
  FaIdCard,
  FaUserTie,
  FaMapMarkerAlt,
  FaHistory,
  FaClipboardList,
  FaSync,
  FaComments,
  FaTimes
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function MenteeFullProfilePage() {
  const params = useParams();
  const studentId = params?.studentId as string;
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"ATTENDANCE" | "MARKS" | "RESULTS" | "DIARY">("ATTENDANCE");

  // Mid Marks Filters
  const [selectedMidYear, setSelectedMidYear] = useState<string>("ALL");
  const [selectedMidSem, setSelectedMidSem] = useState<string>("ALL");

  // Semester Results Modal State
  const [selectedResultModal, setSelectedResultModal] = useState<any | null>(null);

  const formatGpa = (val: any) => {
    if (val === null || val === undefined || val === "" || val === "N/A") return "-";
    const num = parseFloat(val);
    if (isNaN(num)) return String(val);
    return num.toFixed(2);
  };

  // Counseling form state
  const [logCategory, setLogCategory] = useState("ATTENDANCE");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logRemarks, setLogRemarks] = useState("");
  const [logActionTaken, setLogActionTaken] = useState("");
  const [logParentInformed, setLogParentInformed] = useState(false);
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logSuccess, setLogSuccess] = useState("");
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
    if (studentId && isAllowed) {
      fetchMenteeDetails();
    }
  }, [studentId, isAllowed]);

  const fetchMenteeDetails = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/faculty/mentees/${studentId}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load mentee information");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load mentee details");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCounselingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logRemarks.trim()) {
      setLogError("Counseling remarks are required.");
      return;
    }

    try {
      setSubmittingLog(true);
      setLogError("");
      setLogSuccess("");
      const res = await fetch(`/api/faculty/mentees/${studentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: logCategory,
          date: logDate,
          remarks: logRemarks.trim(),
          actionTaken: logActionTaken.trim() || undefined,
          parentInformed: logParentInformed
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setLogSuccess("Counseling entry recorded successfully!");
        setLogRemarks("");
        setLogActionTaken("");
        setLogParentInformed(false);
        // Refresh details
        const refreshed = await fetch(`/api/faculty/mentees/${studentId}`);
        const refJson = await refreshed.json();
        if (refJson.success) setData(refJson);
        setTimeout(() => setLogSuccess(""), 4000);
      } else {
        setLogError(json.error || "Failed to save counseling entry.");
      }
    } catch (err: any) {
      setLogError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmittingLog(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  if (error || !data?.student) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
          <FaTimesCircle className="text-rose-500 text-4xl mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Mentee Profile Not Found</h2>
          <p className="text-sm text-slate-500 mt-1">{error || "Unable to access this student record."}</p>
          <Link
            href="/faculty/mentees"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <FaArrowLeft size={12} /> Back to Mentees List
          </Link>
        </div>
      </div>
    );
  }

  const { student, subjectBreakdown, midMarks, overallStats, results, mentoringLogs } = data;
  const attendancePct = overallStats?.percentage ?? 0;
  const healthTier = overallStats?.healthTier ?? "SAFE";

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "NO_CLASSES":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            No Classes Held (N/A)
          </span>
        );
      case "SAFE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            <FaCheckCircle className="text-emerald-600 text-xs" /> Attendance Safe ({attendancePct}%)
          </span>
        );
      case "CONDONATION":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            <FaExclamationTriangle className="text-amber-600 text-xs" /> Condonation Range ({attendancePct}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
            <FaTimesCircle className="text-rose-600 text-xs" /> Detention Risk ({attendancePct}%)
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/faculty/mentees"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title="Back to Mentees List"
              >
                <FaArrowLeft size={14} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black text-slate-900 leading-tight">
                    {student.name}
                  </h1>
                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                    {student.rollNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mentee 360° Proctoring Dossier &bull; {student.department} &bull; Sec {student.section}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchMenteeDetails}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <FaSync size={11} className="text-slate-500" />
                <span className="hidden sm:inline">Refresh Data</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Student Dossier Header Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-2xl flex items-center justify-center overflow-hidden shadow-md shrink-0 ring-4 ring-slate-50">
                {student.photoUrl ? (
                  <img src={student.photoUrl} alt={student.name} className="h-full w-full object-cover" />
                ) : (
                  student.rollNumber.slice(-3)
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">{student.name}</h2>
                  {getTierBadge(healthTier)}
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-600">
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                    {student.rollNumber}
                  </span>
                  <span>&bull;</span>
                  <span className="font-semibold text-slate-800">{student.department}</span>
                  <span>&bull;</span>
                  <span>Year {student.year} &bull; Sem {student.semester}</span>
                  <span>&bull;</span>
                  <span>Section {student.section}</span>
                </div>
                {student.mentor && (
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                    <FaUserTie className="text-blue-600" />
                    <span>Assigned Mentor:</span>
                    <span className="font-bold text-slate-800">{student.mentor.empName}</span>
                    {student.mentor.designation && <span className="text-slate-400">({student.mentor.designation})</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Contact Actions */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
              {student.parentMobile && (
                <a
                  href={`tel:${student.parentMobile}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm"
                  title={`Call Parent: ${student.parentMobile}`}
                >
                  <FaPhone size={11} /> Call Parent ({student.parentMobile})
                </a>
              )}
              {student.mobile && (
                <a
                  href={`tel:${student.mobile}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  title={`Call Student: ${student.mobile}`}
                >
                  <FaPhone size={11} className="text-slate-500" /> Call Student
                </a>
              )}
              {student.email && (
                <a
                  href={`mailto:${student.email}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  title={`Email: ${student.email}`}
                >
                  <FaEnvelope size={11} className="text-slate-500" /> Email
                </a>
              )}
            </div>
          </div>

          {/* Biographical Mini-grid */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Father Name</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{student.fatherName || "Not Recorded"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Mother Name</span>
              <span className="font-bold text-slate-800 mt-0.5 block">{student.motherName || "Not Recorded"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Parent Phone</span>
              <span className="font-mono font-bold text-slate-800 mt-0.5 block">{student.parentMobile || "N/A"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Student Email</span>
              <span className="font-mono text-slate-700 truncate mt-0.5 block" title={student.email}>
                {student.email || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Attendance Rate */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Overall Attendance</span>
              <FaChartLine className="text-blue-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">
                {healthTier === "NO_CLASSES" ? "N/A" : `${attendancePct}%`}
              </span>
              <span className="text-xs font-bold text-slate-500">
                ({overallStats?.attendedClasses} / {overallStats?.totalClasses})
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  healthTier === "NO_CLASSES"
                    ? "bg-slate-300"
                    : healthTier === "SAFE"
                    ? "bg-emerald-500"
                    : healthTier === "CONDONATION"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{ width: `${healthTier === "NO_CLASSES" ? 0 : Math.min(100, attendancePct)}%` }}
              ></div>
            </div>
          </div>

          {/* Card 2: Mid Marks Recorded */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Mid Exam Papers</span>
              <FaBook className="text-indigo-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{midMarks?.length || 0}</span>
              <span className="text-xs font-bold text-slate-500">Subject Exams</span>
            </div>
            <p className="mt-3 text-xs text-slate-500 truncate">
              {midMarks?.length > 0 ? "Detailed scores in Mid Marks tab" : "No mid marks posted yet"}
            </p>
          </div>

          {/* Card 3: Semester Backlogs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Semester Results</span>
              <FaUserGraduate className="text-purple-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{results?.length || 0}</span>
              <span className="text-xs font-bold text-slate-500">Semesters on Record</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {results?.length > 0
                ? `Latest SGPA: ${formatGpa(results[results.length - 1]?.sgpa)}`
                : "No historical results"}
            </p>
          </div>

          {/* Card 4: Mentoring Logs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Counseling Diary</span>
              <FaComments className="text-amber-500" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{mentoringLogs?.length || 0}</span>
              <span className="text-xs font-bold text-slate-500">Session Notes</span>
            </div>
            <p className="mt-3 text-xs text-slate-500 truncate">
              {mentoringLogs?.[0]?.date
                ? `Last: ${new Date(mentoringLogs[0].date).toLocaleDateString()}`
                : "No sessions recorded"}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6 text-sm font-bold" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("ATTENDANCE")}
              className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
                activeTab === "ATTENDANCE"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaChartLine size={13} />
              <span>Subject Attendance ({subjectBreakdown?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("MARKS")}
              className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
                activeTab === "MARKS"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaBook size={13} />
              <span>Mid Exam Marks ({midMarks?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("RESULTS")}
              className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
                activeTab === "RESULTS"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaUserGraduate size={13} />
              <span>Semester Results ({results?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("DIARY")}
              className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
                activeTab === "DIARY"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FaComments size={13} />
              <span>Counseling Diary ({mentoringLogs?.length || 0})</span>
            </button>
          </nav>
        </div>

        {/* TAB 1: SUBJECT ATTENDANCE */}
        {activeTab === "ATTENDANCE" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Current Semester Subject Breakdown</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Academic attendance for Year {student.year} &bull; Semester {student.semester}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                Total Classes: {overallStats?.totalClasses} &bull; Attended: {overallStats?.attendedClasses}
              </span>
            </div>

            {subjectBreakdown?.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-6 text-center">No subjects found for current semester.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Subject Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-center">Classes Attended</th>
                      <th className="px-4 py-3 text-right">Percentage</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {subjectBreakdown?.map((sub: any) => {
                      const isSafe = sub.percentage >= 75;
                      const isCond = sub.percentage >= 65 && sub.percentage < 75;
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-bold text-slate-800">{sub.name}</td>
                          <td className="px-4 py-3 font-mono text-slate-500 font-semibold">{sub.code}</td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {sub.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                            {sub.attendedClasses} / {sub.totalClasses}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`font-mono font-black ${
                                isSafe ? "text-emerald-600" : isCond ? "text-amber-600" : "text-rose-600"
                              }`}
                            >
                              {sub.totalClasses === 0 ? "N/A" : `${sub.percentage}%`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {sub.totalClasses === 0 ? (
                              <span className="text-[10px] text-slate-400 italic">No classes held</span>
                            ) : isSafe ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <FaCheckCircle size={9} /> Safe
                              </span>
                            ) : isCond ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                <FaExclamationTriangle size={9} /> Condonation
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                <FaTimesCircle size={9} /> Shortage
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MID EXAM MARKS */}
        {activeTab === "MARKS" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Mid Exam Marks Record</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidated subject totals calculated with choice group rules
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                Total Exams: {midMarks?.length || 0}
              </span>
            </div>

            {/* Year & Semester Filter Bar */}
            {midMarks?.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-slate-500">Year:</span>
                    <select
                      value={selectedMidYear}
                      onChange={(e) => setSelectedMidYear(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Years</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-slate-500">Semester:</span>
                    <select
                      value={selectedMidSem}
                      onChange={(e) => setSelectedMidSem(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                    >
                      <option value="ALL">All Semesters</option>
                      <option value="1">1st Sem</option>
                      <option value="2">2nd Sem</option>
                    </select>
                  </div>
                  {(selectedMidYear !== "ALL" || selectedMidSem !== "ALL") && (
                    <button
                      onClick={() => {
                        setSelectedMidYear("ALL");
                        setSelectedMidSem("ALL");
                      }}
                      className="text-[11px] text-blue-600 font-bold hover:underline"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-800">
                    {midMarks?.filter((m: any) => {
                      if (selectedMidYear !== "ALL" && String(m.year) !== selectedMidYear) return false;
                      if (selectedMidSem !== "ALL" && String(m.semester) !== selectedMidSem) return false;
                      return true;
                    }).length || 0}
                  </span> of {midMarks?.length || 0} exams
                </span>
              </div>
            )}

            {midMarks?.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-8 text-center">
                No mid exam marks recorded for this student yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Subject Name</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Year &bull; Sem</th>
                      <th className="px-4 py-3">Exam Type</th>
                      <th className="px-4 py-3 text-right">Marks Obtained</th>
                      <th className="px-4 py-3 text-right">Percentage</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {midMarks
                      ?.filter((m: any) => {
                        if (selectedMidYear !== "ALL" && String(m.year) !== selectedMidYear) return false;
                        if (selectedMidSem !== "ALL" && String(m.semester) !== selectedMidSem) return false;
                        return true;
                      })
                      .map((m: any) => {
                        const max = m.totalMarks || 30;
                        const score = m.marksObtained;
                        const pct = score !== null && !m.isAbsent ? Math.round((score / max) * 100) : null;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3 font-bold text-slate-800">{m.subjectName}</td>
                            <td className="px-4 py-3 font-mono text-slate-500 font-semibold">{m.subjectCode}</td>
                            <td className="px-4 py-3 text-slate-600 font-medium">
                              {m.year}-{m.semester}
                            </td>
                            <td className="px-4 py-3 font-bold text-indigo-700">
                              {m.examType === "MID_I" ? "Mid 1" : m.examType === "MID_II" ? "Mid 2" : m.examType}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-extrabold text-blue-600 text-sm">
                              {m.isAbsent ? (
                                <span className="text-rose-600">AB</span>
                              ) : score !== null ? (
                                `${score} / ${max}`
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                              {pct !== null ? `${pct}%` : "-"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {m.isPublished ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  Published
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  Submitted
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SEMESTER RESULTS */}
        {activeTab === "RESULTS" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historical Semester Results</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Overall Grade Point Average (SGPA / CGPA) history &bull; Click any semester card to view detailed subject-wise grades
              </p>
            </div>

            {results?.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-8 text-center">No semester results recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results?.map((r: any) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResultModal(r)}
                    className="cursor-pointer group relative rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white p-4 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">
                        Year {r.year} &bull; Semester {r.semester}
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 group-hover:underline">
                        View Grades &rarr;
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xs uppercase font-extrabold text-slate-400">SGPA</span>
                      <span className="text-2xl font-black text-blue-600 font-mono">
                        {formatGpa(r.sgpa)}
                      </span>
                    </div>
                    {r.cgpa && (
                      <div className="mt-1 flex items-baseline justify-between text-xs text-slate-500">
                        <span>CGPA:</span>
                        <span className="font-bold text-slate-800">{formatGpa(r.cgpa)}</span>
                      </div>
                    )}
                    {Array.isArray(r.grades) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{r.grades.length} Subjects</span>
                        {r.grades.some((g: any) => g.grade === "F") ? (
                          <span className="text-rose-600 font-bold">
                            {r.grades.filter((g: any) => g.grade === "F").length} Backlog(s)
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">All Cleared</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COUNSELING DIARY */}
        {activeTab === "DIARY" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column (1 col) */}
            <div className="lg:col-span-1">
              <form
                onSubmit={handleAddCounselingLog}
                className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-2xs space-y-4 sticky top-24"
              >
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <FaPlus className="text-blue-600 text-xs" /> New 1-on-1 Counseling Entry
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Log paperless notes and actionable recommendations for this mentee.
                  </p>
                </div>

                {logError && (
                  <div className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 font-bold border border-rose-200">
                    {logError}
                  </div>
                )}
                {logSuccess && (
                  <div className="rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-700 font-bold border border-emerald-200">
                    {logSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Category
                  </label>
                  <select
                    value={logCategory}
                    onChange={(e) => setLogCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="ATTENDANCE">Attendance &bull; Shortage Counseling</option>
                    <option value="ACADEMIC">Academic &bull; Backlogs / Mid Marks</option>
                    <option value="BEHAVIORAL">Discipline &bull; Conduct / Punctuality</option>
                    <option value="PERSONAL">Wellbeing &bull; Personal / Health Support</option>
                    <option value="CAREER">Career &bull; Placements / Skill Development</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Counseling Remarks &bull; Discussion Notes
                  </label>
                  <textarea
                    rows={4}
                    value={logRemarks}
                    onChange={(e) => setLogRemarks(e.target.value)}
                    placeholder="Enter key issues discussed, student explanation, and mentor advice..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Action Taken &bull; Follow-Up Target
                  </label>
                  <input
                    type="text"
                    value={logActionTaken}
                    onChange={(e) => setLogActionTaken(e.target.value)}
                    placeholder="e.g., Parent called; Reminded to attend extra classes"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="parentInformed"
                    checked={logParentInformed}
                    onChange={(e) => setLogParentInformed(e.target.checked)}
                    className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="parentInformed" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Parents Informed about this session
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingLog}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
                >
                  {submittingLog ? "Saving Entry..." : "Save Counseling Entry"}
                </button>
              </form>
            </div>

            {/* Timeline Column (2 cols) */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">Counseling History &bull; Timeline</h3>
                  <span className="text-xs font-bold text-slate-500">
                    {mentoringLogs?.length || 0} Recorded Sessions
                  </span>
                </div>

                {mentoringLogs?.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-12 text-center">
                    No counseling entries recorded for this mentee yet. Use the form on the left to add the first session.
                  </p>
                ) : (
                  <div className="mt-6 space-y-6 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                    {mentoringLogs?.map((log: any) => (
                      <div key={log.id} className="relative pl-8">
                        <div className="absolute left-1.5 top-1 h-3.5 w-3.5 rounded-full bg-blue-600 ring-4 ring-white"></div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-blue-100 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-800 uppercase">
                                {log.category}
                              </span>
                              <span className="text-xs text-slate-500 font-semibold">
                                {new Date(log.date).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric"
                                })}
                              </span>
                            </div>
                            {log.parentInformed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                <FaCheckCircle size={9} /> Parent Informed
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-800 leading-relaxed font-medium">
                            {log.remarks}
                          </p>

                          {log.actionTaken && (
                            <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/60 font-semibold">
                              🎯 Action: {log.actionTaken}
                            </div>
                          )}

                          <div className="pt-1 text-[10px] text-slate-400 flex items-center justify-between">
                            <span className="font-semibold text-slate-600">
                              {log.recordedBy || (log.faculty?.empName ? `Recorded through ${log.faculty.empName} (Mentor)` : "Recorded through Mentor")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SUBJECT-WISE SEMESTER GRADES */}
        {selectedResultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                    <span>Year {selectedResultModal.year} &bull; Semester {selectedResultModal.semester} Grades</span>
                  </h3>
                  <p className="text-xs text-blue-100 font-medium mt-0.5">
                    {student?.name} ({student?.registrationNo})
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
      </main>
    </div>
  );
}
