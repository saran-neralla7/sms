"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaDownload, FaArrowLeft, FaImage, FaTimes, FaSearch, FaFileExcel } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import * as XLSX from "xlsx";

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
    const [searchQuery, setSearchQuery] = useState("");
    const [overviewDept, setOverviewDept] = useState("ALL");
    const [overviewYear, setOverviewYear] = useState("ALL");
    const [overviewSem, setOverviewSem] = useState("ALL");
    const [mainTab, setMainTab] = useState<"overview" | "edit-requests" | "student-tracker">("overview");

    // Student Tracker state
    const [trackerDept, setTrackerDept] = useState("");
    const [trackerYear, setTrackerYear] = useState("");
    const [trackerSem, setTrackerSem] = useState("");
    const [trackerData, setTrackerData] = useState<any[]>([]);
    const [trackerLoading, setTrackerLoading] = useState(false);
    const [trackerSearch, setTrackerSearch] = useState("");
    const [trackerDepts, setTrackerDepts] = useState<string[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({ id: "", open: false });
    const [remarks, setRemarks] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [duplicateModal, setDuplicateModal] = useState<any | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ id: string, open: boolean } | null>(null);
    const [viewModal, setViewModal] = useState<any | null>(null);
    const [editReqApplications, setEditReqApplications] = useState<any[]>([]);
    const [loadingEditReqs, setLoadingEditReqs] = useState(false);

    useEffect(() => {
        if (mainTab === "edit-requests" && editReqApplications.length === 0) {
            setLoadingEditReqs(true);
            fetch("/api/exam-applications?editRequested=true")
                .then(r => r.ok ? r.json() : [])
                .then(data => { setEditReqApplications(data); setLoadingEditReqs(false); });
        }
    }, [mainTab]);

    useEffect(() => {
        Promise.all([
            fetch("/api/exam-applications/stats").then(r => r.ok ? r.json() : []),
            fetch("/api/departments").then(r => r.ok ? r.json() : [])
        ]).then(([data, depts]) => {
            setStats(data);
            setTrackerDepts(depts.map((d: any) => d.name).sort());
            setLoading(false);
        });

        const handlePopState = () => {
            setSelectedCard(null);
            setApplications([]);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const loadApplications = async (card: StatCard) => {
        setSelectedCard(card);
        setLoading(true);
        window.history.pushState({ view: "details" }, "", `?view=details`);
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

    const handleApproveEdit = async (id: string) => {
        setActionLoading(id);
        const res = await fetch(`/api/exam-applications/${id}`, { method: "DELETE" });
        if (res.ok) {
            setApplications(prev => prev.filter(a => a.id !== id));
        }
        setActionLoading(null);
        setConfirmModal(null);
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

    const searchLower = searchQuery.toLowerCase();
    const baseFiltered = filter === "ALL" ? applications : 
                         filter === "DUPLICATE" ? applications.filter(a => a.duplicateUtr) :
                         filter === "EDIT_REQUESTS" ? applications.filter(a => a.editRequested) :
                         applications.filter(a => a.status === filter);
                         
    const filtered = baseFiltered.filter(a => 
        a.rollNumber.toLowerCase().includes(searchLower) || 
        (a.student?.name || "").toLowerCase().includes(searchLower)
    );

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
                            <button onClick={() => { 
                                setSelectedCard(null); 
                                setApplications([]); 
                                if (window.history.state?.view === "details") {
                                    window.history.back();
                                } else {
                                    window.history.replaceState(null, "", window.location.pathname);
                                }
                            }} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 mb-2">
                                <FaArrowLeft /> Back to Overview
                            </button>
                            <h1 className="text-2xl font-extrabold text-slate-900">{selectedCard.department}</h1>
                            <p className="text-slate-500">Year {selectedCard.year} — Semester {selectedCard.semester}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <input 
                                type="text"
                                placeholder="Search Name or Roll No..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:w-64"
                            />
                            <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                <option value="ALL">All ({applications.length})</option>
                                <option value="PENDING">Pending ({applications.filter(a => a.status === "PENDING").length})</option>
                                <option value="APPROVED">Approved ({applications.filter(a => a.status === "APPROVED").length})</option>
                                <option value="REJECTED">Rejected ({applications.filter(a => a.status === "REJECTED").length})</option>
                                <option value="DUPLICATE">Duplicate ({applications.filter(a => a.duplicateUtr).length})</option>
                                <option value="EDIT_REQUESTS">Edit Requests ({applications.filter(a => a.editRequested).length})</option>
                            </select>
                            <button onClick={handleExport} className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
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
                                        <th className="px-4 py-3 whitespace-nowrap">Roll No</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Student Name</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Subjects</th>
                                        <th className="px-4 py-3 whitespace-nowrap">UTR</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Amount Paid</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((app: any) => (
                                        <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setViewModal(app)}>{app.rollNumber}</td>
                                            <td className="px-4 py-3 text-slate-700 hover:text-blue-600 cursor-pointer" onClick={() => setViewModal(app)}>{app.student?.name || ""}</td>
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
                                                    <button onClick={() => setDuplicateModal(app)} className="mt-1 inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 border border-red-200 hover:bg-red-200 transition-colors whitespace-nowrap">
                                                        <FaExclamationTriangle /> DUPLICATE
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-sm font-medium text-slate-700">{app.amountPaid ? `₹${app.amountPaid}` : "—"}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-2 min-w-[140px]">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold w-fit ${
                                                        app.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                        app.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                        "bg-yellow-100 text-yellow-700"
                                                    }`}>
                                                        {app.status === "APPROVED" && <FaCheckCircle />}
                                                        {app.status === "REJECTED" && <FaTimesCircle />}
                                                        {app.status === "PENDING" && <FaClock />}
                                                        {app.status}
                                                    </span>
                                                    {app.editRequested && (
                                                        <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                                            <span className="inline-flex rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 border border-orange-200 w-fit">
                                                                EDIT REQUESTED
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 line-clamp-2" title={app.editRequestReason}>
                                                                {app.editRequestReason}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2 flex-wrap min-w-[150px]">
                                                {app.editRequested && (
                                                    <button
                                                        onClick={() => setConfirmModal({ id: app.id, open: true })}
                                                        disabled={actionLoading === app.id}
                                                        className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap outline-none"
                                                        title="Delete application & allow resubmit"
                                                    >
                                                        Approve Edit
                                                    </button>
                                                )}
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
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>

                {/* Duplicate UTR Modal */}
                <AnimatePresence>
                    {duplicateModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDuplicateModal(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                                <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-red-600">
                                    <FaExclamationTriangle /> Duplicate UTR Detected
                                </h3>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="mb-3 text-sm text-slate-600">This UTR number (<span className="font-mono font-bold text-slate-900">{duplicateModal.utrNumber}</span>) was also submitted by:</p>
                                    <div className="space-y-3">
                                        <div className="flex flex-col border-b border-slate-200 pb-2">
                                            <span className="text-xs font-semibold uppercase text-slate-500">Student Name</span>
                                            <span className="text-sm font-bold text-slate-900">{duplicateModal.duplicateDetails?.name || "Unknown"}</span>
                                        </div>
                                        <div className="flex flex-col border-b border-slate-200 pb-2">
                                            <span className="text-xs font-semibold uppercase text-slate-500">Roll Number</span>
                                            <span className="text-sm font-bold text-slate-900">{duplicateModal.duplicateDetails?.rollNumber || duplicateModal.duplicateUtrRollNo || "Unknown"}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-xs font-semibold uppercase text-slate-500">Original Submission</span>
                                            <span className="text-sm font-bold text-slate-900">
                                                {duplicateModal.duplicateDetails ? `Year ${duplicateModal.duplicateDetails.year}, Semester ${duplicateModal.duplicateDetails.semester}` : "Unknown"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button onClick={() => setDuplicateModal(null)} className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-300 transition-colors">
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

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

                {/* Approve Edit Confirmation Modal */}
                <AnimatePresence>
                    {confirmModal?.open && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                                <h3 className="mb-2 text-center text-lg font-bold text-slate-900">Approve Edit Request?</h3>
                                <p className="mb-6 text-center text-sm text-slate-500">
                                    This will permanently discard the current application and allow the student to submit a fresh one. This action cannot be undone.
                                </p>
                                <div className="flex justify-center gap-3">
                                    <button onClick={() => setConfirmModal(null)} className="rounded-xl px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={() => handleApproveEdit(confirmModal.id)} disabled={actionLoading === confirmModal.id} className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-bold text-white hover:bg-orange-700 transition-colors disabled:opacity-50 w-[140px] flex justify-center items-center">
                                        {actionLoading === confirmModal.id ? <LogoSpinner fullScreen={false} /> : "Approve Edit"}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Application Details Modal */}
                <AnimatePresence>
                    {viewModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewModal(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-slate-800">Application Details</h3>
                                    <button onClick={() => setViewModal(null)} className="text-slate-400 hover:text-slate-700"><FaTimes /></button>
                                </div>
                                
                                {viewModal.editRequested && (
                                    <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-orange-800">Edit Requested by Student</span>
                                        </div>
                                        <p className="text-sm text-slate-700">{viewModal.editRequestReason}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    {/* Photo */}
                                    <div className="flex flex-col items-center justify-start">
                                        {viewModal.student?.photoUrl ? (
                                            <img src={viewModal.student.photoUrl} alt="Student" className="h-32 w-32 rounded-xl object-cover border border-slate-200 shadow-sm" />
                                        ) : (
                                            <div className="h-32 w-32 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
                                                <FaImage size={32} />
                                            </div>
                                        )}
                                        <span className="mt-2 text-sm font-bold text-slate-800 text-center">{viewModal.student?.name || "Unknown"}</span>
                                        <span className="text-xs text-slate-500 font-mono">{viewModal.rollNumber}</span>
                                    </div>

                                    {/* Details */}
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                                            <div>
                                                <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Year & Semester</span>
                                                <span className="text-sm font-medium text-slate-900">Year {viewModal.year} — Sem {viewModal.semester}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Apply Status</span>
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${
                                                    viewModal.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                    viewModal.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                    "bg-yellow-100 text-yellow-700"
                                                }`}>{viewModal.status}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                                            <div>
                                                <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Payment Date</span>
                                                <span className="text-sm font-medium text-slate-900">{viewModal.paymentDate ? new Date(viewModal.paymentDate).toLocaleDateString("en-IN") : "—"}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Amount Paid</span>
                                                <span className="text-sm font-medium text-slate-900">{viewModal.amountPaid ? `₹${viewModal.amountPaid}` : "—"}</span>
                                            </div>
                                        </div>

                                        <div className="border-b border-slate-100 pb-4">
                                            <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">UTR Number</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm text-slate-900">{viewModal.utrNumber}</span>
                                                {viewModal.duplicateUtr && (
                                                    <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                                        DUPLICATE
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <span className="block text-xs uppercase font-semibold text-slate-500 mb-2">Applied Subjects</span>
                                            <ul className="text-sm text-slate-700 space-y-1">
                                                {(viewModal.subjects || []).map((s: any) => (
                                                    <li key={s.id} className="flex gap-2">
                                                        <span className="font-medium text-slate-600 min-w-[70px]">{s.subject?.code}</span>
                                                        <span>{s.subject?.name}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
                                    <button onClick={() => setViewModal(null)} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">Close</button>
                                    {viewModal.status === "PENDING" && (
                                        <>
                                            <button
                                                onClick={() => { setRejectModal({ id: viewModal.id, open: true }); setViewModal(null); }}
                                                disabled={actionLoading === viewModal.id}
                                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => { handleApprove(viewModal.id); setViewModal(null); }}
                                                disabled={actionLoading === viewModal.id}
                                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                        </>
                                    )}
                                </div>
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
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <h1 className="text-2xl font-extrabold text-slate-900">Exam Applications</h1>
                <p className="mt-1 text-slate-500">Manage departmental applications and requests.</p>
            </motion.div>

            {/* Tabs */}
            <div className="mb-8 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
                <button
                    onClick={() => setMainTab("overview")}
                    className={`flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all ${mainTab === "overview" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setMainTab("edit-requests")}
                    className={`flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all ${mainTab === "edit-requests" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                    Edit Requests {editReqApplications.length > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{editReqApplications.length}</span>}
                </button>
                <button
                    onClick={() => setMainTab("student-tracker")}
                    className={`flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold transition-all ${mainTab === "student-tracker" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                    Student Tracker
                </button>
            </div>

            {mainTab === "overview" ? (
                stats.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                        <p className="text-slate-500">No exam applications have been submitted yet.</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex flex-wrap gap-4">
                            <select value={overviewDept} onChange={e => setOverviewDept(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500">
                            <option value="ALL">All Departments</option>
                            {Array.from(new Set(stats.map(s => s.department))).sort().map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={overviewYear} onChange={e => setOverviewYear(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500">
                            <option value="ALL">All Years</option>
                            {["1", "2", "3", "4"].map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                        <select value={overviewSem} onChange={e => setOverviewSem(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500">
                            <option value="ALL">All Semesters</option>
                            {["1", "2"].map(s => <option key={s} value={s}>Semester {s}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {stats.filter(s => 
                            (overviewDept === "ALL" || s.department === overviewDept) &&
                            (overviewYear === "ALL" || s.year === overviewYear) &&
                            (overviewSem === "ALL" || s.semester === overviewSem)
                        ).map((card, i) => (
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
                </>
                )
            ) : mainTab === "edit-requests" ? (
                loadingEditReqs ? (
                    <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
                ) : editReqApplications.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                        <p className="text-slate-500">No edit requests found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Roll No</th>
                                    <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Student Name</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Subjects</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Reason</th>
                                    <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {editReqApplications.map((app: any) => (
                                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setViewModal(app)}>{app.rollNumber}</td>
                                        <td className="px-4 py-3 text-slate-700">{app.student?.name || ""}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {(app.subjects || []).map((s: any) => (
                                                    <span key={s.id} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{s.subject?.code || s.subjectId}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={app.editRequestReason}>{app.editRequestReason}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setConfirmModal({ id: app.id, open: true })}
                                                disabled={actionLoading === app.id}
                                                className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                                            >
                                                Approve Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : mainTab === "student-tracker" ? (
                <div>
                    <div className="mb-6 flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Department</label>
                            <select value={trackerDept} onChange={e => setTrackerDept(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 min-w-[200px]">
                                <option value="">Select Department</option>
                                {trackerDepts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Year</label>
                            <select value={trackerYear} onChange={e => setTrackerYear(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500">
                                <option value="">Year</option>
                                {["1","2","3","4"].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Semester</label>
                            <select value={trackerSem} onChange={e => setTrackerSem(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500">
                                <option value="">Sem</option>
                                {["1","2"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <button
                            disabled={!trackerDept || !trackerYear || !trackerSem || trackerLoading}
                            onClick={async () => {
                                setTrackerLoading(true);
                                const params = new URLSearchParams({ department: trackerDept, year: trackerYear, semester: trackerSem });
                                const res = await fetch(`/api/exam-applications/student-tracker?${params}`);
                                const data = await res.ok ? await res.json() : [];
                                setTrackerData(data);
                                setTrackerLoading(false);
                            }}
                            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {trackerLoading ? "Loading..." : "Load Tracker"}
                        </button>
                        {trackerData.length > 0 && (
                            <button
                                onClick={() => {
                                    const rows = trackerData.map(s => {
                                        const reg = s.regular;
                                        const backlogStr = s.backlogs.map((b: any) => `[${b.year}-${b.semester}] ${b.status} UTR:${b.utrNumber} ₹${b.amountPaid || 0}`).join(" | ");
                                        return {
                                            "Roll Number": s.rollNumber,
                                            "Student Name": s.name,
                                            [`Regular (${trackerYear}-${trackerSem}) Status`]: reg ? reg.status : "NOT APPLIED",
                                            [`Regular UTR`]: reg?.utrNumber || "",
                                            [`Regular Amount`]: reg?.amountPaid || "",
                                            [`Regular Payment Date`]: reg?.paymentDate ? new Date(reg.paymentDate).toLocaleDateString("en-IN") : "",
                                            "Backlog Applications": backlogStr || "None"
                                        };
                                    });
                                    const ws = XLSX.utils.json_to_sheet(rows);
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, "Student Tracker");
                                    XLSX.writeFile(wb, `Student_Tracker_${trackerDept}_${trackerYear}-${trackerSem}.xlsx`);
                                }}
                                className="rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-200 flex items-center gap-2"
                            >
                                <FaFileExcel /> Export Excel
                            </button>
                        )}
                    </div>

                    {trackerData.length > 0 && (
                        <div className="mb-4">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or roll number..."
                                    value={trackerSearch}
                                    onChange={e => setTrackerSearch(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {trackerLoading ? (
                        <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
                    ) : trackerData.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                            <p className="text-slate-500">Select department, year & semester, then click "Load Tracker" to view consolidated student applications.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 whitespace-nowrap">S.No</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Roll Number</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[150px]">Student Name</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Regular ({trackerYear}-{trackerSem})</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Regular UTR</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Payment Date</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[250px]">Backlog Applications</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {trackerData.filter(s => {
                                        if (!trackerSearch) return true;
                                        const q = trackerSearch.toLowerCase();
                                        return s.rollNumber.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
                                    }).map((s: any, idx: number) => {
                                        const reg = s.regular;
                                        const statusColor = !reg ? "text-red-600 font-bold" : reg.status === "APPROVED" ? "text-green-600 font-semibold" : reg.status === "REJECTED" ? "text-red-600 font-semibold" : "text-yellow-600 font-semibold";
                                        const statusText = !reg ? "NOT APPLIED" : reg.status === "PENDING" ? "PENDING" : reg.status;
                                        return (
                                            <tr key={s.rollNumber} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-blue-600">{s.rollNumber}</td>
                                                <td className="px-4 py-3 text-slate-700">{s.name}</td>
                                                <td className={`px-4 py-3 ${statusColor}`}>{statusText}</td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">{reg?.utrNumber || "—"}</td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">{reg ? `₹${reg.amountPaid || 0}` : "—"}</td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">{reg?.paymentDate ? new Date(reg.paymentDate).toLocaleDateString("en-IN") : "—"}</td>
                                                <td className="px-4 py-3">
                                                    {s.backlogs.length === 0 ? (
                                                        <span className="text-slate-400 text-xs">None</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {s.backlogs.map((b: any) => {
                                                                const bColor = b.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" : b.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200";
                                                                return (
                                                                    <div key={b.id} className={`rounded px-2 py-1 text-[10px] font-medium border ${bColor}`}>
                                                                        [{b.year}-{b.semester}] {b.status} — UTR: {b.utrNumber} (₹{b.amountPaid || 0})
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
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
            ) : null}
        </div>
    );
}
