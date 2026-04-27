"use client";

import { useState, useEffect } from "react";
import { FaTrash, FaPlus, FaArrowLeft, FaCalendarCheck, FaEdit, FaClock } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function FeedbackWindowsPage() {
    const router = useRouter();
    const [forms, setForms] = useState<any[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<any[]>([]);
    const [templateId, setTemplateId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [academicYearId, setAcademicYearId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    
    const [departments, setDepartments] = useState<any[]>([]);
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedDept, setSelectedDept] = useState("");
    const [selectedBatch, setSelectedBatch] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedSemester, setSelectedSemester] = useState("");
    const [availableSections, setAvailableSections] = useState<any[]>([]);
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Edit modal state
    const [editingForm, setEditingForm] = useState<any>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editStartDate, setEditStartDate] = useState("");
    const [editEndDate, setEditEndDate] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [formsRes, ayRes, templatesRes, deptsRes, batchesRes] = await Promise.all([
                fetch("/api/admin/feedback/forms"),
                fetch("/api/academic-years"),
                fetch("/api/admin/feedback/templates"),
                fetch("/api/departments"),
                fetch("/api/batches")
            ]);
            
            if (formsRes.ok) setForms(await formsRes.json());
            if (deptsRes.ok) setDepartments(await deptsRes.json());
            if (batchesRes.ok) setBatches(await batchesRes.json());
            if (ayRes.ok) {
                const ayData = await ayRes.json();
                setAcademicYears(ayData);
                const currentAy = ayData.find((a: any) => a.isCurrent);
                if (currentAy) setAcademicYearId(currentAy.id);
            }
            if (templatesRes.ok) {
                const tempData = await templatesRes.json();
                setTemplates(tempData);
                if (tempData.length > 0) setTemplateId(tempData[0].id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (selectedDept && selectedYear && selectedSemester) {
            fetch(`/api/sections?departmentId=${selectedDept}`)
                .then(res => res.json())
                .then(data => setAvailableSections(data))
                .catch(err => console.error(err));
        } else {
            setAvailableSections([]);
        }
    }, [selectedDept, selectedYear, selectedSemester]);

    const handleSectionToggle = (id: string) => {
        setSelectedSectionIds(prev => 
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch("/api/admin/feedback/forms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    title, description, academicYearId, templateId,
                    startDate, endDate,
                    sectionIds: selectedSectionIds,
                    targetYear: selectedYear ? parseInt(selectedYear) : null,
                    targetSemester: selectedSemester ? parseInt(selectedSemester) : null,
                    targetDepartmentId: selectedDept,
                    targetBatchId: selectedBatch || null
                })
            });

            if (res.ok) {
                setTitle(""); setDescription(""); setStartDate(""); setEndDate("");
                setSelectedSectionIds([]); setSelectedBatch("");
                fetchData();
            } else {
                alert("Failed to add feedback window");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this feedback window? All associated responses will be permanently deleted!")) return;
        try {
            const res = await fetch(`/api/admin/feedback/forms/${id}`, { method: "DELETE" });
            if (res.ok) {
                setForms(prev => prev.filter(f => f.id !== id));
            } else {
                alert("Failed to delete feedback window");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting feedback window");
        }
    };

    // Convert a UTC date from DB to local datetime-local string
    const toLocalDatetimeInput = (isoString: string) => {
        if (!isoString) return "";
        const d = new Date(isoString);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const openEdit = (form: any) => {
        setEditingForm(form);
        setEditTitle(form.title);
        setEditStartDate(toLocalDatetimeInput(form.startDate));
        setEditEndDate(toLocalDatetimeInput(form.endDate));
    };

    const handleSaveEdit = async () => {
        if (!editingForm) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(`/api/admin/feedback/forms/${editingForm.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: editTitle, startDate: editStartDate, endDate: editEndDate })
            });
            if (res.ok) {
                setEditingForm(null);
                fetchData();
            } else {
                alert("Failed to update feedback window");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingEdit(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl animate-in fade-in">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button onClick={() => router.push("/admin")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
                        <FaArrowLeft /> Back to Admin
                    </button>
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">
                        <FaCalendarCheck className="text-fuchsia-600" />
                        Feedback Windows
                    </h1>
                    <p className="mt-1 text-slate-500">Manage time windows for collecting student feedback.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* CREATE FORM */}
                <div className="md:col-span-1">
                    <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-bold text-slate-800">New Window</h2>
                        
                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Title</label>
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                placeholder="E.g., MID-I I/IV CSM" required />
                        </div>

                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Template</label>
                            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500" required>
                                <option value="">Select Template</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.type === "FACULTY_MAPPED" ? "Mapped" : "General"})</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Academic Year</label>
                            <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500" required>
                                <option value="">Select Academic Year</option>
                                {academicYears.map(ay => (
                                    <option key={ay.id} value={ay.id}>{ay.name}{ay.isCurrent ? " (Current)" : ""}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600 flex items-center gap-1"><FaClock className="text-fuchsia-500" /> Start Date &amp; Time</label>
                            <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500" required />
                        </div>

                        <div className="mb-6">
                            <label className="mb-1 block text-sm font-semibold text-slate-600 flex items-center gap-1"><FaClock className="text-fuchsia-500" /> End Date &amp; Time</label>
                            <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500" required />
                        </div>

                        <div className="mb-6 border-t pt-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-3">Target Sections</h3>
                            
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Department</label>
                                    <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 p-1.5 text-xs focus:border-fuchsia-500 focus:outline-none" required>
                                        <option value="">Select Dept</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.code}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Year</label>
                                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 p-1.5 text-xs focus:border-fuchsia-500 focus:outline-none" required>
                                        <option value="">Select Year</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Batch</label>
                                    <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 p-1.5 text-xs focus:border-fuchsia-500 focus:outline-none">
                                        <option value="">All Batches</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">Semester</label>
                                    <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 p-1.5 text-xs focus:border-fuchsia-500 focus:outline-none" required>
                                        <option value="">Select Sem</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                    </select>
                                </div>
                            </div>

                            {availableSections.length > 0 ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50">
                                    {availableSections.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                            <input type="checkbox" checked={selectedSectionIds.includes(s.id)}
                                                onChange={() => handleSectionToggle(s.id)}
                                                className="rounded text-fuchsia-600 focus:ring-fuchsia-500" />
                                            {s.name}
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 italic">Select Dept, Year, and Semester to view sections.</div>
                            )}
                            {selectedSectionIds.length > 0 && (
                                <div className="mt-2 text-xs font-semibold text-fuchsia-600">
                                    {selectedSectionIds.length} sections selected
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={isSaving || selectedSectionIds.length === 0} className="flex w-full items-center justify-center gap-2 rounded-md bg-fuchsia-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-fuchsia-700 disabled:opacity-50">
                            <FaPlus /> {isSaving ? "Creating..." : "Create Window"}
                        </button>
                    </form>
                </div>

                {/* FORMS LIST */}
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12"><LogoSpinner fullScreen={false} /></div>
                    ) : forms.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">No active feedback windows.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                    <tr>
                                        <th className="px-4 py-3">Title</th>
                                        <th className="px-4 py-3">Timeline</th>
                                        <th className="px-4 py-3 text-center">Submissions</th>
                                        <th className="px-4 py-3 text-center">Responses</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {forms.map((f) => {
                                        const now = new Date();
                                        const start = new Date(f.startDate);
                                        const end = new Date(f.endDate);
                                        const isActive = f.isActive && now >= start && now <= end;
                                        const fmtDt = (d: Date) => `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
                                        
                                        return (
                                            <tr key={f.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    {f.title}
                                                    <div className="text-xs text-slate-400 font-normal mt-0.5">
                                                        {f.academicYear?.name} • {f.template?.name}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">
                                                    <div className="flex items-center gap-1"><FaClock className="text-slate-400" size={10} /> {fmtDt(start)}</div>
                                                    <div className="flex items-center gap-1 text-red-500"><FaClock className="text-red-300" size={10} /> {fmtDt(end)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-blue-600">{f._count?.submissions || 0}</td>
                                                <td className="px-4 py-3 text-center font-bold text-violet-600">{f._count?.responses || 0}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${isActive ? 'bg-green-100 text-green-700' : now > end ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                                        {isActive ? "ACTIVE" : now > end ? "CLOSED" : "UPCOMING"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => router.push(`/admin/feedback/analytics/${f.id}`)}
                                                            className="inline-flex rounded bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                                                            Analytics
                                                        </button>
                                                        <button onClick={() => openEdit(f)}
                                                            className="inline-flex items-center justify-center rounded bg-amber-50 p-2 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-colors" title="Edit Window">
                                                            <FaEdit size={12} />
                                                        </button>
                                                        <button onClick={() => handleDelete(f.id)}
                                                            className="inline-flex items-center justify-center rounded bg-red-50 p-2 text-red-600 border border-red-200 hover:bg-red-100 transition-colors" title="Delete">
                                                            <FaTrash size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* EDIT MODAL */}
            {editingForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                            <FaEdit className="text-amber-500" /> Edit Feedback Window
                        </h2>
                        <p className="text-xs text-slate-400 mb-5">Update the title or extend/change the window dates and times.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-600">Title</label>
                                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-600 flex items-center gap-1"><FaClock className="text-amber-500" /> Start Date &amp; Time</label>
                                <input type="datetime-local" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-600 flex items-center gap-1"><FaClock className="text-red-400" /> End Date &amp; Time</label>
                                <input type="datetime-local" value={editEndDate} onChange={e => setEditEndDate(e.target.value)}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditingForm(null)}
                                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button onClick={handleSaveEdit} disabled={isSavingEdit}
                                className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50">
                                {isSavingEdit ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
