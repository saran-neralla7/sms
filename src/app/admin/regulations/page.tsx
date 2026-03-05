
"use client";

import { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaEdit, FaBook } from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";
import ConfirmationModal from "@/components/ConfirmationModal";

export default function RegulationsPage() {
    const [regulations, setRegulations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRegulation, setEditingRegulation] = useState<any | null>(null);
    const [regulationName, setRegulationName] = useState("");

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [regulationToDelete, setRegulationToDelete] = useState<any | null>(null);

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    const fetchRegulations = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/regulations");
            if (res.ok) {
                setRegulations(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegulations();
    }, []);

    const openAddModal = () => {
        setEditingRegulation(null);
        setRegulationName("");
        setIsModalOpen(true);
        setStatus({ type: null, message: "" });
    };

    const openEditModal = (reg: any) => {
        setEditingRegulation(reg);
        setRegulationName(reg.name);
        setIsModalOpen(true);
        setStatus({ type: null, message: "" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });

        try {
            const url = editingRegulation ? `/api/regulations/${editingRegulation.id}` : "/api/regulations";
            const method = editingRegulation ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: regulationName })
            });

            if (res.ok) {
                setStatus({ type: "success", message: `Regulation ${editingRegulation ? "updated" : "created"} successfully` });
                fetchRegulations();
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to save regulation" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Network error" });
        }
    };

    const handleDelete = async () => {
        if (!regulationToDelete) return;
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/regulations/${regulationToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setStatus({ type: "success", message: "Regulation deleted" });
                setRegulations(prev => prev.filter(r => r.id !== regulationToDelete.id));
                setIsDeleteModalOpen(false);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete" });
                setIsDeleteModalOpen(false); // Close delete modal to show error on main page? Or keep open?
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error" });
        }
    };

    return (
        <div className="mx-auto max-w-5xl">
            {status.message && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                        <FaBook size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Manage Regulations</h1>
                        <p className="text-sm text-slate-500">Create and manage academic regulations (e.g., R20, R22).</p>
                    </div>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
                >
                    <FaPlus size={12} /> Add Regulation
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Regulation Name</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500"><div className="flex justify-center"><LogoSpinner fullScreen={false} /></div></td></tr>
                            ) : regulations.length === 0 ? (
                                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">No regulations found.</td></tr>
                            ) : (
                                regulations.map(reg => (
                                    <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{reg.name}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button onClick={() => openEditModal(reg)} className="text-slate-400 hover:text-blue-600 transition-colors">
                                                    <FaEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => { setRegulationToDelete(reg); setIsDeleteModalOpen(true); }}
                                                    className="text-slate-400 hover:text-red-600 transition-colors"
                                                >
                                                    <FaTrash size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRegulation ? "Edit Regulation" : "Add Regulation"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                        <input
                            type="text"
                            value={regulationName}
                            onChange={(e) => setRegulationName(e.target.value)}
                            placeholder="e.g. R22"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            required
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 shadow-sm">
                            {editingRegulation ? "Save Changes" : "Create Regulation"}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Regulation?"
                message={`Are you sure you want to delete "${regulationToDelete?.name}"? You cannot delete it if students or subjects are assigned to it.`}
            />
        </div>
    );
}
