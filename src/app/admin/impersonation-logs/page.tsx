"use client";

import React, { useState, useEffect } from "react";
import { FaUserSecret, FaSearch, FaFileExport, FaClock, FaShieldAlt, FaEye, FaCommentAlt, FaArrowLeft, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import Link from "next/link";
import * as XLSX from "xlsx";

interface AuditLogItem {
  id: string;
  createdAt: string;
  performedBy: string;
  action: string;
  adminUsername: string;
  targetUsername: string;
  targetName: string;
  targetRole: string;
  preComment: string;
  postComment: string | null;
  isReadOnly: boolean;
  status: string;
  durationSeconds: number | null;
  endedAt: string | null;
}

export default function ImpersonationLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredLogs.map((l) => ({
      "Log Date": new Date(l.createdAt).toLocaleString("en-IN"),
      "Admin Username": l.adminUsername,
      "Target Username": l.targetUsername,
      "Target Name": l.targetName,
      "Target Role": l.targetRole,
      "Mode": l.isReadOnly ? "View-Only" : "Full Access",
      "Pre-Access Reason": l.preComment,
      "Post-Exit Summary": l.postComment || "N/A (Active/Closed)",
      "Duration (Sec)": l.durationSeconds || "N/A",
      "Status": l.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Impersonation_Audit_Logs");
    XLSX.writeFile(wb, `Impersonation_Audit_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filteredLogs = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.adminUsername.toLowerCase().includes(s) ||
      l.targetUsername.toLowerCase().includes(s) ||
      l.targetName.toLowerCase().includes(s) ||
      l.preComment.toLowerCase().includes(s) ||
      (l.postComment && l.postComment.toLowerCase().includes(s))
    );
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/admin/users"
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition shadow-sm"
              title="Back to User Management"
            >
              <FaArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
              <FaUserSecret className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Impersonation Audit Logs</h1>
              <p className="text-sm text-slate-500">
                Complete, immutable history of all Admin login impersonation sessions and pre/post comments.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportExcel}
              className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition shadow-sm"
            >
              <FaFileExport />
              <span>Export Audit Excel</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Admin username, Target user, or comment text..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Total Sessions Logged: <span className="font-bold text-slate-800">{filteredLogs.length}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Admin Identity</th>
                  <th className="px-5 py-3.5">Target Account</th>
                  <th className="px-5 py-3.5">Mode</th>
                  <th className="px-5 py-3.5">Pre-Access Reason</th>
                  <th className="px-5 py-3.5">Post-Exit Summary</th>
                  <th className="px-5 py-3.5 text-right">Duration & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      Loading impersonation audit records...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No impersonation audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900 flex items-center space-x-1.5">
                        <FaShieldAlt className="text-indigo-500" />
                        <span>{log.adminUsername}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800">{log.targetName}</div>
                        <div className="text-[11px] text-slate-400">@{log.targetUsername} ({log.targetRole})</div>
                      </td>
                      <td className="px-5 py-4">
                        {log.isReadOnly ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-medium text-[11px] border border-indigo-200">
                            <FaEye className="w-3 h-3" /> View-Only
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-medium text-[11px] border border-amber-200">
                            Full Access
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 max-w-xs text-slate-700">
                        <div className="flex items-start space-x-1.5">
                          <FaCommentAlt className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{log.preComment}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-xs text-slate-700">
                        {log.postComment ? (
                          <div className="flex items-start space-x-1.5 text-emerald-700 font-medium">
                            <FaCheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{log.postComment}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 italic flex items-center gap-1">
                            <FaExclamationTriangle className="w-3 h-3" /> Pending Exit Summary
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="font-mono text-slate-700">{formatDuration(log.durationSeconds)}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                          log.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.status === "CLOSED_BY_TIMEOUT"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
