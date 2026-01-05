"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import { FaCalendarAlt, FaFileExcel, FaFilter, FaTrash, FaEdit, FaUserCircle, FaSave, FaTimes } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import { motion } from "framer-motion";

export default function ReportsPage() {
    const { data: session } = useSession();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [sectionId, setSectionId] = useState("");

    // Metadata for dropdowns
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);

    // Edit Modal State
    const [editingRecord, setEditingRecord] = useState<any | null>(null);
    const [editDetails, setEditDetails] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<any | null>(null);

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    useEffect(() => {
        if (session?.user.role === "ADMIN") fetchDepartments();
        // Initial fetch
        fetchHistory();
    }, [session]);

    useEffect(() => {
        const effectiveDeptId = session?.user.role === "ADMIN" ? departmentId : (session?.user as any)?.departmentId;
        if (effectiveDeptId) fetchSections(effectiveDeptId);
    }, [departmentId, session]);

    // Refetch when filters change
    useEffect(() => {
        fetchHistory();
    }, [year, semester, sectionId, departmentId]);

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchSections = async (deptId: string) => {
        const res = await fetch(`/api/sections?departmentId=${deptId}`);
        if (res.ok) setSections(await res.json());
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (sectionId) params.append("sectionId", sectionId);
            if (departmentId) params.append("departmentId", departmentId);

            const res = await fetch(`/api/attendance/history?${params.toString()}`);
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

    const handleDownload = (record: any) => {
        if (!record.details || record.details === "[]") {
            setStatus({ type: "error", message: "No details available." });
            return;
        }
        try {
            const data = JSON.parse(record.details);
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Report");
            XLSX.writeFile(wb, record.fileName || "Report.xlsx");
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Download failed." });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/attendance/history/${id}`, { method: "DELETE" });
            if (res.ok) {
                setHistory(prev => prev.filter(h => h.id !== id));
                setStatus({ type: "success", message: "Deleted successfully" });
            } else {
                setStatus({ type: "error", message: "Failed to delete" });
            }
            setIsDeleteModalOpen(false);
        } catch (error) {
            setStatus({ type: "error", message: "Error deleting" });
        }
    };

    const openEditModal = (record: any) => {
        try {
            const details = JSON.parse(record.details);
            setEditDetails(details);
            setEditingRecord(record);
            setIsEditModalOpen(true);
        } catch (e) {
            setStatus({ type: "error", message: "Cannot edit this record (invalid data)" });
        }
    };

    const toggleAttendance = (index: number) => {
        const newDetails = [...editDetails];
        const currentStatus = newDetails[index]["Status"];
        newDetails[index]["Status"] = currentStatus === "Absent" ? "Present" : "Absent";
        setEditDetails(newDetails);
    };

    const saveEdits = async () => {
        if (!editingRecord) return;
        try {
            const res = await fetch(`/api/attendance/history/${editingRecord.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    details: editDetails,
                    status: "Modified" // Optional label update
                })
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Attendance updated successfully" });
                fetchHistory(); // Refresh list to update status label if needed
                setIsEditModalOpen(false);
                setEditingRecord(null);
            } else {
                setStatus({ type: "error", message: "Failed to update" });
            }
        } catch (e) {
            setStatus({ type: "error", message: "Error updating" });
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            {status.message && !isDeleteModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
                <p className="text-sm text-slate-500">View, edit, and manage attendance reports.</p>
            </div>

            {/* Daily Attendance Reports Section */}
            <div className="mb-8">
                <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Daily Attendance Reports</h2>

                {/* Filters */}
                <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
                    {session?.user.role === "ADMIN" && (
                        <select
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    )}
                    <select
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">All Years</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                    </select>
                    <select
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">All Semesters</option>
                        <option value="1">1st Sem</option>
                        <option value="2">2nd Sem</option>
                    </select>
                    <select
                        value={sectionId}
                        onChange={(e) => setSectionId(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">All Sections</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">Date</th>
                                    <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">Class</th>
                                    <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">Status</th>
                                    <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">File</th>
                                    <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading...</td></tr> :
                                    history.length === 0 ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No reports found.</td></tr> :
                                        history.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50/80">
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {new Date(record.date).toLocaleDateString("en-IN", {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-slate-900">Year {record.year} - Sem {record.semester}</div>
                                                    <div className="text-xs text-slate-500">Sec {record.section?.name}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${record.status?.includes("Absent") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                                                        }`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button onClick={() => handleDownload(record)} className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                                                        <FaFileExcel /> {record.fileName}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => openEditModal(record)} className="mr-3 text-blue-600 hover:text-blue-800" title="Edit">
                                                        <FaEdit />
                                                    </button>
                                                    <button onClick={() => { setRecordToDelete(record); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-800" title="Delete">
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Attendance">
                <div className="p-4">
                    <h3 className="mb-4 text-sm font-bold text-slate-700">Update Student Status</h3>
                    <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-500">Roll No</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-500">Name</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {editDetails.map((student, idx) => (
                                    <tr key={idx} className={student["Status"] === "Absent" ? "bg-red-50" : ""}>
                                        <td className="px-4 py-2 text-sm font-mono">{student["Roll Number"]}</td>
                                        <td className="px-4 py-2 text-sm">{student["Name"]}</td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() => toggleAttendance(idx)}
                                                className={`px-3 py-1 rounded text-xs font-bold ${student["Status"] === "Absent"
                                                        ? "bg-red-200 text-red-800"
                                                        : "bg-green-200 text-green-800"
                                                    }`}
                                            >
                                                {student["Status"]}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                        <button onClick={saveEdits} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                            <FaSave /> Save Changes
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => recordToDelete && handleDelete(recordToDelete.id)}
                title="Delete Report"
                message="Are you sure you want to delete this report? This action cannot be undone."
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
