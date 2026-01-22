"use client";

import { useState, useEffect } from "react";
import { FaGraduationCap, FaTrash, FaEdit, FaSearch, FaPlus } from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";

interface Alumni {
    id: string;
    rollNumber: string;
    name: string;
    mobile: string;
    passingYear: string;
}

import ConfirmationModal from "@/components/ConfirmationModal";

export default function AlumniPage() {
    const [alumni, setAlumni] = useState<Alumni[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAlumni, setEditingAlumni] = useState<Alumni | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [alumniToDelete, setAlumniToDelete] = useState<Alumni | null>(null);

    // Filters
    const [filterYear, setFilterYear] = useState("");
    const [searchName, setSearchName] = useState("");

    // Form State
    const [formData, setFormData] = useState({
        rollNumber: "",
        name: "",
        mobile: "",
        passingYear: ""
    });

    useEffect(() => {
        fetchAlumni();
    }, []);

    const fetchAlumni = async () => {
        setLoading(true);
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch("/api/alumni");
            if (res.ok) {
                const data = await res.json();
                setAlumni(data);
            }
        } catch (error) {
            console.error("Failed to fetch alumni", error);
            setStatus({ type: "error", message: "Failed to fetch alumni" });
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (alum: Alumni) => {
        setAlumniToDelete(alum);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/alumni/${id}`, { method: "DELETE" });
            if (res.ok) {
                setStatus({ type: "success", message: "Alumni deleted successfully" });
                setAlumni(prev => prev.filter(a => a.id !== id));
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                setStatus({ type: "error", message: "Failed to delete alumni" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error deleting alumni" });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });

        try {
            const url = editingAlumni
                ? `/api/alumni/${editingAlumni.id}`
                : "/api/alumni";
            const method = editingAlumni ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const successMessage = editingAlumni ? "Alumni updated successfully" : "Alumni created successfully";
                setStatus({ type: "success", message: successMessage });
                setEditingAlumni(null);
                setFormData({ rollNumber: "", name: "", mobile: "", passingYear: "" });
                fetchAlumni();
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                setStatus({ type: "error", message: "Failed to save alumni" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error saving alumni" });
        }
    };

    const openAddModal = () => {
        setEditingAlumni(null);
        setFormData({ rollNumber: "", name: "", mobile: "", passingYear: "" });
        setIsModalOpen(true);
    };

    const openEditModal = (alum: Alumni) => {
        setEditingAlumni(alum);
        setFormData({
            rollNumber: alum.rollNumber,
            name: alum.name,
            mobile: alum.mobile,
            passingYear: alum.passingYear,
        });
        setIsModalOpen(true);
    };

    const filteredAlumni = alumni.filter(a => {
        const matchYear = filterYear ? a.passingYear === filterYear : true;
        const matchName = searchName ? a.name.toLowerCase().includes(searchName.toLowerCase()) : true;
        return matchYear && matchName;
    });

    const uniqueYears = Array.from(new Set(alumni.map(a => a.passingYear))).sort().reverse();

    return (
        <div className="mx-auto max-w-7xl">
            {status.message && !isModalOpen && !isDeleteModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                    {status.message}
                </div>
            )}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <FaGraduationCap size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Alumni Management</h1>
                        <p className="text-sm text-slate-500">View and manage graduated students.</p>
                    </div>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                    <FaPlus /> Add Alumni
                </button>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:w-96">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by name..."
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                    />
                </div>

                <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                >
                    <option value="">All Batches</option>
                    {uniqueYears.map(year => (
                        <option key={year} value={year}>Class of {year}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-xs uppercase font-medium text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Roll Number</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Mobile</th>
                                <th className="px-6 py-4">Passing Year</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500"><div className="flex justify-center"><LogoSpinner fullScreen={false} /></div></td></tr>
                            ) : filteredAlumni.map((student) => (
                                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-mono text-slate-600">{student.rollNumber}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{student.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{student.mobile}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                                            {student.passingYear}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(student)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="Edit"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(student)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredAlumni.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No alumni found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }}
                title={editingAlumni ? "Edit Alumni" : "Add Alumni"}
            >
                {/* Form content remains the same */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {status.message && (
                        <div className={`rounded-md p-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}>
                            {status.message}
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-slate-700">Roll Number</label>
                        <input
                            value={formData.rollNumber}
                            onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Full Name</label>
                        <input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                        <input
                            value={formData.mobile}
                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Passing Year</label>
                        <input
                            type="number"
                            value={formData.passingYear}
                            onChange={(e) => setFormData({ ...formData, passingYear: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                            required
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm"
                        >
                            {editingAlumni ? "Update Alumni" : "Add Alumni"}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    if (alumniToDelete) {
                        handleDelete(alumniToDelete.id);
                        setIsDeleteModalOpen(false);
                    }
                }}
                title="Delete Alumni"
                message={`Are you sure you want to delete ${alumniToDelete?.name}?`}
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
