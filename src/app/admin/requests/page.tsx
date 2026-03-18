"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaKey, FaUserCheck, FaExclamationTriangle, FaClock, FaCheckCircle, FaTrashAlt, FaArrowLeft } from "react-icons/fa";
import { formatISTDate } from "@/lib/dateUtils";
import Link from "next/link";

interface ResetRequest {
    id: string;
    createdAt: string;
    userId: string;
    user: {
        username: string;
        role: string;
        faculty?: {
            empName: string;
            empCode: string;
            department: { name: string };
        };
    };
}

export default function AdminPasswordRequestsPage() {
    const [requests, setRequests] = useState<ResetRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password/requests");
            if (res.ok) {
                const data = await res.json();
                setRequests(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = async (requestId: string, action: 'approve' | 'reject') => {
        setProcessingId(requestId);
        setMessage(null);
        try {
            const res = await fetch("/api/auth/forgot-password/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId, action }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: 'success', text: data.message });
                setRequests(requests.filter(r => r.id !== requestId));
            } else {
                setMessage({ type: 'error', text: data.error || "Failed to process request." });
            }
        } catch (error) {
            setMessage({ type: 'error', text: "An error occurred." });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="mx-auto max-w-6xl animate-in fade-in duration-500 px-4 py-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="rounded-full bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600 transition-colors">
                        <FaArrowLeft />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900">Password Reset Requests</h1>
                        <p className="mt-2 text-slate-600">Review and manage users who have requested a password reset.</p>
                    </div>
                </div>
                <div className="flex h-12 items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow-sm ring-1 ring-slate-900/5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                        {requests.length}
                    </span>
                    <span className="text-sm font-semibold text-slate-600">Pending Requests</span>
                </div>
            </div>

            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-6 flex items-center gap-3 rounded-xl p-4 text-sm font-bold border ${
                        message.type === 'success' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                >
                    {message.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    {message.text}
                </motion.div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5 transition-all">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                        <p className="mt-4 text-sm font-medium text-slate-500">Scanning for requests...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <FaKey size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No Pending Requests</h3>
                        <p className="mt-1 text-slate-500">Everything is up to date! There are no unresolved password resets.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-6 py-4">User Details</th>
                                    <th className="px-6 py-4">Requested On</th>
                                    <th className="px-6 py-4">Default Info</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <AnimatePresence mode="popLayout">
                                    {requests.map((request) => (
                                        <motion.tr
                                            layout
                                            key={request.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="hover:bg-slate-50/50 transition-colors"
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                                                        {request.user.role === 'STUDENT' ? 'ST' : 'FA'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">
                                                            {request.user.faculty?.empName || request.user.username}
                                                        </p>
                                                        <p className="text-xs font-medium text-slate-500 font-mono">
                                                            @{request.user.username} • <span className="text-blue-600">{request.user.role}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <FaClock className="text-slate-400" />
                                                    {formatISTDate(request.createdAt)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="text-sm">
                                                    <p className="font-bold text-slate-700">
                                                        Reset to: <span className="font-mono text-indigo-600">{request.user.faculty?.empCode || request.user.username}</span>
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {request.user.faculty?.department?.name || 'Academic'}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleProcess(request.id, 'approve')}
                                                        disabled={!!processingId}
                                                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        <FaUserCheck /> Approve Reset
                                                    </button>
                                                    <button
                                                        onClick={() => handleProcess(request.id, 'reject')}
                                                        disabled={!!processingId}
                                                        className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
                                                        title="Reject Request"
                                                    >
                                                        <FaTrashAlt />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            <div className="mt-8 rounded-2xl bg-orange-50 p-6 border border-orange-200">
                 <div className="flex gap-4">
                     <FaExclamationTriangle className="text-orange-500 shrink-0 mt-1" size={24} />
                     <div>
                         <h4 className="font-bold text-orange-900">Important Instruction for Administrators</h4>
                         <p className="mt-1 text-sm text-orange-800 leading-relaxed">
                             Approving a reset will instantly change the user's password back to their <strong>Default Credential</strong>. 
                             For Students, this is their <strong>Roll Number</strong>. For Faculty, this is their <strong>Employee Code</strong>. 
                             Users should be advised to change their password immediately after logging in with the default.
                         </p>
                     </div>
                 </div>
            </div>
        </div>
    );
}
