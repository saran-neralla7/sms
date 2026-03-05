"use client";

import { useEffect, useState } from "react";
import { AttendanceHistory } from "@/types";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import { FaCalendarAlt, FaFileExcel, FaFilter, FaHistory, FaTrash, FaUserCircle, FaEye, FaDownload, FaTimes, FaEdit } from "react-icons/fa";

import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";

export default function HistoryPage() {
    const [history, setHistory] = useState<AttendanceHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<AttendanceHistory | null>(null);

    // View Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewRecord, setViewRecord] = useState<AttendanceHistory | null>(null);
    const [viewStats, setViewStats] = useState({ present: 0, absent: 0, total: 0 });

    // Filters
    const [filterType, setFilterType] = useState<"all" | "today" | "yesterday" | "range">("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    const [viewMode, setViewMode] = useState<"academic" | "sms">("academic");

    useEffect(() => {
        fetchHistory();
    }, [viewMode]); // Refetch when mode changes

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let url = "/api/attendance/history";
            if (viewMode === "sms") {
                url += "?mode=sms";
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (record: AttendanceHistory) => {
        setRecordToDelete(record);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/attendance/history/${id}`, { method: "DELETE" });
            if (res.ok) {
                setHistory(prev => prev.filter(h => h.id !== id));
                setStatus({ type: "success", message: "Record deleted successfully" });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                setStatus({ type: "error", message: "Failed to delete record" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error deleting record" });
        }
    };

    const handleView = (record: AttendanceHistory) => {
        if (!record.details || record.details === "[]") {
            setStatus({ type: "error", message: "No details available for this record." });
            return;
        }
        try {
            const data = JSON.parse(record.details);
            // Calculate stats
            let present = 0;
            let absent = 0;
            data.forEach((s: any) => {
                if (s.Status === "Present") present++;
                else absent++;
            });
            setViewStats({ present, absent, total: data.length });
            setViewRecord(record);
            setIsViewModalOpen(true);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error reading record details." });
        }
    };

    const handleDownloadFull = () => {
        if (!viewRecord || !viewRecord.details) return;
        try {
            const rawData = JSON.parse(viewRecord.details);

            // Map to standard format
            const data = rawData.map((s: any) => ({
                "Roll Number": s["Roll Number"] || s.rollNumber,
                "Name": s["Name"] || s.name,
                "Status": s["Status"] || s.status,
                "Mobile": s["Mobile"] || s.mobile || ""
            }));

            // Create Sheet
            const ws = XLSX.utils.json_to_sheet(data, { header: ["Roll Number", "Name", "Status", "Mobile"] });

            // Auto-width columns (basic approximate)
            const wscols = [
                { wch: 15 }, // Roll No
                { wch: 25 }, // Name
                { wch: 10 }, // Status
                { wch: 15 }  // Mobile
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance");

            // Fix filename
            const dateStr = new Date(viewRecord.date).toLocaleDateString("en-IN").replace(/\//g, "-");
            const filename = `Attendance_Year-${viewRecord.year}_Sem-${viewRecord.semester}_Sec-${viewRecord.section?.name}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (e) { console.error("Download Error:", e); }
    };

    const handleDownloadAbsentees = () => {
        if (!viewRecord || !viewRecord.details) return;
        try {
            const rawData = JSON.parse(viewRecord.details);

            // Filter and Map
            const absentees = rawData
                .filter((s: any) => (s["Status"] || s.status) === "Absent")
                .map((s: any) => ({
                    "Roll Number": s["Roll Number"] || s.rollNumber,
                    "Name": s["Name"] || s.name,
                    "Status": "Absent",
                    "Mobile": s["Mobile"] || s.mobile || ""
                }));

            if (absentees.length === 0) {
                alert("No absentees in this record.");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(absentees, { header: ["Roll Number", "Name", "Status", "Mobile"] });

            // Auto-width columns
            const wscols = [{ wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 15 }];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Absentees");

            // Customize filename
            const dateStr = new Date(viewRecord.date).toLocaleDateString("en-IN").replace(/\//g, "-");
            const filename = `Absentees_Year-${viewRecord.year}_Sem-${viewRecord.semester}_Sec-${viewRecord.section?.name}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (e) { console.error("Download Error:", e); }
    };

    const getFilteredHistory = () => {
        if (filterType === "all") return history;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return history.filter(record => {
            const recordDate = new Date(record.date);

            if (filterType === "today") {
                return recordDate >= startOfDay;
            }

            if (filterType === "yesterday") {
                const startOfYesterday = new Date(startOfDay);
                startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                return recordDate >= startOfYesterday && recordDate < startOfDay;
            }

            if (filterType === "range") {
                if (!startDate) return true;
                const start = new Date(startDate);
                const end = endDate ? new Date(endDate) : new Date();
                end.setHours(23, 59, 59); // End of day
                return recordDate >= start && recordDate <= end;
            }

            return true;
        });
    };

    const filteredHistory = getFilteredHistory();



    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editRecord, setEditRecord] = useState<any>(null); // Details parsed
    const [editRecordId, setEditRecordId] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const handleEdit = (record: AttendanceHistory) => {
        if (!record.details || record.details === "[]") {
            setStatus({ type: "error", message: "No details available to edit." });
            return;
        }
        try {
            const data = JSON.parse(record.details);
            // Add internal ID for tracking if not present, though status toggle relies on RollNo/Id usually
            // Map to standard format if needed, but we keep original structure to save back
            setEditRecord(data);
            setEditRecordId(record.id);
            setIsEditModalOpen(true);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error reading record details." });
        }
    };

    const toggleEditStatus = (index: number) => {
        if (!editRecord) return;
        const updated = [...editRecord];
        const current = updated[index];
        // Toggle Status
        const newStatus = (current["Status"] || current.status) === "Present" ? "Absent" : "Present";

        // Handle both casing conventions effectively
        if (current["Status"]) current["Status"] = newStatus;
        else current.status = newStatus;

        setEditRecord(updated);
    };

    const saveEdit = async () => {
        if (!editRecordId || !editRecord) return;
        setSaving(true);
        try {
            // Recalculate summary status potentially? 
            // The record 'status' field (Completed) usually stays same. 
            // But 'details' definitely updates.

            const res = await fetch(`/api/attendance/history/${editRecordId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    details: editRecord
                })
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Attendance updated successfully" });
                setIsEditModalOpen(false);
                fetchHistory(); // Refresh list
            } else {
                setStatus({ type: "error", message: "Failed to update attendance" });
            }
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error saving changes" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            {status.message && !isDeleteModalOpen && !isViewModalOpen && !isEditModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                    {status.message}
                </div>
            )}

            {/* ... Existing Headers & Filters ... */}

            {/* Header Area */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <FaHistory size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Attendance History</h1>
                        <p className="text-sm text-slate-500">View and manage past reports.</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                    <FaFilter />
                    <span className="text-sm font-semibold">Filter:</span>
                </div>

                <div className="flex flex-wrap gap-2">
                    {["all", "today", "yesterday", "range"].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type as any)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterType === type
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>

                {filterType === "range" && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                            <FaCalendarAlt className="text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-sm outline-none"
                            />
                        </div>
                        <span className="text-slate-400">-</span>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                            <FaCalendarAlt className="text-slate-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-sm outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
                <div className="mb-4 flex items-center justify-end">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode("academic")}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === "academic"
                                ? "bg-blue-50 text-blue-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Academic Records
                        </button>
                        <button
                            onClick={() => setViewMode("sms")}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === "sms"
                                ? "bg-purple-50 text-purple-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            SMS / Bulk Logs
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Class Details</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">View</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Downloaded By</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading records...</td></tr>
                            ) : filteredHistory.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No records found matching filters</td></tr>
                            ) : (
                                filteredHistory.map((record) => (
                                    <tr key={record.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                            {new Date(record.date).toLocaleDateString("en-IN", {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-900">
                                                    Year {record.year} - Sem {record.semester}
                                                </span>
                                                <span className="text-xs text-slate-500">Section {record.section?.name}</span>
                                                {/* Subject & Period (or SMS) */}
                                                <div className="mt-1">
                                                    {record.subject ? (
                                                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                            {record.subject.name}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 italic">
                                                            SMS / Bulk Log
                                                        </span>
                                                    )}
                                                    {record.period && (
                                                        <span className="ml-1 inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                                            {record.period.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${record.status === "Marked Absent"
                                                ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
                                                : "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10"
                                                }`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <button
                                                onClick={() => handleView(record)}
                                                className="group/btn flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                title="View Details"
                                            >
                                                <FaEye className="text-blue-600" />
                                                <span className="font-mono text-xs">View</span>
                                            </button>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <FaUserCircle className="text-slate-400" />
                                                <span>{record.user?.username || "Unknown"}</span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Edit Button */}
                                                {["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes((session?.user.role || "").toUpperCase()) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        title="Edit Attendance"
                                                    >
                                                        <FaHistory size={14} /> {/* Using History icon for Edit as placeholder or Pen if available */}
                                                    </button>
                                                )}

                                                {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); confirmDelete(record); }}
                                                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Delete Record"
                                                    >
                                                        <FaTrash size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    if (recordToDelete) {
                        handleDelete(recordToDelete.id);
                        setIsDeleteModalOpen(false);
                    }
                }}
                title="Delete Record"
                message={`Are you sure you want to delete the attendance report for ${recordToDelete ? new Date(recordToDelete.date).toLocaleDateString() : 'this record'}?`}
                confirmText="Delete"
                isDangerous={true}
            />

            {/* View Modal */}
            {viewRecord && (
                <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Attendance Report">
                    <div className="p-4">
                        <div className="space-y-4">
                            <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Date</span>
                                        <span className="font-medium text-slate-900">
                                            {new Date(viewRecord.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Class</span>
                                        <span className="font-medium text-slate-900">
                                            Year {viewRecord.year} - Sem {viewRecord.semester} - Sec {viewRecord.section?.name || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="col-span-2 my-2 border-t border-slate-200"></div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Total Students</span>
                                        <span className="font-medium text-slate-900">{viewStats.total}</span>
                                    </div>
                                    <div></div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Present</span>
                                        <span className="font-bold text-green-600">{viewStats.present}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Absent</span>
                                        <span className="font-bold text-red-600">{viewStats.absent}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <button
                                    onClick={handleDownloadFull}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    <FaDownload /> Download Full Report
                                </button>
                                <button
                                    onClick={handleDownloadAbsentees}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                                >
                                    <FaDownload /> Download Absentees
                                </button>
                            </div>

                            <button onClick={() => setIsViewModalOpen(false)} className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600 underline">
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Attendance">
                <div className="p-4 h-[80vh] flex flex-col">
                    <div className="flex-1 overflow-y-auto mb-4 border rounded-lg">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 font-semibold text-slate-500">Roll No</th>
                                    <th className="px-4 py-2 font-semibold text-slate-500">Name</th>
                                    <th className="px-4 py-2 font-semibold text-slate-500 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {editRecord && editRecord.map((s: any, idx: number) => {
                                    const status = s["Status"] || s.status;
                                    return (
                                        <tr
                                            key={idx}
                                            onClick={() => toggleEditStatus(idx)}
                                            className={`cursor-pointer transition-colors ${status === "Absent" ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}`}
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-700">{s["Roll Number"] || s.rollNumber}</td>
                                            <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">{s["Name"] || s.name}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${status === "Absent"
                                                    ? "bg-red-200 text-red-800"
                                                    : "bg-green-100 text-green-700"}`}>
                                                    {status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={saving}
                            className="flex-1 px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md disabled:opacity-70"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
