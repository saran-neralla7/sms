
"use client";

import { useState, useEffect } from "react";
import LogoSpinner from "@/components/LogoSpinner";
import { FaHistory, FaUser, FaInfoCircle } from "react-icons/fa";

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/audit-logs?page=${page}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.data);
                setTotalPages(data.meta.totalPages);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl pb-10">
            <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <FaHistory size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">System Audit Logs</h1>
                    <p className="text-sm text-slate-500">Track all critical actions performed by users.</p>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Entity</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center"><LogoSpinner /></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-500">No logs found.</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                                    <FaUser size={10} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">{log.performerName}</p>
                                                    <p className="text-xs text-slate-500">{log.performerRole}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium 
                                                ${log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                                                    log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                                                        'bg-blue-100 text-blue-800'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {log.entity} <span className="text-slate-400">({log.entityId})</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <details className="group">
                                                <summary className="flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 select-none">
                                                    <FaInfoCircle /> View JSON
                                                </summary>
                                                <pre className="mt-2 max-w-xs overflow-auto rounded bg-slate-900 p-2 text-[10px] text-slate-300">
                                                    {log.details}
                                                </pre>
                                            </details>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-between items-center">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="rounded px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-xs font-medium text-slate-500">Page {page} of {totalPages}</span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="rounded px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
