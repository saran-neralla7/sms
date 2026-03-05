"use client";

import { useEffect, useState } from "react";
import { FaPlus, FaTrash, FaEdit, FaFilter } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";

export default function SubjectsPage() {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [regulations, setRegulations] = useState<any[]>([]);
    const [electiveSlots, setElectiveSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Filters
    const [filterDept, setFilterDept] = useState("");
    const [filterYear, setFilterYear] = useState("");
    const [filterSem, setFilterSem] = useState("");

    const [error, setError] = useState("");
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [shortName, setShortName] = useState("");
    const [code, setCode] = useState("");
    const [year, setYear] = useState("1");
    const [semester, setSemester] = useState("1");
    const [type, setType] = useState("THEORY");
    const [departmentId, setDepartmentId] = useState("");
    const [regulation, setRegulation] = useState("");
    const [electiveSlot, setElectiveSlot] = useState("");

    const [selectedSubject, setSelectedSubject] = useState<any>(null);

    useEffect(() => {
        fetchDepartments();
        fetchSubjects();
        fetchRegulations();
        fetchElectiveSlots();
    }, [filterDept, filterYear, filterSem]);

    const fetchElectiveSlots = async () => {
        try {
            const res = await fetch("/api/elective-slots");
            if (res.ok) setElectiveSlots(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchRegulations = async () => {
        try {
            const res = await fetch("/api/regulations");
            if (res.ok) setRegulations(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments");
            if (res.ok) setDepartments(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchSubjects = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterDept) params.append("departmentId", filterDept);
            if (filterYear) params.append("year", filterYear);
            if (filterSem) params.append("semester", filterSem);

            const res = await fetch(`/api/subjects?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setSubjects(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const showError = (msg: string) => {
        setError(msg);
        setIsErrorModalOpen(true);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/subjects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, shortName, code, year, semester, type, departmentId, regulation, electiveSlot })
            });
            if (res.ok) {
                fetchSubjects();
                setIsAddModalOpen(false);
                resetForm();
            } else {
                const data = await res.json();
                showError(data.error || "Failed to create subject");
            }
        } catch (error: any) {
            showError(error.message || "Error creating subject");
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSubject) return;
        try {
            const res = await fetch(`/api/subjects/${selectedSubject.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, shortName, code, year, semester, type, departmentId, regulation, electiveSlot })
            });
            if (res.ok) {
                fetchSubjects();
                setIsEditModalOpen(false);
                resetForm();
            } else {
                const data = await res.json();
                showError(data.error || "Failed to update subject");
            }
        } catch (error: any) {
            showError(error.message || "Error updating subject");
        }
    };

    const handleDelete = async () => {
        if (!selectedSubject) return;
        try {
            const res = await fetch(`/api/subjects/${selectedSubject.id}`, { method: "DELETE" });
            if (res.ok) {
                fetchSubjects();
                setIsDeleteModalOpen(false);
                setSelectedSubject(null);
            } else {
                const data = await res.json();
                showError(data.error || "Failed to delete subject");
            }
        } catch (error: any) {
            showError(error.message || "Error deleting subject");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        setLoading(true);
        try {
            const res = await fetch("/api/subjects/upload", {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                if (data.report.errors.length > 0) {
                    // Show success with partial errors
                    showError(`Upload processed with warnings:\nSuccess: ${data.report.success}\nErrors:\n${data.report.errors.join("\n").substring(0, 500)}...`);
                } else {
                    alert(`Upload Successful!\n${data.message}`);
                }
                fetchSubjects();
            } else {
                showError(data.error || "Upload failed");
            }
        } catch (error: any) {
            console.error(error);
            showError(error.message || "Upload failed");
        } finally {
            setLoading(false);
            // Reset input
            e.target.value = "";
        }
    };

    const handleExport = () => {
        const params = new URLSearchParams();
        if (filterDept) params.append("departmentId", filterDept);
        if (filterYear) params.append("year", filterYear);
        if (filterSem) params.append("semester", filterSem);
        window.open(`/api/subjects/export?${params.toString()}`);
    };

    const openEditModal = (subject: any) => {
        setSelectedSubject(subject);
        setName(subject.name);
        setShortName(subject.shortName || "");
        setCode(subject.code);
        setYear(subject.year);
        setSemester(subject.semester);
        setType(subject.type);
        setDepartmentId(subject.departmentId);
        setRegulation(subject.regulation?.name || "");
        setElectiveSlot(subject.electiveSlotRelation?.name || "");
        setIsEditModalOpen(true);
    };

    const resetForm = () => {
        setName("");
        setShortName("");
        setCode("");
        setYear("1");
        setSemester("1");
        setType("THEORY");
        setDepartmentId(departments[0]?.id || "");
        setRegulation("");
        setElectiveSlot("");
        setSelectedSubject(null);
    };

    return (
        <div className="mx-auto max-w-6xl p-6">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manage Subjects</h1>
                    <p className="text-slate-500">Add and manage curriculum subjects</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.open("/api/subjects/template")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Template
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Import
                        <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} />
                    </label>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Export
                    </button>
                    <button
                        onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
                    >
                        <FaPlus /> Add Subject
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                    <FaFilter /> <span className="text-sm font-medium">Filter:</span>
                </div>
                <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">All Years</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
                <select value={filterSem} onChange={(e) => setFilterSem(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">All Semesters</option>
                    {[1, 2].map(s => <option key={s} value={s}>{s} Sem</option>)}
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Code</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Short Name</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Name</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Type</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Class</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500">Reg</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500"><div className="flex justify-center"><LogoSpinner fullScreen={false} /></div></td></tr>
                            ) : subjects.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No subjects found.</td></tr>
                            ) : (
                                subjects.map((subject) => (
                                    <tr key={subject.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{subject.code}</td>
                                        <td className="px-6 py-4 text-sm text-slate-700">{subject.shortName || "-"}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{subject.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${subject.type === "LAB" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                                                {subject.type}
                                                {subject.electiveSlotRelation?.name && <span className="ml-1 text-xs opacity-75">({subject.electiveSlotRelation.name})</span>}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{subject.year}-{subject.semester}</td>
                                        <td className="p-4">{subject.type}</td>
                                        <td className="p-4">{subject.electiveSlotRelation?.name || "-"}</td>
                                        <td className="p-4">{subject.regulation?.name || "-"}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEditModal(subject)} className="rounded p-2 text-blue-600 hover:bg-blue-50 transition-colors">
                                                    <FaEdit />
                                                </button>
                                                <button onClick={() => { setSelectedSubject(subject); setIsDeleteModalOpen(true); }} className="rounded p-2 text-red-600 hover:bg-red-50 transition-colors">
                                                    <FaTrash />
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

            {/* Error Modal */}
            {isErrorModalOpen && (
                <Modal isOpen={true} onClose={() => setIsErrorModalOpen(false)} title="Error">
                    <div className="p-2">
                        <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-red-800">
                            <div className="text-3xl">⚠️</div>
                            <div>
                                <h3 className="font-bold">Something went wrong</h3>
                                <p className="text-sm">Please check the details below.</p>
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto rounded bg-slate-100 p-4 text-sm font-mono text-slate-700">
                            {error}
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button onClick={() => setIsErrorModalOpen(false)} className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-900">
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Add/Edit Modal Content */}
            {(isAddModalOpen || isEditModalOpen) && (
                <Modal isOpen={true} onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} title={isAddModalOpen ? "Add Subject" : "Edit Subject"}>
                    <form onSubmit={isAddModalOpen ? handleAdd : handleEdit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Subject Code</label>
                                <input
                                    type="text"
                                    placeholder="e.g. CS101"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Short Name (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. PPS"
                                    value={shortName}
                                    onChange={(e) => setShortName(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Type</label>
                                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                                    <option value="THEORY">Theory</option>
                                    <option value="LAB">Lab</option>
                                    <option value="PROFESSIONAL_ELECTIVE">Professional Elective</option>
                                    <option value="OPEN_ELECTIVE">Open Elective</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Subject Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Data Structures"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Regulation</label>
                                <select value={regulation} onChange={(e) => setRegulation(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                                    <option value="">Select Regulation</option>
                                    {regulations.map((r: any) => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Elective Slot (Optional)</label>
                                <select value={electiveSlot} onChange={(e) => setElectiveSlot(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                                    <option value="">None (Not an Elective Slot)</option>
                                    {electiveSlots.map(slot => (
                                        <option key={slot.id} value={slot.name}>{slot.name}</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-slate-500">Only for Professional/Open Electives.</p>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Department</label>
                            <select
                                value={departmentId}
                                onChange={(e) => setDepartmentId(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                required
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Year</label>
                                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Semester</label>
                                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                                    <option value="1">1st Sem</option>
                                    <option value="2">2nd Sem</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Save Subject</button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Subject"
                message={`Are you sure you want to delete "${selectedSubject?.name}"?`}
            />
        </div>
    );
}
