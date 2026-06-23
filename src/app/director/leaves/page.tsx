"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaPrint,
  FaArrowRight,
  FaHome,
  FaInfoCircle
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

export default function DirectorLeavesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

  // Remarks Modal State
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [remarks, setRemarks] = useState("");
  const [actioning, setActioning] = useState(false);

  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && role !== "DIRECTOR") {
      if (role === "ADMIN") {
        router.push("/admin/leaves");
      } else {
        router.push("/dashboard");
      }
    } else if (status === "authenticated") {
      fetchPendingLeaves();
    }
  }, [status, role]);

  const fetchPendingLeaves = async () => {
    try {
      const res = await fetch("/api/director/leaves/pending");
      if (res.ok) {
        const data = await res.json();
        setPendingLeaves(data.pendingLeaves || []);
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
      const res = await fetch(`/api/director/leaves/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          remarks,
        }),
      });

      if (res.ok) {
        await fetchPendingLeaves();
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
        <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading approvals console...</p>
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
              <FaCalendarAlt className="text-indigo-600" /> Director Leaves Console
            </h1>
            <p className="text-slate-500 mt-1">
              Final sanctioning portal for college-wide faculty leave applications.
            </p>
          </div>
          <div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <FaHome /> Dashboard
            </button>
          </div>
        </div>

        {/* Master Table of Pending Leaves */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
          <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-900">Leaves Waiting for Director Sanction</h3>
            <span className="bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {pendingLeaves.length} Pending
            </span>
          </div>

          {pendingLeaves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Faculty member</th>
                    <th className="px-6 py-3 font-semibold">Department</th>
                    <th className="px-6 py-3 font-semibold">Leave Type</th>
                    <th className="px-6 py-3 font-semibold">Duration</th>
                    <th className="px-6 py-3 font-semibold">Days</th>
                    <th className="px-6 py-3 font-semibold">Substitute</th>
                    <th className="px-6 py-3 font-semibold">Reason</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pendingLeaves.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{req.faculty?.empName}</p>
                        <p className="text-xs text-slate-400">{req.faculty?.empCode}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {req.faculty?.department?.name || "-"}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">{req.leaveType}</td>
                      <td className="px-6 py-4">
                        {formatISTDate(req.startDate)} <FaArrowRight className="inline mx-1 text-slate-400 text-xs" /> {formatISTDate(req.endDate)}
                      </td>
                      <td className="px-6 py-4 font-semibold">{req.numberOfDays}</td>
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
                          title="Print Preview Form"
                        >
                          <FaPrint />
                        </button>
                        <button
                          onClick={() => openActionModal(req, "approve")}
                          className="inline-flex items-center gap-1 rounded bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-700 border border-green-200 hover:bg-green-100"
                        >
                          <FaCheck /> Sanction
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
            <div className="py-12 text-center text-slate-400 bg-slate-50/50">
              <FaInfoCircle className="mx-auto text-4xl text-slate-300 mb-2" />
              <p>No leave requisitions are currently waiting for Director sanction.</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Remarks Modal */}
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
                    Director Remarks (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter approval/rejection remarks..."
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
                    onClick={handleAction}
                    disabled={actioning}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                      actionType === "approve"
                        ? "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                        : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                    }`}
                  >
                    {actioning ? "Processing..." : actionType === "approve" ? "Sanction Leave" : "Reject Leave"}
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
