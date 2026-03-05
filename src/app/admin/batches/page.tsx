
"use client";

import { useState, useEffect } from "react";
import { FaGraduationCap, FaPlus, FaEdit, FaTrash, FaLevelUpAlt, FaUsers } from "react-icons/fa";
import Modal from "@/components/Modal";
import ConfirmationModal from "@/components/ConfirmationModal";

interface Batch {
    id: string;
    name: string;
    startYear: number;
    endYear: number;
    _count?: {
        students: number;
    };
}

export default function BatchesPage() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Edit/Delete State
    const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);



    const [formData, setFormData] = useState({ name: "", startYear: "", endYear: "" });
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        const res = await fetch("/api/batches");
        if (res.ok) setBatches(await res.json());
    };

    const openAddModal = () => {
        setEditingBatch(null);
        setFormData({ name: "", startYear: "", endYear: "" });
        setIsModalOpen(true);
    };

    const openEditModal = (batch: Batch) => {
        setEditingBatch(batch);
        setFormData({
            name: batch.name,
            startYear: batch.startYear.toString(),
            endYear: batch.endYear.toString()
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            const url = editingBatch ? `/api/batches/${editingBatch.id}` : "/api/batches";
            const method = editingBatch ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setStatus({ type: "success", message: `Batch ${editingBatch ? "updated" : "created"} successfully!` });
                setFormData({ name: "", startYear: "", endYear: "" });
                setEditingBatch(null);
                fetchBatches();
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to save batch." });
            }
        } catch (e) {
            setStatus({ type: "error", message: "An error occurred." });
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (batch: Batch) => {
        setBatchToDelete(batch);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!batchToDelete) return;
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/batches/${batchToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setStatus({ type: "success", message: "Batch deleted successfully" });
                setBatches(prev => prev.filter(b => b.id !== batchToDelete.id));
                setIsDeleteModalOpen(false);
                setBatchToDelete(null);
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete batch" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Error deleting batch" });
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                        <FaGraduationCap size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Batches</h1>
                        <p className="text-sm text-slate-500">Manage student batches and verify intakes.</p>
                    </div>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                    <FaPlus /> Add Batch
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {batches.map((batch) => (
                    <div key={batch.id} className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm group hover:border-violet-300 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-700/10">
                                <FaUsers /> {batch._count?.students || 0} Students
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEditModal(batch)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => confirmDelete(batch)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{batch.name}</h3>
                        <div className="mt-1 text-sm text-slate-500">
                            {batch.startYear} - {batch.endYear}
                        </div>


                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingBatch ? "Edit Batch" : "Add Batch"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {status.message && (
                        <div className={`rounded-md p-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}>
                            {status.message}
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-slate-700">Batch Name</label>
                        <input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. 2024-2028"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Start Year</label>
                            <input
                                type="number"
                                value={formData.startYear}
                                onChange={e => setFormData({ ...formData, startYear: e.target.value })}
                                placeholder="2024"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">End Year</label>
                            <input
                                type="number"
                                value={formData.endYear}
                                onChange={e => setFormData({ ...formData, endYear: e.target.value })}
                                placeholder="2028"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={loading} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                            {loading ? "Saving..." : (editingBatch ? "Save Changes" : "Create Batch")}
                        </button>
                    </div>
                </form>
            </Modal>



            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Batch"
                message={`Are you sure you want to delete ${batchToDelete?.name}?`}
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
