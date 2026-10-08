"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaTrash, FaUserPlus, FaCalendarAlt, FaCheckCircle, FaClock, FaTimesCircle, FaDownload, FaTimes, FaImage, FaSearch, FaFileExcel, FaClipboardList, FaEdit, FaUserSlash, FaUnlock, FaBan, FaCheck } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import * as XLSX from "xlsx";

export default function AdminExamApplicationsPage() {
    const { data: session, status } = useSession();
    const [tab, setTab] = useState<"settings" | "accounts" | "stats" | "tracker">("settings");

    // Student Tracker state
    const [trackerDept, setTrackerDept] = useState("");
    const [trackerYear, setTrackerYear] = useState("");
    const [trackerSem, setTrackerSem] = useState("");
    const [trackerData, setTrackerData] = useState<any[]>([]);
    const [trackerLoading, setTrackerLoading] = useState(false);
    const [trackerSearch, setTrackerSearch] = useState("");

    // Academic Years state
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("ALL");

    // Settings state
    const [settings, setSettings] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [settingForm, setSettingForm] = useState({
        name: "",
        type: "REGULAR",
        year: "",
        semester: "",
        startDate: "",
        endDate: "",
        lateFeeEndDate: "",
        regularFee: "",
        circularFileUrl: "",
        accessMode: "ALL",
        allowedRollNumbers: "",
        allowAlumni: true,
        holdMessage: "Your exam application is kept on hold, please contact the OFFICE.",
        academicYearId: ""
    });
    const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
    const [settingsLoading, setSettingsLoading] = useState(true);

    // Audience / Blocklist management modal
    const [audienceModalSetting, setAudienceModalSetting] = useState<any | null>(null);
    const [audienceSearch, setAudienceSearch] = useState<string>("");
    const [audienceNewInput, setAudienceNewInput] = useState<string>("");
    const [audienceMode, setAudienceMode] = useState<string>("ALL");
    const [audienceSaving, setAudienceSaving] = useState<boolean>(false);
    const [audienceToast, setAudienceToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    const [viewModal, setViewModal] = useState<any | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({ id: "", open: false });
    const [remarks, setRemarks] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState("ALL");
    const [overviewDept, setOverviewDept] = useState("ALL");
    const [overviewYear, setOverviewYear] = useState("ALL");
    const [overviewSem, setOverviewSem] = useState("ALL");
    const [sortField, setSortField] = useState<"rollNumber" | "submittedAt" | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const handleSort = (field: "rollNumber" | "submittedAt") => {
        if (sortField === field) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
        else { setSortField(field); setSortDir("asc"); }
    };
    const sortIcon = (field: "rollNumber" | "submittedAt") => sortField !== field ? " ↕" : sortDir === "asc" ? " ↑" : " ↓";

    const refreshStats = (ayId = selectedAcademicYear) => {
        const url = ayId && ayId !== "ALL" ? `/api/exam-applications/stats?academicYearId=${ayId}` : "/api/exam-applications/stats";
        fetch(url).then(r => r.ok ? r.json() : []).then(st => setStats(st));
    };

    const loadData = (ayId = selectedAcademicYear) => {
        setSettingsLoading(true);
        const settingsUrl = ayId && ayId !== "ALL" ? `/api/exam-applications/settings?academicYearId=${ayId}` : "/api/exam-applications/settings";
        const statsUrl = ayId && ayId !== "ALL" ? `/api/exam-applications/stats?academicYearId=${ayId}` : "/api/exam-applications/stats";

        Promise.all([
            fetch(settingsUrl).then(r => r.ok ? r.json() : []),
            fetch("/api/departments").then(r => r.ok ? r.json() : []),
            fetch(statsUrl).then(r => r.ok ? r.json() : []),
            fetch("/api/academic-years").then(r => r.ok ? r.json() : [])
        ]).then(([s, d, st, ays]) => {
            setSettings(s);
            setDepartments(Array.isArray(d) ? d : []);
            setStats(st);
            if (Array.isArray(ays)) {
                setAcademicYears(ays);
                const currentAY = ays.find(y => y.isCurrent);
                if (currentAY && selectedAcademicYear === "ALL") {
                    // Set default academic year for setting form if not already set
                    setSettingForm(p => ({ ...p, academicYearId: p.academicYearId || currentAY.id }));
                }
            }
            setSettingsLoading(false);
        });
    };

    useEffect(() => {
        // Read academic-year-id cookie if present
        const match = document.cookie.match(new RegExp('(^| )academic-year-id=([^;]+)'));
        const cookieAy = match ? match[2] : null;
        if (cookieAy) {
            setSelectedAcademicYear(cookieAy);
            loadData(cookieAy);
        } else {
            loadData("ALL");
        }

        const handlePopState = () => {
            setSelectedCard(null);
            setApplications([]);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const handleAcademicYearChange = (ayId: string) => {
        setSelectedAcademicYear(ayId);
        setSelectedCard(null);
        setApplications([]);
        loadData(ayId);
    };

    const [uploadingFile, setUploadingFile] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(0);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingFile(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload-circular", {
                method: "POST",
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setSettingForm(p => ({ ...p, circularFileUrl: data.url }));
            } else {
                alert("Failed to upload circular.");
            }
        } catch (err) {
            alert("Error uploading file.");
        }
        setUploadingFile(false);
    };

    const handleSaveSetting = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = "/api/exam-applications/settings";
        const method = editingSettingId ? "PUT" : "POST";

        // Parse roll numbers from comma/newline/space separated text
        const rollsArray = settingForm.allowedRollNumbers
            ? Array.from(new Set(settingForm.allowedRollNumbers.split(/[\n,\s]+/).map(r => r.trim().toUpperCase()).filter(Boolean)))
            : [];

        const payload = {
            ...settingForm,
            allowedRollNumbers: rollsArray,
            allowAlumni: Boolean(settingForm.allowAlumni),
            academicYearId: settingForm.academicYearId || (selectedAcademicYear !== "ALL" ? selectedAcademicYear : (academicYears.find(y => y.isCurrent)?.id || null))
        };

        const body = editingSettingId ? JSON.stringify({ id: editingSettingId, ...payload }) : JSON.stringify(payload);
        
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body
        });
        if (res.ok) {
            const s = await res.json();
            if (editingSettingId) {
                setSettings(prev => prev.map(p => p.id === s.id ? s : p));
                setEditingSettingId(null);
            } else {
                setSettings(prev => [...prev, s]);
            }
            setSettingForm({
                name: "",
                type: "REGULAR",
                year: "",
                semester: "",
                startDate: "",
                endDate: "",
                lateFeeEndDate: "",
                regularFee: "",
                circularFileUrl: "",
                accessMode: "ALL",
                allowedRollNumbers: "",
                allowAlumni: true,
                holdMessage: "Your exam application is kept on hold, please contact the OFFICE.",
                academicYearId: selectedAcademicYear !== "ALL" ? selectedAcademicYear : (academicYears.find(y => y.isCurrent)?.id || "")
            });
            setFileInputKey(k => k + 1);
        } else {
            const errData = await res.json();
            alert(errData.error || "Failed to save setting");
        }
    };

    const handleEditSettingClick = (s: any) => {
        setEditingSettingId(s.id);
        const formatDateTime = (dateStr: string) => {
            if (!dateStr) return "";
            const d = new Date(dateStr);
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        };
        const rollString = Array.isArray(s.allowedRollNumbers) ? s.allowedRollNumbers.join("\n") : "";
        setSettingForm({
            name: s.name || "",
            type: s.type || "REGULAR",
            year: s.year || "",
            semester: s.semester || "",
            startDate: formatDateTime(s.startDate),
            endDate: formatDateTime(s.endDate),
            lateFeeEndDate: formatDateTime(s.lateFeeEndDate),
            regularFee: s.regularFee || "",
            circularFileUrl: s.circularFileUrl || "",
            accessMode: s.accessMode || "ALL",
            allowedRollNumbers: rollString,
            allowAlumni: s.allowAlumni !== undefined && s.allowAlumni !== null ? Boolean(s.allowAlumni) : (s.type === "SUPPLY"),
            holdMessage: s.holdMessage || "Your exam application is kept on hold, please contact the OFFICE.",
            academicYearId: s.academicYearId || ""
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDeleteSetting = async (id: string) => {
        await fetch(`/api/exam-applications/settings/${id}`, { method: "DELETE" });
        setSettings(prev => prev.filter(s => s.id !== id));
    };

    const openAudienceModal = (s: any) => {
        setAudienceModalSetting(s);
        setAudienceMode(s.accessMode || "ALL");
        setAudienceSearch("");
        setAudienceNewInput("");
        setAudienceToast(null);
    };

    const handleUnblockSingle = async (identifierToRemove: string) => {
        if (!audienceModalSetting) return;
        setAudienceSaving(true);
        setAudienceToast(null);
        try {
            const currentList: string[] = Array.isArray(audienceModalSetting.allowedRollNumbers)
                ? audienceModalSetting.allowedRollNumbers
                : [];
            const updatedList = currentList.filter(
                id => id.trim().toUpperCase() !== identifierToRemove.trim().toUpperCase()
            );
            const res = await fetch("/api/exam-applications/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: audienceModalSetting.id,
                    allowedRollNumbers: updatedList
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setAudienceModalSetting(updated);
                setSettings(prev => prev.map(s => s.id === updated.id ? updated : s));
                setAudienceToast({ type: "success", text: `Unblocked / Removed "${identifierToRemove}" successfully!` });
            } else {
                const err = await res.json();
                setAudienceToast({ type: "error", text: err.error || "Failed to update list" });
            }
        } catch (e) {
            setAudienceToast({ type: "error", text: "Network error updating list" });
        } finally {
            setAudienceSaving(false);
        }
    };

    const handleAddAudienceEntries = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!audienceModalSetting || !audienceNewInput.trim()) return;
        setAudienceSaving(true);
        setAudienceToast(null);
        try {
            const newEntries = audienceNewInput
                .split(/[\n,\s]+/)
                .map(r => r.trim().toUpperCase())
                .filter(Boolean);

            if (newEntries.length === 0) return;

            const currentList: string[] = Array.isArray(audienceModalSetting.allowedRollNumbers)
                ? audienceModalSetting.allowedRollNumbers
                : [];
            const mergedList = Array.from(new Set([...currentList, ...newEntries]));

            const targetMode = (audienceModalSetting.accessMode === "ALL" || !audienceModalSetting.accessMode)
                ? (audienceMode === "ALL" ? "BLACKLIST" : audienceMode)
                : audienceModalSetting.accessMode;

            const res = await fetch("/api/exam-applications/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: audienceModalSetting.id,
                    allowedRollNumbers: mergedList,
                    accessMode: targetMode
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setAudienceModalSetting(updated);
                setAudienceMode(updated.accessMode);
                setSettings(prev => prev.map(s => s.id === updated.id ? updated : s));
                setAudienceNewInput("");
                const actionVerb = targetMode === "BLACKLIST" ? "blocked" : "added to whitelist";
                setAudienceToast({
                    type: "success",
                    text: `Successfully ${actionVerb} ${newEntries.length} identifier(s)!`
                });
            } else {
                const err = await res.json();
                setAudienceToast({ type: "error", text: err.error || "Failed to update list" });
            }
        } catch (e) {
            setAudienceToast({ type: "error", text: "Network error updating list" });
        } finally {
            setAudienceSaving(false);
        }
    };

    const handleAudienceModeChange = async (newMode: string) => {
        if (!audienceModalSetting || newMode === audienceModalSetting.accessMode) return;
        setAudienceSaving(true);
        setAudienceToast(null);
        try {
            const res = await fetch("/api/exam-applications/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: audienceModalSetting.id,
                    accessMode: newMode,
                    allowedRollNumbers: audienceModalSetting.allowedRollNumbers || []
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setAudienceModalSetting(updated);
                setAudienceMode(updated.accessMode);
                setSettings(prev => prev.map(s => s.id === updated.id ? updated : s));
                setAudienceToast({
                    type: "success",
                    text: `Mode changed to ${newMode === "BLACKLIST" ? "Blocklist (Blacklist)" : newMode === "WHITELIST" ? "Whitelist" : "Open to All"}`
                });
            } else {
                const err = await res.json();
                setAudienceToast({ type: "error", text: err.error || "Failed to change mode" });
            }
        } catch (e) {
            setAudienceToast({ type: "error", text: "Network error changing mode" });
        } finally {
            setAudienceSaving(false);
        }
    };

    const handleClearAudienceList = async () => {
        if (!audienceModalSetting) return;
        const modeLabel = audienceModalSetting.accessMode === "BLACKLIST" ? "unblock all students" : "clear all whitelisted students";
        if (!confirm(`Are you sure you want to ${modeLabel}? This will remove all student identifiers from this list.`)) return;
        setAudienceSaving(true);
        setAudienceToast(null);
        try {
            const res = await fetch("/api/exam-applications/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: audienceModalSetting.id,
                    allowedRollNumbers: []
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setAudienceModalSetting(updated);
                setSettings(prev => prev.map(s => s.id === updated.id ? updated : s));
                setAudienceToast({ type: "success", text: "All students unblocked / cleared successfully!" });
            } else {
                const err = await res.json();
                setAudienceToast({ type: "error", text: err.error || "Failed to clear list" });
            }
        } catch (e) {
            setAudienceToast({ type: "error", text: "Network error clearing list" });
        } finally {
            setAudienceSaving(false);
        }
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
        if (card.settingId === null) {
            params.append("history", "true");
        } else {
            params.append("settingId", card.settingId);
        }
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

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        const res = await fetch(`/api/exam-applications/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "APPROVED" })
        });
        if (res.ok) {
            setApplications(prev => prev.map(a => a.id === id ? { ...a, status: "APPROVED", approvedBy: (session?.user as any)?.username } : a));
            refreshStats();
        }
        setActionLoading(null);
    };

    const handleReject = async () => {
        setActionLoading(rejectModal.id);
        const res = await fetch(`/api/exam-applications/${rejectModal.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "REJECTED", remarks })
        });
        if (res.ok) {
            setApplications(prev => prev.map(a => a.id === rejectModal.id ? { ...a, status: "REJECTED", remarks, approvedBy: (session?.user as any)?.username } : a));
            refreshStats();
        }
        setRejectModal({ id: "", open: false });
        setRemarks("");
        setActionLoading(null);
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
                            <p className="text-slate-500 font-medium">{selectedCard.settingName}</p>
                            <p className="text-xs text-slate-400 mt-1">Year {selectedCard.year} — Semester {selectedCard.semester}</p>
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
                            <button
                                onClick={() => window.open(`/api/exam-applications/export?department=${selectedCard.department}&year=${selectedCard.year}&semester=${selectedCard.semester}${selectedCard.settingId ? `&settingId=${selectedCard.settingId}` : `&history=true`}`, "_blank")}
                                className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors justify-center"
                            >
                                <FaDownload /> Export Excel
                            </button>
                        </div>
                    </div>

                    {(() => {
                        const searchLower = searchQuery.toLowerCase();
                        const baseFiltered = filter === "ALL" ? applications : 
                                             filter === "DUPLICATE" ? applications.filter(a => a.duplicateUtr) :
                                             filter === "EDIT_REQUESTS" ? applications.filter(a => a.editRequested) :
                                             applications.filter(a => a.status === filter);
                        const filtered = baseFiltered.filter((a: any) => 
                            a.rollNumber.toLowerCase().includes(searchLower) || 
                            (a.student?.name || "").toLowerCase().includes(searchLower)
                        );
                        const sortedFiltered = [...filtered].sort((a: any, b: any) => {
                            if (!sortField) return 0;
                            if (sortField === "rollNumber") return sortDir === "asc" ? a.rollNumber.localeCompare(b.rollNumber) : b.rollNumber.localeCompare(a.rollNumber);
                            if (sortField === "submittedAt") { const da = a.submittedAt ? new Date(a.submittedAt).getTime() : 0; const db = b.submittedAt ? new Date(b.submittedAt).getTime() : 0; return sortDir === "asc" ? da - db : db - da; }
                            return 0;
                        });
                        return (
                            <>

                    {loadingApps ? (
                        <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
                    ) : applications.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                            <p className="text-slate-500">No applications found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-sm min-w-[900px]">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort("rollNumber")}>Roll No{sortIcon("rollNumber")}</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[180px]">Student Name</th>
                                        <th className="px-4 py-3 whitespace-nowrap">UTR</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Paid</th>
                                        <th className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">Total</th>
                                        <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort("submittedAt")}>Submitted At{sortIcon("submittedAt")}</th>
                                        <th className="px-4 py-3 whitespace-nowrap">Payment Date</th>
                                        <th className="px-4 py-3 whitespace-nowrap min-w-[120px]">Status</th>
                                        <th className="px-4 py-3 whitespace-nowrap bg-white min-w-[180px] sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedFiltered.map((app: any) => {
                                        const paymentsList = Array.isArray(app.payments) && app.payments.length > 0 ? app.payments : [{ amountPaid: app.amountPaid }];
                                        const totalAmount = paymentsList.reduce((sum: number, p: any) => sum + (parseFloat(p.amountPaid) || 0), 0);
                                        return (
                                        <tr key={app.id} className={`hover:bg-slate-50 transition-colors ${app.status === "PENDING" ? "bg-yellow-50/30" : ""}`}>
                                            <td className="px-4 py-3 font-medium text-blue-600 hover:underline cursor-pointer whitespace-nowrap" onClick={() => setViewModal(app)}>{app.rollNumber}</td>
                                            <td className="px-4 py-3 text-slate-700 hover:text-blue-600 cursor-pointer" onClick={() => setViewModal(app)}>{app.student?.name || ""}</td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {paymentsList.map((p: any, i: number) => (
                                                        <span key={i} className="font-mono text-xs whitespace-nowrap">{p.utrNumber || "—"}</span>
                                                    ))}
                                                </div>
                                                {app.duplicateUtr && (
                                                    <button onClick={() => setDuplicateModal(app)} className="mt-1 inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700 border border-red-200 hover:bg-red-200 transition-colors whitespace-nowrap">
                                                        ⚠️ DUPLICATE
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    {paymentsList.map((p: any, i: number) => (
                                                        <span key={i} className="text-sm font-medium text-slate-700 whitespace-nowrap">{p.amountPaid ? `₹${p.amountPaid}` : "—"}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-800 bg-slate-50/50 align-top whitespace-nowrap">₹{totalAmount}</td>
                                            <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                                {app.submittedAt ? new Date(app.submittedAt).toLocaleString("en-IN", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                                {app.paymentDate ? new Date(app.paymentDate).toLocaleDateString("en-IN", { timeZone: 'Asia/Kolkata' }) : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold w-fit ${
                                                        app.status === "APPROVED" ? "bg-green-100 text-green-700" :
                                                        app.status === "REJECTED" ? "bg-red-100 text-red-700" :
                                                        "bg-yellow-100 text-yellow-700"
                                                    }`}>
                                                        {app.status}
                                                    </span>
                                                    {app.editRequested && (
                                                        <span className="inline-flex rounded bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 border border-orange-200 w-fit whitespace-nowrap">
                                                            ✏️ EDIT REQ
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 bg-white sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                                    {app.editRequested && (
                                                        <div className="text-[10px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 line-clamp-2" title={app.editRequestReason}>
                                                            {app.editRequestReason}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {app.editRequested && (
                                                            <button
                                                                onClick={() => setConfirmModal({ id: app.id, type: "APPROVE_EDIT", open: true })}
                                                                disabled={actionLoading === app.id}
                                                                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap outline-none"
                                                            >
                                                                ✓ Approve Edit
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setConfirmModal({ id: app.id, type: "DELETE", open: true })}
                                                            disabled={actionLoading === app.id}
                                                            className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            <FaTrash /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    </>
                );})()}
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

                                    <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                                        <div>
                                            <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Payment Date</span>
                                            <span className="text-sm font-medium text-slate-900">{viewModal.paymentDate ? new Date(viewModal.paymentDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Amount Paid</span>
                                            <span className="text-sm font-medium text-slate-900">{viewModal.amountPaid ? `₹${viewModal.amountPaid}` : "—"}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs uppercase font-semibold text-slate-500 mb-1">Submitted At</span>
                                            <span className="text-sm font-medium text-slate-900">{viewModal.submittedAt ? new Date(viewModal.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</span>
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

            {/* Reject Remarks Modal */}
            <AnimatePresence>
                {rejectModal.open && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                                <button onClick={handleReject} disabled={!!actionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                                    {actionLoading ? <LogoSpinner fullScreen={false} /> : "Reject"}
                                </button>
                            </div>
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                {/* Academic Year Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Academic Year:</span>
                    <select
                        value={selectedAcademicYear}
                        onChange={e => handleAcademicYearChange(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="ALL">All Academic Years</option>
                        {academicYears.map((ay: any) => (
                            <option key={ay.id} value={ay.id}>
                                {ay.name} {ay.isCurrent ? "★ (Active)" : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="mb-8 flex gap-1 rounded-xl bg-slate-100 p-1">
                {[
                    { key: "settings", label: "Freeze Settings", icon: <FaCalendarAlt /> },
                    { key: "accounts", label: "Office Accounts", icon: <FaUserPlus /> },
                    { key: "stats", label: "Statistics", icon: <FaCheckCircle /> },
                    { key: "tracker", label: "Student Tracker", icon: <FaClipboardList /> }
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
                    <form onSubmit={handleSaveSetting} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">{editingSettingId ? "Edit Application Window" : "Add Application Window"}</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Cycle Name (Optional)</label>
                                <input type="text" placeholder="e.g. April 2026 Exams" value={settingForm.name} onChange={e => setSettingForm(p => ({ ...p, name: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Exam Type</label>
                                <select value={settingForm.type} onChange={e => setSettingForm(p => ({ ...p, type: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required>
                                    <option value="REGULAR">Regular</option>
                                    <option value="SUPPLY">Supply / Backlog</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Year</label>
                                <select value={settingForm.year} onChange={e => setSettingForm(p => ({ ...p, year: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required>
                                    <option value="">Year</option>
                                    {["1", "2", "3", "4"].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Semester</label>
                                <select value={settingForm.semester} onChange={e => setSettingForm(p => ({ ...p, semester: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required>
                                    <option value="">Semester</option>
                                    {["1", "2"].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Start Date & Time</label>
                                <input type="datetime-local" value={settingForm.startDate} onChange={e => setSettingForm(p => ({ ...p, startDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">End Date & Time</label>
                                <input type="datetime-local" value={settingForm.endDate} onChange={e => setSettingForm(p => ({ ...p, endDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Late Fee End (Optional)</label>
                                <input type="datetime-local" value={settingForm.lateFeeEndDate} onChange={e => setSettingForm(p => ({ ...p, lateFeeEndDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Regular Fee (₹) (Optional)</label>
                                <input type="number" placeholder="e.g. 1500" value={(settingForm as any).regularFee || ""} onChange={e => setSettingForm(p => ({ ...p, regularFee: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Official Circular (Optional, PDF/Image)</label>
                                <input key={fileInputKey} type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                {(settingForm as any).circularFileUrl && (
                                    <div className="mt-2 text-xs">
                                        <a href={(settingForm as any).circularFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">View Current Circular</a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Audience Selection & Access Rules */}
                        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Student Access Rules</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="accessMode"
                                            value="ALL"
                                            checked={settingForm.accessMode === "ALL"}
                                            onChange={() => setSettingForm(p => ({ ...p, accessMode: "ALL" }))}
                                            className="h-4 w-4 text-blue-600"
                                        />
                                        <span className="text-sm font-medium text-slate-700">All Eligible Students (Default)</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="accessMode"
                                            value="WHITELIST"
                                            checked={settingForm.accessMode === "WHITELIST" || settingForm.accessMode === "SELECTED"}
                                            onChange={() => setSettingForm(p => ({ ...p, accessMode: "WHITELIST" }))}
                                            className="h-4 w-4 text-emerald-600"
                                        />
                                        <span className="text-sm font-semibold text-emerald-700">Allow Specific Students Only (Whitelist)</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="accessMode"
                                            value="BLACKLIST"
                                            checked={settingForm.accessMode === "BLACKLIST"}
                                            onChange={() => setSettingForm(p => ({ ...p, accessMode: "BLACKLIST" }))}
                                            className="h-4 w-4 text-red-600"
                                        />
                                        <span className="text-sm font-semibold text-red-700">Block Specific Students Only (Hold List / Blacklist)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Alumni Access Toggle */}
                            <div className="pt-2 border-t border-slate-200/80">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">Alumni Student Access</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="allowAlumni"
                                            value="true"
                                            checked={settingForm.allowAlumni === true}
                                            onChange={() => setSettingForm(p => ({ ...p, allowAlumni: true }))}
                                            className="h-4 w-4 text-blue-600"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Allow Alumni Students</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="allowAlumni"
                                            value="false"
                                            checked={settingForm.allowAlumni === false}
                                            onChange={() => setSettingForm(p => ({ ...p, allowAlumni: false }))}
                                            className="h-4 w-4 text-red-600"
                                        />
                                        <span className="text-xs font-medium text-red-700">Do Not Allow Alumni Students</span>
                                    </label>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    {settingForm.type === "REGULAR" ? "Typically 'Do Not Allow' for regular exams." : "Typically 'Allow' for supply exams."}
                                </p>
                            </div>

                            {(settingForm.accessMode === "WHITELIST" || settingForm.accessMode === "SELECTED" || settingForm.accessMode === "BLACKLIST") && (
                                <div className="pt-2 border-t border-slate-200/80 space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-semibold text-slate-700">
                                                {settingForm.accessMode === "BLACKLIST"
                                                    ? "Blocked Students: Roll Numbers or Mobile Numbers"
                                                    : "Allowed Students: Roll Numbers or Mobile Numbers"}
                                            </label>
                                            <span className="text-[11px] text-slate-500 font-medium">Supports Roll Numbers & 10-digit Mobile Numbers</span>
                                        </div>
                                        <textarea
                                            rows={4}
                                            value={settingForm.allowedRollNumbers}
                                            onChange={e => setSettingForm(p => ({ ...p, allowedRollNumbers: e.target.value }))}
                                            placeholder="Paste Roll Numbers or Mobile Numbers (separated by comma, space, or newline)&#10;e.g.&#10;23A91A0501&#10;9876543210&#10;23A91A0502, 9123456789"
                                            className="w-full font-mono text-xs rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                        />
                                        <p className="mt-1 text-xs text-slate-500">
                                            {settingForm.allowedRollNumbers
                                                ? `${settingForm.allowedRollNumbers.split(/[\n,\s]+/).map(r => r.trim()).filter(Boolean).length} identifier(s) specified (${settingForm.accessMode === "BLACKLIST" ? "will be blocked" : "will be allowed"})`
                                                : "Enter roll numbers or mobile numbers."}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                                            Hold Message Displayed to Unselected / Blocked Students
                                        </label>
                                        <input
                                            type="text"
                                            value={settingForm.holdMessage}
                                            onChange={e => setSettingForm(p => ({ ...p, holdMessage: e.target.value }))}
                                            placeholder="Your exam application is kept on hold, please contact the OFFICE."
                                            className="w-full text-xs rounded-xl border border-slate-300 bg-white p-2.5 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button type="submit" disabled={uploadingFile} className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                                {editingSettingId ? <FaEdit /> : <FaPlus />} {editingSettingId ? "Update Setting" : "Save Setting"}
                            </button>
                            {editingSettingId && (
                                <button type="button" onClick={() => {
                                    setEditingSettingId(null);
                                    setSettingForm({
                                        name: "",
                                        type: "REGULAR",
                                        year: "",
                                        semester: "",
                                        startDate: "",
                                        endDate: "",
                                        lateFeeEndDate: "",
                                        regularFee: "",
                                        circularFileUrl: "",
                                        accessMode: "ALL",
                                        allowedRollNumbers: "",
                                        allowAlumni: true,
                                        holdMessage: "Your exam application is kept on hold, please contact the OFFICE.",
                                        academicYearId: selectedAcademicYear !== "ALL" ? selectedAcademicYear : (academicYears.find(y => y.isCurrent)?.id || "")
                                    });
                                    setFileInputKey(k => k + 1);
                                }} className="flex items-center gap-2 rounded-xl bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 transition-colors">
                                    <FaTimes /> Cancel
                                </button>
                            )}
                        </div>
                    </form>

                    {settings.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-slate-500">No freeze settings configured.</p></div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Year</th>
                                        <th className="px-4 py-3">Semester</th>
                                        <th className="px-4 py-3">Audience</th>
                                        <th className="px-4 py-3">Start</th>
                                        <th className="px-4 py-3">End</th>
                                        <th className="px-4 py-3">Late Fee End</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {settings.map((s: any) => (
                                        <tr key={s.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold w-fit ${s.type === 'SUPPLY' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{s.type}</span>
                                                    {s.name && <span className="text-xs text-slate-500 mt-1">{s.name}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium">{s.year}</td>
                                            <td className="px-4 py-3">{s.semester}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    {s.accessMode === "BLACKLIST" ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAudienceModal(s)}
                                                            className="inline-flex items-center gap-1 rounded-full bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer text-left w-fit"
                                                            title="Click to manage & unblock students"
                                                        >
                                                            <FaBan className="text-[10px]" /> Blocked ({Array.isArray(s.allowedRollNumbers) ? s.allowedRollNumbers.length : 0})
                                                        </button>
                                                    ) : (s.accessMode === "SELECTED" || s.accessMode === "WHITELIST") ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAudienceModal(s)}
                                                            className="inline-flex items-center gap-1 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer text-left w-fit"
                                                            title="Click to manage whitelisted students"
                                                        >
                                                            <FaCheck className="text-[10px]" /> Whitelisted ({Array.isArray(s.allowedRollNumbers) ? s.allowedRollNumbers.length : 0})
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAudienceModal(s)}
                                                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer text-left w-fit"
                                                            title="Click to restrict or manage access"
                                                        >
                                                            Open to All
                                                        </button>
                                                    )}
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-medium w-fit ${s.allowAlumni ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        Alumni: {s.allowAlumni ? "Allowed" : "Not Allowed"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">{new Date(s.startDate).toLocaleString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{new Date(s.endDate).toLocaleString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{s.lateFeeEndDate ? new Date(s.lateFeeEndDate).toLocaleString("en-IN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : "—"}</td>
                                            <td className="px-4 py-3 flex items-center gap-1.5">
                                                <button
                                                    onClick={() => openAudienceModal(s)}
                                                    title="Manage Blocked / Whitelisted Students"
                                                    className="rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1"
                                                >
                                                    <FaUserSlash className="text-xs" />
                                                    <span className="hidden xl:inline">Audience</span>
                                                </button>
                                                <button onClick={() => handleEditSettingClick(s)} title="Edit Setting" className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-200">
                                                    <FaEdit />
                                                </button>
                                                <button onClick={() => handleDeleteSetting(s.id)} title="Delete Setting" className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">
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
                        <>
                            <div className="mb-6 flex flex-wrap gap-4">
                                <select value={overviewDept} onChange={e => setOverviewDept(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500">
                                    <option value="ALL">All Departments</option>
                                    {Array.from(new Set(stats.map(s => s.department))).sort().map(d => <option key={d as string} value={d as string}>{d as string}</option>)}
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
                                {stats.filter((s: any) => 
                                    (overviewDept === "ALL" || s.department === overviewDept) &&
                                    (overviewYear === "ALL" || s.year === overviewYear) &&
                                    (overviewSem === "ALL" || s.semester === overviewSem)
                                ).map((card: any, i: number) => (
                                    <motion.div key={`${card.department}-${card.year}-${card.semester}-${card.settingId || 'history'}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                                        <button
                                            onClick={() => loadApplications(card)}
                                            className="w-full text-left rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                        >
                                            <div className="mb-2">
                                                <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold w-fit ${card.settingId ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                                                    {card.settingName}
                                                </span>
                                            </div>
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
                        </>
                    )}
                </motion.div>
            )}

            {/* Student Tracker */}
            {tab === "tracker" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="mb-6 flex flex-wrap items-end gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Department</label>
                            <select value={trackerDept} onChange={e => setTrackerDept(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-blue-500 min-w-[200px]">
                                <option value="">Select Department</option>
                                {departments.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
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
                                        const backlogStr = s.backlogs.map((b: any) => `[${b.year}-${b.semester}] ${b.status} UTR:${b.utrNumber} \u20b9${b.amountPaid || 0}`).join(" | ");
                                        return {
                                            "Roll Number": s.rollNumber,
                                            "Student Name": s.name,
                                            [`Regular (${trackerYear}-${trackerSem}) Status`]: reg ? reg.status : "NOT APPLIED",
                                            [`Regular UTR`]: reg?.utrNumber || "",
                                            [`Regular Amount`]: reg?.amountPaid || "",
                                            [`Regular Payment Date`]: reg?.paymentDate ? new Date(reg.paymentDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
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
                                                <td className="px-4 py-3 text-slate-600 text-xs">{reg?.utrNumber || "\u2014"}</td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">{reg ? `\u20b9${reg.amountPaid || 0}` : "\u2014"}</td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">{reg?.paymentDate ? new Date(reg.paymentDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "\u2014"}</td>
                                                <td className="px-4 py-3">
                                                    {s.backlogs.length === 0 ? (
                                                        <span className="text-slate-400 text-xs">None</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {s.backlogs.map((b: any) => {
                                                                const bColor = b.status === "APPROVED" ? "bg-green-50 text-green-700 border-green-200" : b.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200";
                                                                return (
                                                                    <div key={b.id} className={`rounded px-2 py-1 text-[10px] font-medium border ${bColor}`}>
                                                                        [{b.year}-{b.semester}] {b.status} \u2014 UTR: {b.utrNumber} (\u20b9{b.amountPaid || 0})
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
                </motion.div>
            )}

            {/* Audience / Blocked List Management Modal */}
            <AnimatePresence>
                {audienceModalSetting && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setAudienceModalSetting(null)}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${audienceModalSetting.accessMode === "BLACKLIST" ? "bg-red-100 text-red-600" : "bg-purple-100 text-purple-600"}`}>
                                        {audienceModalSetting.accessMode === "BLACKLIST" ? <FaBan className="text-xl" /> : <FaUserSlash className="text-xl" />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">
                                            {audienceModalSetting.accessMode === "BLACKLIST"
                                                ? "Manage Blocked Students"
                                                : (audienceModalSetting.accessMode === "WHITELIST" || audienceModalSetting.accessMode === "SELECTED")
                                                    ? "Manage Whitelisted Students"
                                                    : "Manage Student Access Restrictions"}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            <span className="font-semibold text-slate-700">{audienceModalSetting.type}</span> • Year {audienceModalSetting.year}, Semester {audienceModalSetting.semester}
                                            {audienceModalSetting.name ? ` • ${audienceModalSetting.name}` : ""}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAudienceModalSetting(null)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            {/* Toast Notification */}
                            {audienceToast && (
                                <div className={`mt-3 rounded-lg p-2.5 text-xs font-semibold flex items-center justify-between border ${audienceToast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
                                    <span>{audienceToast.text}</span>
                                    <button onClick={() => setAudienceToast(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
                                </div>
                            )}

                            {/* Access Mode Selector */}
                            <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-200">
                                <div className="text-xs font-bold text-slate-700 mb-2">Access Rule:</div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${audienceModalSetting.accessMode === "BLACKLIST" ? "bg-red-50 border-red-300 font-bold text-red-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                                        <input
                                            type="radio"
                                            name="modalAccessMode"
                                            checked={audienceModalSetting.accessMode === "BLACKLIST"}
                                            onChange={() => handleAudienceModeChange("BLACKLIST")}
                                            disabled={audienceSaving}
                                        />
                                        <span>🚫 Blocklist (Block Listed)</span>
                                    </label>
                                    <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${audienceModalSetting.accessMode === "WHITELIST" || audienceModalSetting.accessMode === "SELECTED" ? "bg-purple-50 border-purple-300 font-bold text-purple-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                                        <input
                                            type="radio"
                                            name="modalAccessMode"
                                            checked={audienceModalSetting.accessMode === "WHITELIST" || audienceModalSetting.accessMode === "SELECTED"}
                                            onChange={() => handleAudienceModeChange("WHITELIST")}
                                            disabled={audienceSaving}
                                        />
                                        <span>✅ Whitelist (Only Listed)</span>
                                    </label>
                                    <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${audienceModalSetting.accessMode === "ALL" || !audienceModalSetting.accessMode ? "bg-emerald-50 border-emerald-300 font-bold text-emerald-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                                        <input
                                            type="radio"
                                            name="modalAccessMode"
                                            checked={audienceModalSetting.accessMode === "ALL" || !audienceModalSetting.accessMode}
                                            onChange={() => handleAudienceModeChange("ALL")}
                                            disabled={audienceSaving}
                                        />
                                        <span>🌐 Open to All Students</span>
                                    </label>
                                </div>
                            </div>

                            {/* Add / Block new student(s) */}
                            <form onSubmit={handleAddAudienceEntries} className="mt-4">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    {audienceModalSetting.accessMode === "BLACKLIST" ? "Block Student(s) — Roll Number or 10-digit Mobile Number:" : "Add Allowed Student(s) — Roll Number or Mobile Number:"}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="e.g. 23A91A0501, 23A91A0502, 9876543210 (comma/space separated)"
                                        value={audienceNewInput}
                                        onChange={e => setAudienceNewInput(e.target.value)}
                                        disabled={audienceSaving}
                                        className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={audienceSaving || !audienceNewInput.trim()}
                                        className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 whitespace-nowrap ${audienceModalSetting.accessMode === "BLACKLIST" ? "bg-red-600 hover:bg-red-700 disabled:bg-red-300" : "bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300"}`}
                                    >
                                        <FaPlus />
                                        <span>{audienceModalSetting.accessMode === "BLACKLIST" ? "Block Student" : "Add to List"}</span>
                                    </button>
                                </div>
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Tip: You can paste multiple roll numbers or mobile numbers separated by commas, spaces, or newlines.
                                </span>
                            </form>

                            {/* List section */}
                            <div className="mt-4 flex-1 flex flex-col min-h-0 border-t border-slate-100 pt-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            {audienceModalSetting.accessMode === "BLACKLIST" ? "Blocked Students / Numbers" : "Allowed Students / Numbers"}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                                            {Array.isArray(audienceModalSetting.allowedRollNumbers) ? audienceModalSetting.allowedRollNumbers.length : 0}
                                        </span>
                                    </div>
                                    {Array.isArray(audienceModalSetting.allowedRollNumbers) && audienceModalSetting.allowedRollNumbers.length > 5 && (
                                        <div className="relative w-44">
                                            <input
                                                type="text"
                                                placeholder="Filter list..."
                                                value={audienceSearch}
                                                onChange={e => setAudienceSearch(e.target.value)}
                                                className="w-full rounded-lg border border-slate-200 pl-7 pr-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                                            />
                                            <FaSearch className="absolute left-2.5 top-2 text-[10px] text-slate-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Scrollable list of identifiers */}
                                <div className="flex-1 overflow-y-auto max-h-56 rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                                    {(() => {
                                        const rawList: string[] = Array.isArray(audienceModalSetting.allowedRollNumbers) ? audienceModalSetting.allowedRollNumbers : [];
                                        const filteredList = audienceSearch
                                            ? rawList.filter(id => id.toLowerCase().includes(audienceSearch.toLowerCase()))
                                            : rawList;

                                        if (rawList.length === 0) {
                                            return (
                                                <div className="py-8 text-center text-xs text-slate-400">
                                                    No student roll numbers or mobile numbers in this list yet.
                                                </div>
                                            );
                                        }

                                        if (filteredList.length === 0) {
                                            return (
                                                <div className="py-8 text-center text-xs text-slate-400">
                                                    No entries match "{audienceSearch}".
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {filteredList.map((id: string) => {
                                                    const isPhone = /^\d{10}$/.test(id);
                                                    return (
                                                        <div
                                                            key={id}
                                                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs hover:border-slate-300 transition"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className={`text-xs ${audienceModalSetting.accessMode === "BLACKLIST" ? "text-red-500" : "text-purple-500"}`}>
                                                                    {audienceModalSetting.accessMode === "BLACKLIST" ? <FaBan /> : <FaCheck />}
                                                                </span>
                                                                <span className="font-mono text-xs font-bold text-slate-800 truncate">
                                                                    {id}
                                                                </span>
                                                                {isPhone && (
                                                                    <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-medium text-slate-500">
                                                                        Phone
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                disabled={audienceSaving}
                                                                onClick={() => handleUnblockSingle(id)}
                                                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition disabled:opacity-50 ${audienceModalSetting.accessMode === "BLACKLIST" ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"}`}
                                                                title={`Unblock / Remove ${id}`}
                                                            >
                                                                <FaUnlock className="text-[10px]" />
                                                                <span>{audienceModalSetting.accessMode === "BLACKLIST" ? "Unblock" : "Remove"}</span>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                                {Array.isArray(audienceModalSetting.allowedRollNumbers) && audienceModalSetting.allowedRollNumbers.length > 0 ? (
                                    <button
                                        type="button"
                                        disabled={audienceSaving}
                                        onClick={handleClearAudienceList}
                                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                                    >
                                        {audienceModalSetting.accessMode === "BLACKLIST" ? "Unblock All" : "Clear All"}
                                    </button>
                                ) : <div />}
                                <button
                                    type="button"
                                    onClick={() => setAudienceModalSetting(null)}
                                    className="rounded-xl bg-slate-800 px-5 py-2 text-xs font-bold text-white hover:bg-slate-900 transition"
                                >
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
