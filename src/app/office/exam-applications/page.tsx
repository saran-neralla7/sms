"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaDownload, FaArrowLeft, FaImage, FaTimes } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface StatCard {
    department: string;
    year: string;
    semester: string;
    total: number;
    pending: number;
    approved: number;
    rejected: number;
}

export default function OfficeExamApplicationsPage() {
    const { data: session } = useSession();
    const [stats, setStats] = useState<StatCard[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCard, setSelectedCard] = useState<StatCard | null>(null);
    const [filter, setFilter] = useState("ALL");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({ id: "", open: false });
    const [remarks, setRemarks] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/exam-applications/stats")
            .then(r => r.ok ? r.json() : [])
            .then(data => { setStats(data); setLoading(false); });
    }, []);

    const loadApplications = async (card: StatCard) => {
        setSelectedCard(card);
        setLoading(true);
        const params = new URLSearchParams({ department: card.department, year: card.year, semester: card.semester });
        const res = await fetch(`/api/exam-applications?${params}`);
        const data = await res.ok ? await res.json() : [];
        setApplications(data);
        setLoading(false);
    };

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        await fetch(`/api/exam-applications/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPROVED" })
        });
        setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "APPROVED", approvedBy: (session?.user as any)?.username } : a));
        setActionLoading(null);
    };

    const handleReject = async () => {
        setActionLoading(rejectModal.id);
        await fetch(`/api/exam-applications/${rejectModal.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "REJECTED", remarks })
        });
        setApplications(prev => prev.map(a => a.id === rejectModal.id ? { ...a, status: "REJECTED", remarks, approvedBy: (session?.user as any)?.username } : a));
        setRejectModal({ id: "", open: false });
        setRemarks("");
        setActionLoading(null);
    };

    const handleExport = () => {
        const params = new URLSearchParams();
        if (selectedCard) {
            params.set("department", selectedCard.department);
            params.set("year", selectedCard.year);
            params.set("semester", selectedCard.semester);
        }
        if (filter !== "ALL") params.set("status", filter);
        window.open(`/api/exam-applications/export?${params}`, "_blank");
    };

    const filtered = filter === "ALL" ? applications : applications.filter(a => a.status === filter);

    if (loading && !selectedCard) {
        return <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>;
    }

    // Detail view — application table
    if (selectedCard) {
        return (
            <div className="mx-auto max-w-6xl">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <button onClick={() => { setSelectedCard(null); setApplications([]); }} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 mb-2">
                                <FaArrowLeft /> Back to Overview
                            </button>
                            <h1 className="text-2xl font-extrabold text-slate-900">{selectedCard.department}</h1>
                            <p className="text-slate-500">Year {selectedCard.year} — Semester {selectedCard.semester}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                <option value="ALL">All ({applications.length})</option>
                                <option value="PENDING">Pending ({applications.filter(a => a.status === "PENDING").length})</option>
                                <option value="APPROVED">Approved ({applications.filter(a => a.status === "APPROVED").length})</option>
                                <option value="REJECTED">Rejected ({applications.filter(a => a.status === "REJECTED").length})</option>
                                <option value="DUPLICATE">Duplicate UTRs ({applications.filter(a => a.duplicateUtr).length})</option>
                            </select>
                            <button onClick={handleExport} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
                                <FaDownload /> Export Excel
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                            <p className="text-slate-500">No applications found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Roll No</th>
                                        <th className="px-4 py-3">Student Name</th>
                                        <th className="px-4 py-3">Subjects</th>
                                        <th className="px-4 py-3">UTR</th>
                                        <th className="px-4 py-3">Amount Paid</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((app: any) => (
                                        <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-800">{app.rollNumber}</td>
                                            <td className="px-4 py-3 text-slate-700">{app.student?.name || ""}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(app.subjects || []).map((s: any) => (
                                                        <span key={s.id} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{s.subject?.code || s.subjectId}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs">{app.utrNumber}</span>
                                                {app.duplicateUtr && (
                                                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 border border-red-200 whitespace-nowrap">
                                                        <FaExclamationTriangle /> DUPLICATE {app.duplicateUtrRollNo ? `(${app.duplicateUtrRollNo})` : ""}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-medium text-slate-700">{app.amountPaid ? `₹${app.amountPaid}` : "—"}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    app.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                    app.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                    "bg-yellow-100 text-yellow-700"
                                                }`}>
                                                    {app.status === "APPROVED" && <FaCheckCircle />}
                                                    {app.status === "REJECTED" && <FaTimesCircle />}
                                                    {app.status === "PENDING" && <FaClock />}
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {app.status === "PENDING" ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApprove(app.id)}
                                                            disabled={actionLoading === app.id}
                                                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectModal({ id: app.id, open: true })}
                                                            disabled={actionLoading === app.id}
                                                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">{app.approvedBy ? `by ${app.approvedBy}` : "—"}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>

                {/* Reject Remarks Modal */}
                <AnimatePresence>
                    {rejectModal.open && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejectModal({ id: "", open: false })} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
                                <h3 className="mb-2 text-lg font-bold text-slate-900">Reject Application</h3>
                                <p className="mb-4 text-sm text-slate-500">Please enter the reason for rejection.</p>
                                <textarea
                                    value={remarks}
                                    onChange={e => setRemarks(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                    placeholder="Remarks (optional)"
                                />
                                <div className="mt-4 flex gap-3 justify-end">
                                    <button onClick={() => setRejectModal({ id: "", open: false })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                                    <button onClick={handleReject} disabled={!!actionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Reject</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Screenshot Preview Modal */}
                <AnimatePresence>
                    {previewImage && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewImage(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative max-w-lg max-h-[80vh] rounded-xl bg-white p-2 shadow-2xl">
                                <button onClick={() => setPreviewImage(null)} className="absolute -top-3 -right-3 rounded-full bg-white p-2 shadow-lg text-slate-600 hover:text-slate-900"><FaTimes /></button>
                                <img src={previewImage} alt="Payment Screenshot" className="max-h-[75vh] rounded-lg object-contain" />
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // Overview — department-wise cards
    return (
        <div className="mx-auto max-w-6xl">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <h1 className="text-2xl font-extrabold text-slate-900">Exam Applications</h1>
                <p className="mt-1 text-slate-500">Department-wise application overview</p>
            </motion.div>

            {stats.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                    <p className="text-slate-500">No exam applications have been submitted yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.map((card, i) => (
                        <motion.div key={`${card.department}-${card.year}-${card.semester}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <button onClick={() => loadApplications(card)} className="block w-full text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer">
                                <h3 className="text-lg font-bold text-slate-800">{card.department}</h3>
                                <p className="text-sm text-slate-500 mb-4">Year {card.year} • Semester {card.semester}</p>
                                <div className="text-2xl font-extrabold text-blue-600 mb-3">{card.total} <span className="text-sm font-medium text-slate-500">applications</span></div>
                                <div className="flex gap-4 text-xs font-semibold">
                                    <span className="flex items-center gap-1 text-yellow-600"><FaClock /> {card.pending} Pending</span>
                                    <span className="flex items-center gap-1 text-green-600"><FaCheckCircle /> {card.approved} Approved</span>
                                    <span className="flex items-center gap-1 text-red-600"><FaTimesCircle /> {card.rejected} Rejected</span>
                                </div>
                            </button>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
