"use client";

import { useState, useEffect } from "react";
import { FaBuilding, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import Modal from "@/components/Modal";
import ConfirmationModal from "@/components/ConfirmationModal";

interface Department {
    id: string;
    name: string;
    code: string;
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [allSections, setAllSections] = useState<any[]>([]); // Pool of all sections
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Edit/Delete State
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);

    const [formData, setFormData] = useState({ name: "", code: "", sectionIds: [] as string[], isAcademic: true });
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchSections();
    }, []);

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments?all=true");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchSections = async () => {
        const res = await fetch("/api/sections");
        if (res.ok) setAllSections(await res.json());
    };

    const openAddModal = () => {
        setEditingDepartment(null);
        setFormData({ name: "", code: "", sectionIds: [], isAcademic: true });
        setIsModalOpen(true);
    };

    const openEditModal = (dept: any) => {
        setEditingDepartment(dept);
        const linkedSectionIds = dept.sections ? dept.sections.map((s: any) => s.id) : [];
        // Handle case where isAcademic might be undefined in old records (default true)
        const isAcademic = dept.isAcademic !== undefined ? dept.isAcademic : true;
        setFormData({ name: dept.name, code: dept.code, sectionIds: linkedSectionIds, isAcademic });
        setIsModalOpen(true);
    };

    const handleSectionToggle = (sectionId: string) => {
        setFormData(prev => {
            const current = new Set(prev.sectionIds);
            if (current.has(sectionId)) current.delete(sectionId);
            else current.add(sectionId);
            return { ...prev, sectionIds: Array.from(current) };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            const url = editingDepartment ? `/api/departments/${editingDepartment.id}` : "/api/departments";
            const method = editingDepartment ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setStatus({ type: "success", message: `Department ${editingDepartment ? "updated" : "created"} successfully!` });
                setFormData({ name: "", code: "", sectionIds: [], isAcademic: true });
                setEditingDepartment(null);
                fetchDepartments();
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                setStatus({ type: "error", message: "Failed to save department." });
            }
        } catch (e) {
            setStatus({ type: "error", message: "An error occurred." });
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (dept: Department) => {
        setDeptToDelete(dept);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deptToDelete) return;
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/departments/${deptToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setStatus({ type: "success", message: "Department deleted successfully" });
                setDepartments(prev => prev.filter(d => d.id !== deptToDelete.id));
                setIsDeleteModalOpen(false);
                setDeptToDelete(null);
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete department" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Error deleting department" });
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            {/* Global Status Message for Delete */}
            {status.message && !isModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <FaBuilding size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
                        <p className="text-sm text-slate-500">Manage college departments.</p>
                    </div>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                    <FaPlus /> Add Department
                </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((dept: any) => (
                    <div key={dept.id} className="relative rounded-xl border border-slate-200 bg-white p-6 shadow-sm group hover:border-indigo-300 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                {dept.code}
                            </span>
                            {dept.isAcademic === false && (
                                <span className="ml-2 inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                                    Faculty Only
                                </span>
                            )}
                            <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => openEditModal(dept)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="Edit"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => confirmDelete(dept)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{dept.name}</h3>

                        {/* Show Linked Sections Count */}
                        <div className="mt-2 flex flex-wrap gap-1">
                            {dept.sections && dept.sections.length > 0 ? (
                                dept.sections.map((sec: any) => (
                                    <span key={sec.id} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                        {sec.name}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-slate-400 italic">No sections linked</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingDepartment ? "Edit Department" : "Add Department"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {status.message && (
                        <div className={`rounded-md p-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}>
                            {status.message}
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-slate-700">Department Name</label>
                        <input
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Computer Science & Engineering"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Code</label>
                        <input
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            placeholder="e.g. CSE"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            required
                        />
                    </div>

                    {/* Section Linking */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Available Sections</label>
                        <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-40 overflow-y-auto">
                            {allSections.map((sec) => (
                                <label key={sec.id} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={formData.sectionIds.includes(sec.id)}
                                        onChange={() => handleSectionToggle(sec.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700">{sec.name}</span>
                                </label>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">Select sections applicable to this department.</p>
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isAcademic"
                                checked={formData.isAcademic}
                                onChange={e => setFormData({ ...formData, isAcademic: e.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="isAcademic" className="text-sm font-medium text-slate-700">Academic Department</label>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 ml-6">
                            Uncheck for Faculty-only departments (e.g. BSH). Visible in student dropdowns only if checked.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                            {editingDepartment ? "Save Changes" : "Create Department"}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Department"
                message={`Are you sure you want to delete ${deptToDelete?.name}? This might fail if students are assigned to it.`}
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
}
