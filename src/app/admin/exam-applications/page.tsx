"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaTrash, FaUserPlus, FaCalendarAlt, FaCheckCircle, FaClock, FaTimesCircle, FaDownload } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function AdminExamApplicationsPage() {
    const { data: session, status } = useSession();
    const [tab, setTab] = useState<"settings" | "accounts" | "stats">("settings");

    // Settings state
    const [settings, setSettings] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [settingForm, setSettingForm] = useState({ year: "", semester: "", startDate: "", endDate: "", lateFeeEndDate: "" });
    const [settingsLoading, setSettingsLoading] = useState(true);

    // Office account state
    const [accountForm, setAccountForm] = useState({ username: "", password: "", departmentId: "" });
    const [accountMsg, setAccountMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Stats state
    const [stats, setStats] = useState<any[]>([]);
    const [selectedCard, setSelectedCard] = useState<any | null>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [duplicateModal, setDuplicateModal] = useState<any | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ id: string, type: "DELETE" | "APPROVE_EDIT", open: boolean } | null>(null);

    const refreshStats = () => {
        fetch("/api/exam-applications/stats").then(r => r.ok ? r.json() : []).then(st => setStats(st));
    };

    useEffect(() => {
        Promise.all([
            fetch("/api/exam-applications/settings").then(r => r.ok ? r.json() : []),
            fetch("/api/departments").then(r => r.ok ? r.json() : []),
            fetch("/api/exam-applications/stats").then(r => r.ok ? r.json() : [])
        ]).then(([s, d, st]) => {
            setSettings(s);
            setDepartments(Array.isArray(d) ? d : []);
            setStats(st);
            setSettingsLoading(false);
        });

        const handlePopState = () => {
            setSelectedCard(null);
            setApplications([]);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const handleCreateSetting = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch("/api/exam-applications/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settingForm)
        });
        if (res.ok) {
            const s = await res.json();
            setSettings(prev => [...prev.filter(p => p.id !== s.id), s]);
            setSettingForm({ year: "", semester: "", startDate: "", endDate: "", lateFeeEndDate: "" });
        }
    };

    const handleDeleteSetting = async (id: string) => {
        await fetch(`/api/exam-applications/settings/${id}`, { method: "DELETE" });
        setSettings(prev => prev.filter(s => s.id !== id));
    };

    const handleCreateAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountMsg(null);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: accountForm.username,
                    password: accountForm.password,
                    role: "OFFICE",
                    departmentId: accountForm.departmentId || null
                })
            });
            if (res.ok) {
                setAccountMsg({ type: "success", text: "Office account created successfully!" });
                setAccountForm({ username: "", password: "", departmentId: "" });
            } else {
                const data = await res.json();
                setAccountMsg({ type: "error", text: data.error || "Failed to create account" });
            }
        } catch {
            setAccountMsg({ type: "error", text: "Something went wrong" });
        }
    };

    const loadApplications = async (card: any) => {
        setSelectedCard(card);
        setLoadingApps(true);
        window.history.pushState({ view: "details" }, "", `?view=details`);
        const params = new URLSearchParams({ department: card.department, year: card.year, semester: card.semester });
        const res = await fetch(`/api/exam-applications?${params}`);
        if (res.ok) {
            const data = await res.json();
            setApplications(data);
        }
        setLoadingApps(false);
    };

    const handleDeleteApplication = async (id: string) => {
        setActionLoading(id);
        const res = await fetch(`/api/exam-applications/${id}`, { method: "DELETE" });
        if (res.ok) {
            setApplications(prev => prev.filter(a => a.id !== id));
            refreshStats();
        }
        setActionLoading(null);
        setConfirmModal(null);
    };

    const handleApproveEdit = async (id: string) => {
        setActionLoading(id);
        const res = await fetch(`/api/exam-applications/${id}`, { method: "DELETE" });
        if (res.ok) {
            setApplications(prev => prev.filter(a => a.id !== id));
            refreshStats();
        }
        setActionLoading(null);
        setConfirmModal(null);
    };

    if (status === "loading" || settingsLoading) {
        return <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>;
    }

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
                                <FaClock /> Back to Stats
                            </button>
                            <h1 className="text-2xl font-extrabold text-slate-900">{selectedCard.department}</h1>
                            <p className="text-slate-500">Year {selectedCard.year} — Semester {selectedCard.semester}</p>
                        </div>
                        <div className="flex gap-2">
                            <select
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                onChange={(e) => {
                                    if (e.target.value === "DUPLICATE") {
                                        setApplications([...applications].sort((a, b) => (b.duplicateUtr ? 1 : 0) - (a.duplicateUtr ? 1 : 0)));
                                    } else if (e.target.value === "EDIT_REQUESTS") {
                                        setApplications([...applications].sort((a, b) => (b.editRequested ? 1 : 0) - (a.editRequested ? 1 : 0)));
                                    }
                                }}
                            >
                                <option value="ALL">All Applications</option>
                                <option value="DUPLICATE">Duplicate UTRs First</option>
                                <option value="EDIT_REQUESTS">Edit Requests First</option>
                            </select>
                            <button
                                onClick={() => window.open(`/api/exam-applications/export?department=${selectedCard.department}&year=${selectedCard.year}&semester=${selectedCard.semester}`, "_blank")}
                                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                            >
                                <FaDownload /> Export Excel
                            </button>
                        </div>
                    </div>

                    {loadingApps ? (
                        <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
                    ) : applications.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                            <p className="text-slate-500">No applications found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 whitespace-nowrap">Roll No</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Student Name</th>
                                        <th className="px-4 py-3 whitespace-nowrap">UTR</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Payment Date</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[200px]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {applications.map((app: any) => (
                                        <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-800">{app.rollNumber}</td>
                                            <td className="px-4 py-3 text-slate-700">{app.student?.name || ""}</td>
                                            <td className="px-4 py-3 font-mono text-xs">
                                                {app.utrNumber}
                                                {app.duplicateUtr && (
                                                    <button onClick={() => setDuplicateModal(app)} className="mt-1 inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 border border-red-200 hover:bg-red-200 transition-colors whitespace-nowrap">
                                                        ⚠️ DUPLICATE
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">₹{app.amountPaid || "0"}</td>
                                            <td className="px-4 py-3 font-medium text-slate-600">
                                                {app.paymentDate ? new Date(app.paymentDate).toLocaleDateString("en-IN") : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-2 min-w-[140px]">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold w-fit ${
                                                        app.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                        app.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                        "bg-yellow-100 text-yellow-700"
                                                    }`}>
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
                                                        onClick={() => setConfirmModal({ id: app.id, type: "APPROVE_EDIT", open: true })}
                                                        disabled={actionLoading === app.id}
                                                        className="flex items-center gap-1 rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-200 disabled:opacity-50 whitespace-nowrap outline-none"
                                                        title="Delete application & allow resubmit"
                                                    >
                                                        Approve Edit
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setConfirmModal({ id: app.id, type: "DELETE", open: true })}
                                                    disabled={actionLoading === app.id}
                                                    className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 disabled:opacity-50"
                                                >
                                                    <FaTrash /> Delete
                                                </button>
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
                                    ⚠️ Duplicate UTR Detected
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

            {/* Confirmation Modal */}
            <AnimatePresence>
                {confirmModal?.open && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                            {confirmModal.type === "APPROVE_EDIT" ? (
                                <>
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
                                </>
                            ) : (
                                <>
                                    <h3 className="mb-2 text-center text-lg font-bold text-slate-900">Delete Application?</h3>
                                    <p className="mb-6 text-center text-sm text-slate-500">
                                        Are you sure you want to delete this application? This will allow the student to resubmit. This action cannot be undone.
                                    </p>
                                    <div className="flex justify-center gap-3">
                                        <button onClick={() => setConfirmModal(null)} className="rounded-xl px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                            Cancel
                                        </button>
                                        <button onClick={() => handleDeleteApplication(confirmModal.id)} disabled={actionLoading === confirmModal.id} className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50 w-[140px] flex justify-center items-center">
                                            {actionLoading === confirmModal.id ? <LogoSpinner fullScreen={false} /> : "Delete"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Exam Applications</h1>
                <p className="text-slate-500 mb-8">Manage exam application windows, office accounts, and view statistics.</p>
            </motion.div>

            {/* Tabs */}
            <div className="mb-8 flex gap-1 rounded-xl bg-slate-100 p-1">
                {[
                    { key: "settings", label: "Freeze Settings", icon: <FaCalendarAlt /> },
                    { key: "accounts", label: "Office Accounts", icon: <FaUserPlus /> },
                    { key: "stats", label: "Statistics", icon: <FaCheckCircle /> }
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => { setTab(t.key as any); setSelectedCard(null); }}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${tab === t.key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Freeze Settings */}
            {tab === "settings" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <form onSubmit={handleCreateSetting} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Add / Update Application Window</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                            <select value={settingForm.year} onChange={e => setSettingForm(p => ({ ...p, year: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required>
                                <option value="">Year</option>
                                {["1", "2", "3", "4"].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <select value={settingForm.semester} onChange={e => setSettingForm(p => ({ ...p, semester: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required>
                                <option value="">Semester</option>
                                {["1", "2"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Start Date</label>
                                <input type="date" value={settingForm.startDate} onChange={e => setSettingForm(p => ({ ...p, startDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">End Date</label>
                                <input type="date" value={settingForm.endDate} onChange={e => setSettingForm(p => ({ ...p, endDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Late Fee End (Optional)</label>
                                <input type="date" value={settingForm.lateFeeEndDate} onChange={e => setSettingForm(p => ({ ...p, lateFeeEndDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                            </div>
                        </div>
                        <button type="submit" className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                            <FaPlus /> Save Setting
                        </button>
                    </form>

                    {settings.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-slate-500">No freeze settings configured.</p></div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Year</th>
                                        <th className="px-4 py-3">Semester</th>
                                        <th className="px-4 py-3">Start</th>
                                        <th className="px-4 py-3">End</th>
                                        <th className="px-4 py-3">Late Fee End</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {settings.map((s: any) => (
                                        <tr key={s.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium">{s.year}</td>
                                            <td className="px-4 py-3">{s.semester}</td>
                                            <td className="px-4 py-3">{new Date(s.startDate).toLocaleDateString("en-IN")}</td>
                                            <td className="px-4 py-3">{new Date(s.endDate).toLocaleDateString("en-IN")}</td>
                                            <td className="px-4 py-3">{s.lateFeeEndDate ? new Date(s.lateFeeEndDate).toLocaleDateString("en-IN") : "—"}</td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => handleDeleteSetting(s.id)} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Office Accounts */}
            {tab === "accounts" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <form onSubmit={handleCreateAccount} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Create Office Staff Account</h2>

                        {accountMsg && (
                            <div className={`mb-4 rounded-lg p-3 text-sm border ${accountMsg.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                                {accountMsg.text}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Username</label>
                                <input type="text" value={accountForm.username} onChange={e => setAccountForm(p => ({ ...p, username: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Password</label>
                                <input type="password" value={accountForm.password} onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Department</label>
                                <select value={accountForm.departmentId} onChange={e => setAccountForm(p => ({ ...p, departmentId: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500">
                                    <option value="">All Departments</option>
                                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                            <FaUserPlus /> Create Account
                        </button>
                    </form>
                </motion.div>
            )}

            {/* Statistics */}
            {tab === "stats" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {stats.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-slate-500">No applications submitted yet.</p></div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {stats.map((card: any, i: number) => (
                                <motion.div key={`${card.department}-${card.year}-${card.semester}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                    <button
                                        onClick={() => loadApplications(card)}
                                        className="w-full text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                    >
                                        <h3 className="text-lg font-bold text-slate-800">{card.department}</h3>
                                        <p className="text-sm text-slate-500 mb-4">Year {card.year} • Semester {card.semester}</p>
                                        <div className="text-2xl font-extrabold text-blue-600 mb-3">{card.total} <span className="text-sm font-medium text-slate-500">total</span></div>
                                        <div className="flex gap-4 text-xs font-semibold mb-3">
                                            <span className="flex items-center gap-1 text-yellow-600"><FaClock /> {card.pending}</span>
                                            <span className="flex items-center gap-1 text-green-600"><FaCheckCircle /> {card.approved}</span>
                                            <span className="flex items-center gap-1 text-red-600"><FaTimesCircle /> {card.rejected}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider">
                                            View Applications →
                                        </div>
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    );
}
