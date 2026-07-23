"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarAlt,
  FaPlus,
  FaPrint,
  FaCheck,
  FaTimes,
  FaInfoCircle,
  FaArrowRight,
  FaFileAlt,
  FaBriefcase,
  FaUserTie,
  FaHome
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

export default function FacultyLeavesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State variables
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"my-leaves" | "hod-approvals" | "hod-upcoming" | "hod-all">("my-leaves");
  const [facultyData, setFacultyData] = useState<any>(null);
  const [hodPendingLeaves, setHodPendingLeaves] = useState<any[]>([]);
  const [hodAllLeaves, setHodAllLeaves] = useState<any[]>([]);
  const [hodUpcomingLeaves, setHodUpcomingLeaves] = useState<any[]>([]);

  // HOD Filters
  const [hodStatusFilter, setHodStatusFilter] = useState("");
  const [hodLeaveTypeFilter, setHodLeaveTypeFilter] = useState("");
  const [hodYearFilter, setHodYearFilter] = useState(new Date().getFullYear().toString());

  // HOD Date Filters
  const [hodDateMode, setHodDateMode] = useState<"ALL" | "TODAY" | "SPECIFIC" | "RANGE">("ALL");
  const [hodSpecificDate, setHodSpecificDate] = useState("");
  const [hodStartDateFilter, setHodStartDateFilter] = useState("");
  const [hodEndDateFilter, setHodEndDateFilter] = useState("");

  // Apply Leave Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<"CL" | "OD" | "AL" | "ML">("CL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [reason, setReason] = useState("");
  const [substituteId, setSubstituteId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // HOD Remarks Modal State
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [remarks, setRemarks] = useState("");
  const [actioning, setActioning] = useState(false);

  const role = (session?.user as any)?.role;
  const isHOD = role === "HOD";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchLeavesData();
      if (isHOD) {
        fetchHodPendingLeaves();
        fetchHodLeavesData();
      }
    }
  }, [status, isHOD]);

  useEffect(() => {
    if (status === "authenticated" && isHOD) {
      fetchHodLeavesData();
    }
  }, [activeTab, hodStatusFilter, hodLeaveTypeFilter, hodYearFilter, hodDateMode, hodSpecificDate, hodStartDateFilter, hodEndDateFilter]);

  const fetchHodLeavesData = async () => {
    try {
      let url = `/api/hod/leaves/all?1=1`;

      if (activeTab === "hod-upcoming") {
        url += `&upcoming=true`;
      } else {
        if (hodYearFilter && hodYearFilter !== "ALL") url += `&year=${hodYearFilter}`;
      }

      if (hodStatusFilter) url += `&status=${hodStatusFilter}`;
      if (hodLeaveTypeFilter) url += `&leaveType=${hodLeaveTypeFilter}`;

      if (hodDateMode === "TODAY") {
        const todayStr = new Date().toISOString().split("T")[0];
        url += `&startDate=${todayStr}&endDate=${todayStr}`;
      } else if (hodDateMode === "SPECIFIC" && hodSpecificDate) {
        url += `&startDate=${hodSpecificDate}&endDate=${hodSpecificDate}`;
      } else if (hodDateMode === "RANGE") {
        if (hodStartDateFilter) url += `&startDate=${hodStartDateFilter}`;
        if (hodEndDateFilter) url += `&endDate=${hodEndDateFilter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (activeTab === "hod-upcoming") {
          setHodUpcomingLeaves(data.leaves || []);
        } else {
          setHodAllLeaves(data.leaves || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-calculate numberOfDays when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const timeDiff = end.getTime() - start.getTime();
      const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      if (dayDiff > 0) {
        setNumberOfDays(dayDiff);
      } else {
        setNumberOfDays(1);
      }
    }
  }, [startDate, endDate]);

  const fetchLeavesData = async () => {
    try {
      const res = await fetch("/api/faculty/leaves");
      if (res.ok) {
        const data = await res.json();
        setFacultyData(data);
      } else {
        console.error("Failed to fetch leaves data");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHodPendingLeaves = async () => {
    try {
      const res = await fetch("/api/hod/leaves/pending");
      if (res.ok) {
        const data = await res.json();
        setHodPendingLeaves(data.pendingLeaves || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/faculty/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType,
          startDateStr: startDate,
          endDateStr: endDate,
          numberOfDays,
          reason,
          substituteId: substituteId || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Leave application submitted successfully!");
        setReason("");
        setStartDate("");
        setEndDate("");
        setSubstituteId("");
        // Refresh data
        await fetchLeavesData();
        setTimeout(() => {
          setIsApplyModalOpen(false);
          setSuccessMsg("");
        }, 1500);
      } else {
        setErrorMsg(data.error || "Failed to submit leave request");
      }
    } catch (err: any) {
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const openActionModal = (req: any, action: "approve" | "reject") => {
    setSelectedRequest(req);
    setActionType(action);
    setRemarks("");
  };

  const handleHodAction = async () => {
    if (!selectedRequest) return;
    setActioning(true);

    try {
      const res = await fetch(`/api/hod/leaves/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          remarks,
        }),
      });

      if (res.ok) {
        // Refresh Lists
        await fetchHodPendingLeaves();
        setSelectedRequest(null);
      } else {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActioning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_HOD":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Pending HOD</span>;
      case "PENDING_DIRECTOR":
        return <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20">Pending Director</span>;
      case "APPROVED":
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Approved</span>;
      case "REJECTED":
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">Rejected</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/20">{status}</span>;
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <LogoSpinner />
        <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading leave gateway...</p>
      </div>
    );
  }

  const { faculty, quota, history, activeFaculty } = facultyData || {};
  const clRemaining = quota ? quota.clQuota - quota.clConsumed : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <FaCalendarAlt className="text-blue-600" /> Leave Requisitions
            </h1>
            <p className="text-slate-500 mt-1">
              Apply for leaves, check balances, and view your department approvals.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/faculty")}
              className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <FaHome /> Gateway
            </button>
            <button
              onClick={() => setIsApplyModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <FaPlus /> Apply Leave
            </button>
          </div>
        </div>

        {/* Tab Buttons (For HOD only) */}
        {isHOD && (
          <div className="mb-6 flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab("my-leaves")}
              className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                activeTab === "my-leaves"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              My Leaves & Quotas
            </button>
            <button
              onClick={() => setActiveTab("hod-approvals")}
              className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === "hod-approvals"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Department Approvals
              {hodPendingLeaves.length > 0 && (
                <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-xs font-bold animate-pulse">
                  {hodPendingLeaves.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("hod-upcoming")}
              className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "hod-upcoming"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <FaCalendarAlt className="text-emerald-600" /> Upcoming Department Leaves
            </button>
            <button
              onClick={() => setActiveTab("hod-all")}
              className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                activeTab === "hod-all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              All Department Leaves
            </button>
          </div>
        )}

        {/* Filter Controls Bar for HOD Department Views (hod-upcoming & hod-all) */}
        {(activeTab === "hod-upcoming" || activeTab === "hod-all") && isHOD && (
          <div className="mb-6 flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            {/* Leave Type Filter */}
            <select
              value={hodLeaveTypeFilter}
              onChange={(e) => setHodLeaveTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Leave Types</option>
              <option value="CL">CL (Casual Leave)</option>
              <option value="OD">OD (On Duty)</option>
              <option value="AL">AL (Academic Leave)</option>
              <option value="ML">ML (Medical Leave)</option>
            </select>

            {/* Status Filter */}
            <select
              value={hodStatusFilter}
              onChange={(e) => setHodStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_HOD">Pending HOD</option>
              <option value="PENDING_DIRECTOR">Pending Director</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {/* Date Preset Filter */}
            <select
              value={hodDateMode}
              onChange={(e) => setHodDateMode(e.target.value as any)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="ALL">📅 All Dates</option>
              <option value="TODAY">📍 Today</option>
              <option value="SPECIFIC">🎯 Specific Date</option>
              <option value="RANGE">📆 Date Range</option>
            </select>

            {/* Specific Date Input */}
            {hodDateMode === "SPECIFIC" && (
              <input
                type="date"
                value={hodSpecificDate}
                onChange={(e) => setHodSpecificDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
              />
            )}

            {/* Date Range Inputs */}
            {hodDateMode === "RANGE" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={hodStartDateFilter}
                  onChange={(e) => setHodStartDateFilter(e.target.value)}
                  placeholder="From"
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={hodEndDateFilter}
                  onChange={(e) => setHodEndDateFilter(e.target.value)}
                  placeholder="To"
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Year Filter (only when Date Preset is ALL) */}
            {hodDateMode === "ALL" && activeTab === "hod-all" && (
              <select
                value={hodYearFilter}
                onChange={(e) => setHodYearFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Years</option>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            )}

            <span className="ml-auto text-xs text-slate-500 font-medium">
              {(activeTab === "hod-upcoming" ? hodUpcomingLeaves : hodAllLeaves).length} record(s)
            </span>
          </div>
        )}

        {/* Tab Content 1: My Leaves */}
        {activeTab === "my-leaves" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Balance Cards Ledger */}
            {quota && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* CL Card */}
                <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Casual Leave (CL)</span>
                    <FaCalendarAlt className="text-blue-500 text-lg" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900">{clRemaining}</span>
                    <span className="text-sm font-semibold text-slate-400">/ {quota.clQuota} Available</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Consumed: {quota.clConsumed} days this year
                  </div>
                </div>

                {/* OD Card */}
                <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">On Duty (OD)</span>
                    <FaBriefcase className="text-emerald-500 text-lg" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900">{quota.odConsumed}</span>
                    <span className="text-sm font-semibold text-slate-400">Consumed</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    No fixed annual limit
                  </div>
                </div>

                {/* AL Card */}
                <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Academic Leave (AL)</span>
                    <FaFileAlt className="text-purple-500 text-lg" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900">{quota.alConsumed}</span>
                    <span className="text-sm font-semibold text-slate-400">Consumed</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Academic / Annual Leave
                  </div>
                </div>

                {/* ML Card */}
                <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Medical Leave (ML)</span>
                    <FaInfoCircle className="text-rose-500 text-lg" />
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900">{quota.mlConsumed}</span>
                    <span className="text-sm font-semibold text-slate-400">Consumed</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Medical / Maternity / Sabbatical
                  </div>
                </div>
              </div>
            )}

            {/* Leave History Table */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">Leave Application History</h3>
              </div>
              {history && history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Leave Type</th>
                        <th className="px-6 py-3 font-semibold">Duration</th>
                        <th className="px-6 py-3 font-semibold">Days</th>
                        <th className="px-6 py-3 font-semibold">Substitute</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Reason</th>
                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {history.map((req: any) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-bold text-slate-800">{req.leaveType}</td>
                          <td className="px-6 py-4">
                            {formatISTDate(req.startDate)} <FaArrowRight className="inline mx-1 text-slate-400 text-xs" /> {formatISTDate(req.endDate)}
                          </td>
                          <td className="px-6 py-4 font-medium">{req.numberOfDays}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {req.substitute ? req.substitute.empName : "-"}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                          <td className="px-6 py-4 truncate max-w-[200px]" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => window.open(`/faculty/leaves/print/${req.id}`, "_blank")}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
                              <FaPrint /> Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p>You have not submitted any leave applications.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab Content 2: HOD Approvals */}
        {activeTab === "hod-approvals" && isHOD && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">Pending Department Leave Approvals</h3>
              </div>
              {hodPendingLeaves.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Faculty Member</th>
                        <th className="px-6 py-3 font-semibold">Leave Type</th>
                        <th className="px-6 py-3 font-semibold">Duration</th>
                        <th className="px-6 py-3 font-semibold">Days</th>
                        <th className="px-6 py-3 font-semibold">Substitute</th>
                        <th className="px-6 py-3 font-semibold">Reason</th>
                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {hodPendingLeaves.map((req: any) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{req.faculty?.empName}</p>
                            <p className="text-xs text-slate-400">{req.faculty?.empCode}</p>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{req.leaveType}</td>
                          <td className="px-6 py-4">
                            {formatISTDate(req.startDate)} <FaArrowRight className="inline mx-1 text-slate-400 text-xs" /> {formatISTDate(req.endDate)}
                          </td>
                          <td className="px-6 py-4 font-medium">{req.numberOfDays}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {req.substitute ? req.substitute.empName : "-"}
                          </td>
                          <td className="px-6 py-4 truncate max-w-[200px]" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => window.open(`/faculty/leaves/print/${req.id}`, "_blank")}
                              className="inline-flex items-center gap-1 text-xs font-semibold border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50"
                              title="Print Preview"
                            >
                              <FaPrint />
                            </button>
                            <button
                              onClick={() => openActionModal(req, "approve")}
                              className="inline-flex items-center gap-1 rounded bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 border border-green-200 hover:bg-green-100"
                            >
                              <FaCheck /> Recommend
                            </button>
                            <button
                              onClick={() => openActionModal(req, "reject")}
                              className="inline-flex items-center gap-1 rounded bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 border border-red-200 hover:bg-red-100"
                            >
                              <FaTimes /> Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p>No pending department leaves to approve.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {/* Tab Content 3: HOD Upcoming Department Leaves & Tab 4: All Department Leaves */}
        {(activeTab === "hod-upcoming" || activeTab === "hod-all") && isHOD && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">
                  {activeTab === "hod-upcoming"
                    ? "Upcoming Scheduled Department Leaves & ODs"
                    : "All Department Faculty Leaves"}
                </h3>
                <span className="bg-slate-200 text-slate-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {(activeTab === "hod-upcoming" ? hodUpcomingLeaves : hodAllLeaves).length} total
                </span>
              </div>
              {(activeTab === "hod-upcoming" ? hodUpcomingLeaves : hodAllLeaves).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Faculty Member</th>
                        <th className="px-6 py-3 font-semibold">Leave Type</th>
                        <th className="px-6 py-3 font-semibold">Duration</th>
                        <th className="px-6 py-3 font-semibold">Days</th>
                        <th className="px-6 py-3 font-semibold">Substitute</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Reason</th>
                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(activeTab === "hod-upcoming" ? hodUpcomingLeaves : hodAllLeaves).map((req: any) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{req.faculty?.empName}</p>
                            <p className="text-xs text-slate-400">{req.faculty?.empCode}</p>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">{req.leaveType}</td>
                          <td className="px-6 py-4">
                            {formatISTDate(req.startDate)} <FaArrowRight className="inline mx-1 text-slate-400 text-xs" /> {formatISTDate(req.endDate)}
                          </td>
                          <td className="px-6 py-4 font-semibold">{req.numberOfDays}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {req.substitute ? req.substitute.empName : "-"}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                          <td className="px-6 py-4 truncate max-w-[200px]" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => window.open(`/faculty/leaves/print/${req.id}`, "_blank")}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
                              <FaPrint /> Print
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p>No department leave records found matching your filters.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Apply Leave Modal */}
      <AnimatePresence>
        {isApplyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200"
            >
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FaCalendarAlt className="text-blue-600" /> Leave Requisition Form
                </h3>
                <button
                  onClick={() => setIsApplyModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 font-medium">
                    ⚠️ {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 font-medium">
                    ✅ {successMsg}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Leave Type
                    </label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CL">Casual Leave (CL)</option>
                      <option value="OD">On Duty (OD)</option>
                      <option value="AL">Academic Leave (AL)</option>
                      <option value="ML">Medical Leave (ML)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      No. of Days
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={numberOfDays}
                      onChange={(e) => setNumberOfDays(parseFloat(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Designated Substitute Faculty
                  </label>
                  <select
                    value={substituteId}
                    onChange={(e) => setSubstituteId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Substitute Colleague --</option>
                    {activeFaculty?.map((fac: any) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.empName} ({fac.empCode} - {fac.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Reason / Purpose of Leave
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter details / reason for requisition..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  ></textarea>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsApplyModalOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:bg-blue-400"
                  >
                    {submitting ? "Submitting..." : "Submit Requisition"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HOD Remarks / Recommendation Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200"
            >
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 capitalize">
                  {actionType} Leave Request
                </h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Are you sure you want to <span className="font-semibold">{actionType}</span> the leave request of{" "}
                  <span className="font-bold text-slate-800">{selectedRequest.faculty?.empName}</span> for{" "}
                  <span className="font-bold text-slate-800">{selectedRequest.numberOfDays} days</span>?
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter recommendations/remarks..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleHodAction}
                    disabled={actioning}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                      actionType === "approve"
                        ? "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                        : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                    }`}
                  >
                    {actioning ? "Processing..." : actionType === "approve" ? "Recommend Approval" : "Confirm Rejection"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
