"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarAlt,
  FaEdit,
  FaTrashAlt,
  FaHome,
  FaSearch,
  FaUserCog,
  FaPlus,
  FaArrowRight,
  FaInfoCircle
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

export default function AdminLeavesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"requests" | "upcoming" | "quotas">("requests");
  const [requests, setRequests] = useState<any[]>([]);
  const [upcomingRequests, setUpcomingRequests] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Filters
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  // Date Filters
  const [dateMode, setDateMode] = useState<"ALL" | "TODAY" | "SPECIFIC" | "RANGE">("ALL");
  const [specificDate, setSpecificDate] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Edit Request Modal State
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [editLeaveType, setEditLeaveType] = useState<"CL" | "OD" | "AL" | "ML">("CL");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNumberOfDays, setEditNumberOfDays] = useState(1);
  const [editStatus, setEditStatus] = useState<string>("PENDING_HOD");
  const [editReason, setEditReason] = useState("");
  const [editSubstituteId, setEditSubstituteId] = useState("");
  const [updating, setUpdating] = useState(false);

  // Quota Management State
  const [selectedFaculty, setSelectedFaculty] = useState<any>(null);
  const [clQuota, setClQuota] = useState<number>(8);
  const [quotaUpdating, setQuotaUpdating] = useState(false);

  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && !["ADMIN", "DIRECTOR"].includes(role)) {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchAdminLeavesData();
    }
  }, [status, role, activeTab, deptFilter, statusFilter, leaveTypeFilter, yearFilter, dateMode, specificDate, startDateFilter, endDateFilter]);

  // Calculate days for Edit Modal
  useEffect(() => {
    if (editStartDate && editEndDate) {
      const start = new Date(editStartDate);
      const end = new Date(editEndDate);
      const timeDiff = end.getTime() - start.getTime();
      const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      if (dayDiff > 0) {
        setEditNumberOfDays(dayDiff);
      } else {
        setEditNumberOfDays(1);
      }
    }
  }, [editStartDate, editEndDate]);

  const fetchAdminLeavesData = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/leaves?1=1`;

      if (activeTab === "upcoming") {
        url += `&upcoming=true`;
      } else {
        if (yearFilter && yearFilter !== "ALL") url += `&year=${yearFilter}`;
      }

      if (deptFilter) url += `&departmentId=${deptFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (leaveTypeFilter) url += `&leaveType=${leaveTypeFilter}`;

      if (dateMode === "TODAY") {
        const todayStr = new Date().toISOString().split("T")[0];
        url += `&startDate=${todayStr}&endDate=${todayStr}`;
      } else if (dateMode === "SPECIFIC" && specificDate) {
        url += `&startDate=${specificDate}&endDate=${specificDate}`;
      } else if (dateMode === "RANGE") {
        if (startDateFilter) url += `&startDate=${startDateFilter}`;
        if (endDateFilter) url += `&endDate=${endDateFilter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (activeTab === "upcoming") {
          setUpcomingRequests(data.leaveRequests || []);
        } else {
          setRequests(data.leaveRequests || []);
        }
        setFacultyList(data.faculty || []);
        if (data.departments) setDepartments(data.departments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (req: any) => {
    setEditingRequest(req);
    setEditLeaveType(req.leaveType);
    setEditStartDate(req.startDate.split("T")[0]);
    setEditEndDate(req.endDate.split("T")[0]);
    setEditNumberOfDays(req.numberOfDays);
    setEditStatus(req.status);
    setEditReason(req.reason);
    setEditSubstituteId(req.substituteId || "");
  };

  const handleUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    setUpdating(true);

    try {
      const res = await fetch(`/api/admin/leaves/${editingRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType: editLeaveType,
          startDateStr: editStartDate,
          endDateStr: editEndDate,
          numberOfDays: editNumberOfDays,
          status: editStatus,
          reason: editReason,
          substituteId: editSubstituteId || null,
        }),
      });

      if (res.ok) {
        await fetchAdminLeavesData();
        setEditingRequest(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update request");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Are you sure you want to delete this leave request? Leave balances will be recalculated automatically.")) return;

    try {
      const res = await fetch(`/api/admin/leaves/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchAdminLeavesData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete request");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuotaClick = (fac: any) => {
    setSelectedFaculty(fac);
    // Find current quota or set default 8
    const currentYear = new Date().getFullYear().toString();
    const existingQuota = fac.leaveQuotas?.find((q: any) => q.calendarYear === currentYear);
    setClQuota(existingQuota ? existingQuota.clQuota : 8);
  };

  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    setQuotaUpdating(true);

    try {
      const res = await fetch(`/api/admin/faculty/${selectedFaculty.id}/leaves`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clQuota,
          calendarYear: new Date().getFullYear().toString(),
        }),
      });

      if (res.ok) {
        await fetchAdminLeavesData();
        setSelectedFaculty(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update quota");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQuotaUpdating(false);
    }
  };

  const filteredFaculty = facultyList.filter(
    (fac) =>
      fac.empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fac.empCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fac.department?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_HOD":
        return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Pending HOD</span>;
      case "PENDING_DIRECTOR":
        return <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20">Pending Director</span>;
      case "APPROVED":
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Approved</span>;
      case "REJECTED":
        return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-600/20">Rejected</span>;
      default:
        return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-600/20">{status}</span>;
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <LogoSpinner />
        <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading administration panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <FaCalendarAlt className="text-slate-800" /> Leaves Administration
            </h1>
            <p className="text-slate-500 mt-1">
              Manage quotas, edit approved/pending applications, and override balances.
            </p>
          </div>
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <FaHome /> Admin Dashboard
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === "requests"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Leave Requests Overrides
          </button>
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "upcoming"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FaCalendarAlt className="text-emerald-600" /> Upcoming Leaves
          </button>
          <button
            onClick={() => setActiveTab("quotas")}
            className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "quotas"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Annual Quotas Manager
          </button>
        </div>

        {/* Filters (For requests & upcoming tabs) */}
        {(activeTab === "requests" || activeTab === "upcoming") && (
          <div className="mb-6 flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Leave Type Filter */}
            <select
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              value={dateMode}
              onChange={(e) => setDateMode(e.target.value as any)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-700"
            >
              <option value="ALL">📅 All Dates</option>
              <option value="TODAY">📍 Today</option>
              <option value="SPECIFIC">🎯 Specific Date</option>
              <option value="RANGE">📆 Date Range</option>
            </select>

            {/* Specific Date Input */}
            {dateMode === "SPECIFIC" && (
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
              />
            )}

            {/* Date Range Inputs */}
            {dateMode === "RANGE" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  placeholder="From"
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  placeholder="To"
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Year Filter (only when Date Preset is ALL) */}
            {dateMode === "ALL" && activeTab === "requests" && (
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
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
              {activeTab === "upcoming" ? upcomingRequests.length : requests.length} record(s)
            </span>
          </div>
        )}

        {/* Tab 1 & Tab 2: Requests / Upcoming */}
        {(activeTab === "requests" || activeTab === "upcoming") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900 font-sans">
                  {activeTab === "upcoming" ? "Upcoming Scheduled Leaves & ODs" : "All Faculty Leave Requests"}
                </h3>
                <span className="bg-slate-200 text-slate-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {(activeTab === "upcoming" ? upcomingRequests : requests).length} total
                </span>
              </div>

              {(activeTab === "upcoming" ? upcomingRequests : requests).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Faculty member</th>
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
                      {(activeTab === "upcoming" ? upcomingRequests : requests).map((req: any) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800">{req.faculty?.empName}</p>
                            <p className="text-xs text-slate-400">{req.faculty?.empCode} • {req.faculty?.department?.name}</p>
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
                          <td className="px-6 py-4 truncate max-w-[150px]" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => handleEditClick(req)}
                              className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 border border-blue-200 hover:bg-blue-100"
                            >
                              <FaEdit /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700 border border-red-200 hover:bg-red-100"
                            >
                              <FaTrashAlt /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p>No leave requests found in the system.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab 2: Quota Manager */}
        {activeTab === "quotas" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm max-w-md">
              <FaSearch className="text-slate-400" />
              <input
                type="text"
                placeholder="Search faculty by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm text-slate-700 focus:outline-none"
              />
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
              <div className="border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-bold text-slate-900">Faculty Quotas List ({new Date().getFullYear()})</h3>
              </div>

              {filteredFaculty.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 border-collapse">
                    <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Faculty member</th>
                        <th className="px-6 py-3 font-semibold">Designation</th>
                        <th className="px-6 py-3 font-semibold">Department</th>
                        <th className="px-6 py-3 font-semibold text-center">CL Quota</th>
                        <th className="px-6 py-3 font-semibold text-center">CL Consumed</th>
                        <th className="px-6 py-3 font-semibold text-center">OD Consumed</th>
                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredFaculty.map((fac: any) => {
                        const currentYear = new Date().getFullYear().toString();
                        const quota = fac.leaveQuotas?.find((q: any) => q.calendarYear === currentYear);

                        return (
                          <tr key={fac.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800">{fac.empName}</p>
                              <p className="text-xs text-slate-400">{fac.empCode}</p>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-600">{fac.designation}</td>
                            <td className="px-6 py-4 text-slate-600">{fac.department?.name || "-"}</td>
                            <td className="px-6 py-4 text-center font-bold text-blue-600">{quota ? quota.clQuota : 8}</td>
                            <td className="px-6 py-4 text-center font-semibold text-slate-700">{quota ? quota.clConsumed : 0}</td>
                            <td className="px-6 py-4 text-center font-semibold text-slate-700">{quota ? quota.odConsumed : 0}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleQuotaClick(fac)}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                              >
                                <FaUserCog /> Adjust Quota
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p>No faculty matching the search term.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Edit Leave Request Modal */}
      <AnimatePresence>
        {editingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200"
            >
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">
                  Override Leave Request — {editingRequest.faculty?.empName}
                </h3>
                <button
                  onClick={() => setEditingRequest(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateRequest} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Leave Type
                    </label>
                    <select
                      value={editLeaveType}
                      onChange={(e) => setEditLeaveType(e.target.value as any)}
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
                      value={editNumberOfDays}
                      onChange={(e) => setEditNumberOfDays(parseFloat(e.target.value))}
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
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
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
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Substitute Faculty
                    </label>
                    <select
                      value={editSubstituteId}
                      onChange={(e) => setEditSubstituteId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- No Substitute --</option>
                      {facultyList
                        .filter((f) => f.id !== editingRequest.facultyId)
                        .map((fac) => (
                          <option key={fac.id} value={fac.id}>
                            {fac.empName}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Request Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PENDING_HOD">Pending HOD</option>
                      <option value="PENDING_DIRECTOR">Pending Director</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Reason
                  </label>
                  <textarea
                    rows={3}
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  ></textarea>
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingRequest(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:bg-blue-400"
                  >
                    {updating ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quota Adjustment Modal */}
      <AnimatePresence>
        {selectedFaculty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200"
            >
              <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-900">
                  Adjust Casual Leaves Quota
                </h3>
                <button
                  onClick={() => setSelectedFaculty(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateQuota} className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  Adjusting the Casual Leaves (CL) quota for{" "}
                  <span className="font-bold text-slate-800">{selectedFaculty.empName}</span> for the calendar year{" "}
                  <span className="font-bold text-slate-800">{new Date().getFullYear()}</span>.
                </p>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Annual CL Quota
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={clQuota}
                    onChange={(e) => setClQuota(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedFaculty(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quotaUpdating}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition disabled:bg-blue-400"
                  >
                    {quotaUpdating ? "Saving..." : "Update Quota"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
