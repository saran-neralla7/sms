"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarAlt, FaCheck, FaTimes, FaPrint,
  FaArrowRight, FaHome, FaInfoCircle, FaFilter, FaHistory, FaClock
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

const STATUS_BADGE: Record<string, string> = {
  PENDING_HOD:      "bg-amber-100 text-amber-800 border border-amber-200",
  PENDING_DIRECTOR: "bg-blue-100 text-blue-800 border border-blue-200",
  APPROVED:         "bg-green-100 text-green-800 border border-green-200",
  REJECTED:         "bg-red-100 text-red-800 border border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_HOD:      "Pending HOD",
  PENDING_DIRECTOR: "Pending Director",
  APPROVED:         "Approved",
  REJECTED:         "Rejected",
};

export default function HodLeavesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [department, setDepartment] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [remarks, setRemarks] = useState("");
  const [actioning, setActioning] = useState(false);

  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && role !== "HOD") {
      router.push("/dashboard");
    } else if (status === "authenticated") {
      fetchPendingLeaves();
      fetchAllLeaves();
    }
  }, [status, role]);

  useEffect(() => {
    if (status === "authenticated" && role === "HOD") {
      fetchAllLeaves();
    }
  }, [statusFilter, yearFilter]);

  const fetchPendingLeaves = async () => {
    try {
      const res = await fetch("/api/hod/leaves/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingLeaves(data.pendingLeaves || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllLeaves = async () => {
    setLoading(true);
    try {
      let url = `/api/hod/leaves/all?year=${yearFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAllLeaves(data.leaves || []);
        if (data.department) setDepartment(data.department);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (req: any, action: "approve" | "reject") => {
    setSelectedRequest(req);
    setActionType(action);
    setRemarks("");
  };

  const handleAction = async () => {
    if (!selectedRequest) return;
    setActioning(true);
    try {
      const res = await fetch(`/api/hod/leaves/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionType, remarks }),
      });
      if (res.ok) {
        await fetchPendingLeaves();
        await fetchAllLeaves();
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

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <LogoSpinner />
        <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading leaves console...</p>
      </div>
    );
  }

  const displayLeaves = tab === "pending" ? pendingLeaves : allLeaves;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <FaCalendarAlt className="text-indigo-600" /> HOD — Leave Management
            </h1>
            <p className="text-slate-500 mt-1">
              {department ? (
                <><span className="font-semibold text-slate-700">{department.name}</span> — Review and forward leave requests to Director.</>
              ) : (
                "Review and forward leave requests to the Director."
              )}
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <FaHome /> Dashboard
          </button>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Pending Approval", value: pendingLeaves.length, color: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "Sent to Director", value: allLeaves.filter(l => l.status === "PENDING_DIRECTOR").length, color: "bg-blue-50 text-blue-700 border-blue-200" },
            { label: "Approved", value: allLeaves.filter(l => l.status === "APPROVED").length, color: "bg-green-50 text-green-700 border-green-200" },
            { label: "Rejected", value: allLeaves.filter(l => l.status === "REJECTED").length, color: "bg-red-50 text-red-700 border-red-200" },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
              <p className="text-3xl font-extrabold mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab("pending")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === "pending" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <FaClock /> Awaiting My Approval
            {pendingLeaves.length > 0 && (
              <span className="ml-1 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">{pendingLeaves.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("all")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === "all" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            <FaHistory /> All Department Leaves
          </button>
        </div>

        {/* Filters (All tab only) */}
        {tab === "all" && (
          <div className="mb-4 flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <FaFilter className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_HOD">Pending HOD</option>
              <option value="PENDING_DIRECTOR">Pending Director</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-indigo-500"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-500 font-medium">{allLeaves.length} record(s)</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
          <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center bg-slate-50">
            <h3 className="text-base font-bold text-slate-900">
              {tab === "pending" ? "Leaves Awaiting Your Approval" : `All Leave Records — ${department?.name || ""}`}
            </h3>
            <span className="bg-slate-200 text-slate-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {displayLeaves.length} {tab === "pending" ? "pending" : "total"}
            </span>
          </div>

          {displayLeaves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Faculty</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Days</th>
                    <th className="px-5 py-3">Substitute</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Status</th>
                    {tab === "pending" && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayLeaves.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">{req.faculty?.empName}</p>
                        <p className="text-xs text-slate-400">{req.faculty?.empCode} · {req.faculty?.designation}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs">{req.leaveType}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs">
                        {formatISTDate(req.startDate)} <FaArrowRight className="inline mx-1 text-slate-400" /> {formatISTDate(req.endDate)}
                      </td>
                      <td className="px-5 py-4 font-semibold">{req.numberOfDays}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{req.substitute ? req.substitute.empName : "—"}</td>
                      <td className="px-5 py-4 max-w-[180px] truncate text-xs" title={req.reason}>{req.reason}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[req.status] || "bg-slate-100 text-slate-700"}`}>
                          {STATUS_LABEL[req.status] || req.status}
                        </span>
                      </td>
                      {tab === "pending" && (
                        <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => window.open(`/faculty/leaves/print/${req.id}`, "_blank")}
                            className="inline-flex items-center gap-1 text-xs border border-slate-200 px-2 py-1 rounded text-slate-500 hover:bg-slate-50"
                            title="Print"
                          >
                            <FaPrint />
                          </button>
                          <button
                            onClick={() => openActionModal(req, "approve")}
                            className="inline-flex items-center gap-1 rounded bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 border border-green-200 hover:bg-green-100"
                          >
                            <FaCheck /> Forward
                          </button>
                          <button
                            onClick={() => openActionModal(req, "reject")}
                            className="inline-flex items-center gap-1 rounded bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 border border-red-200 hover:bg-red-100"
                          >
                            <FaTimes /> Reject
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-14 text-center text-slate-400 bg-slate-50/50">
              <FaInfoCircle className="mx-auto text-4xl text-slate-300 mb-2" />
              <p className="font-medium">No leave records found for the selected filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
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
                <h3 className="text-lg font-bold text-slate-900 capitalize">{actionType} Leave Request</h3>
                <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600">
                  {actionType === "approve"
                    ? <>Forward the leave of <span className="font-bold">{selectedRequest.faculty?.empName}</span> ({selectedRequest.numberOfDays} day(s)) to the Director for final sanction?</>
                    : <>Reject the leave request of <span className="font-bold">{selectedRequest.faculty?.empName}</span> ({selectedRequest.numberOfDays} day(s))?</>
                  }
                </p>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">HOD Remarks (Optional)</label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Enter remarks..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAction}
                    disabled={actioning}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                      actionType === "approve"
                        ? "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400"
                        : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                    }`}
                  >
                    {actioning ? "Processing..." : actionType === "approve" ? "Forward to Director" : "Reject Leave"}
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
