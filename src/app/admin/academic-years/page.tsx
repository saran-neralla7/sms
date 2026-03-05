
"use client";

import { useState, useEffect } from "react";
import { FaCalendarAlt, FaPlus, FaEdit, FaTrash, FaCheckCircle, FaRegCircle } from "react-icons/fa";
import Modal from "@/components/Modal";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useRouter } from "next/navigation";

interface AcademicYear {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
}

export default function AcademicYearsPage() {
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter(); // For refreshing logic if needed

    // Edit/Delete State
    const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [yearToDelete, setYearToDelete] = useState<AcademicYear | null>(null);

    const [formData, setFormData] = useState({ name: "", startDate: "", endDate: "", isCurrent: false });
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchYears();
    }, []);

    const fetchYears = async () => {
        const res = await fetch("/api/academic-years");
        if (res.ok) setYears(await res.json());
    };

    const openAddModal = () => {
        setEditingYear(null);
        setFormData({ name: "", startDate: "", endDate: "", isCurrent: false });
        setIsModalOpen(true);
    };

    const openEditModal = (year: AcademicYear) => {
        setEditingYear(year);
        // Format dates for input type="date" (YYYY-MM-DD)
        const start = year.startDate ? new Date(year.startDate).toISOString().split('T')[0] : "";
        const end = year.endDate ? new Date(year.endDate).toISOString().split('T')[0] : "";

        setFormData({
            name: year.name,
            startDate: start,
            endDate: end,
            isCurrent: year.isCurrent
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: null, message: "" });

        // Basic Validation
        if (!formData.name || !formData.startDate || !formData.endDate) {
            setStatus({ type: "error", message: "All fields are required." });
            setLoading(false);
            return;
        }

        try {
            const url = editingYear ? `/api/academic-years/${editingYear.id}` : "/api/academic-years";
            const method = editingYear ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setStatus({ type: "success", message: `Academic Year ${editingYear ? "updated" : "created"} successfully!` });
                setFormData({ name: "", startDate: "", endDate: "", isCurrent: false });
                setEditingYear(null);
                fetchYears();
                // If we changed current year, refresh page to update navbar selector
                if (formData.isCurrent) {
                    router.refresh();
                }
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to save academic year." });
            }
        } catch (e) {
            setStatus({ type: "error", message: "An error occurred." });
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (year: AcademicYear) => {
        setYearToDelete(year);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!yearToDelete) return;
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/academic-years/${yearToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setStatus({ type: "success", message: "Academic year deleted successfully" });
                setYears(prev => prev.filter(y => y.id !== yearToDelete.id));
                setIsDeleteModalOpen(false);
                setYearToDelete(null);
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete academic year" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Error deleting academic year" });
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            {/* Notification */}
            {status.message && !isModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                        <FaCalendarAlt size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Academic Years</h1>
                        <p className="text-sm text-slate-500">Manage academic sessions and timelines.</p>
                    </div>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                    <FaPlus /> Add Academic Year
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {years.map((year) => (
                    <div key={year.id} className={`relative rounded-xl border p-6 shadow-sm group hover:border-emerald-300 transition-all ${year.isCurrent ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${year.isCurrent ? 'bg-emerald-100 text-emerald-700 ring-emerald-700/10' : 'bg-slate-100 text-slate-600 ring-slate-600/10'}`}>
                                {year.isCurrent ? 'Current Session' : 'Standard Session'}
                            </span>
                            <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => openEditModal(year)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => confirmDelete(year)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{year.name}</h3>
                        <div className="mt-2 text-sm text-slate-500">
                            <p>Start: {new Date(year.startDate).toLocaleDateString()}</p>
                            <p>End: {new Date(year.endDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingYear ? "Edit Academic Year" : "Add Academic Year"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {status.message && (
                        <div className={`rounded-md p-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}>
                            {status.message}
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-slate-700">Year Name</label>
                        <input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. 2024-2025"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Start Date</label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">End Date</label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="isCurrent"
                            checked={formData.isCurrent}
                            onChange={e => setFormData({ ...formData, isCurrent: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <label htmlFor="isCurrent" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                            Mark as Current Academic Year
                        </label>
                    </div>
                    <p className="text-xs text-slate-500 ml-6">
                        Setting this as current will unset the current flag for all other years.
                    </p>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={loading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                            {loading ? "Saving..." : (editingYear ? "Save Changes" : "Create Academic Year")}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Academic Year"
                message={`Are you sure you want to delete ${yearToDelete?.name}?`}
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
