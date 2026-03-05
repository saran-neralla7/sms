"use client";

import { useState, useEffect } from "react";
import { FaArrowLeft, FaCheck, FaTimes, FaSearch, FaKey } from "react-icons/fa";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function PasswordRequestsPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Status feedback
    const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/requests/password");
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (error) {
            console.error("Failed to fetch requests", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
        try {
            const res = await fetch(`/api/admin/requests/password/${id}/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });

            if (res.ok) {
                const result = await res.json();
                setActionStatus({ type: "success", message: action === 'APPROVE' ? `Password reset to 'gvp1234'` : "Request rejected" });
                // Refresh list
                fetchRequests();

                // Clear success message after 3 seconds
                setTimeout(() => setActionStatus({ type: null, message: "" }), 5000);
            } else {
                setActionStatus({ type: "error", message: "Failed to process request" });
            }
        } catch (error) {
            setActionStatus({ type: "error", message: "Action failed" });
        }
    };

    const filteredRequests = requests.filter(r =>
        r.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-5xl space-y-6">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600 transition-colors">
                        <FaArrowLeft />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Password Reset Requests</h1>
                        <p className="text-slate-500">Manage user requests for password resets</p>
                    </div>
                </div>

                {/* Status Message */}
                <AnimatePresence>
                    {actionStatus.message && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`rounded-lg border p-4 shadow-sm ${actionStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}
                        >
                            <div className="flex items-center gap-2">
                                {actionStatus.type === 'success' ? <FaCheck /> : <FaTimes />}
                                {actionStatus.message}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Filters */}
                <div className="flex justify-between rounded-xl bg-white p-4 shadow-sm">
                    <div className="relative w-96">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by username or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={fetchRequests}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        Refresh List
                    </button>
                </div>

                {/* List */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-slate-500">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 mr-3"></div>
                            Loading requests...
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <div className="bg-slate-100 p-4 rounded-full mb-3">
                                <FaCheck className="text-slate-400" size={24} />
                            </div>
                            <p>No pending password reset requests.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Requested At</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{req.name}</div>
                                                <div className="text-slate-500 font-mono text-xs">@{req.username}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                    {req.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {new Date(req.requestedAt).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleAction(req.id, 'APPROVE')}
                                                        className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 border border-green-200 transition-colors"
                                                        title="Reset Password to Default"
                                                    >
                                                        <FaKey size={10} /> Reset
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(req.id, 'REJECT')}
                                                        className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                                                    >
                                                        <FaTimes size={10} /> Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
