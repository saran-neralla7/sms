"use client";

import { useState, useEffect } from "react";
import { FaTrash, FaPlus, FaArrowLeft, FaLayerGroup, FaEdit } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

export default function FeedbackTemplatesPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        type: "FACULTY_MAPPED",
        questions: [{ text: "", type: "SCALE_1_5" }]
    });

    const [saving, setSaving] = useState(false);

    const fetchTemplates = async () => {
        try {
            const res = await fetch("/api/admin/feedback/templates");
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const openCreateModal = () => {
        setEditingTemplate(null);
        setFormData({
            name: "",
            description: "",
            type: "FACULTY_MAPPED",
            questions: [{ text: "", type: "SCALE_1_5" }]
        });
        setIsModalOpen(true);
    };

    const openEditModal = (template: any) => {
        setEditingTemplate(template);
        setFormData({
            name: template.name,
            description: template.description || "",
            type: template.type,
            questions: template.questions.map((q: any) => ({ text: q.text, type: q.type }))
        });
        setIsModalOpen(true);
    };

    const addQuestion = () => {
        setFormData(prev => ({
            ...prev,
            questions: [...prev.questions, { text: "", type: "SCALE_1_5" }]
        }));
    };

    const updateQuestion = (index: number, field: string, value: string) => {
        const updated = [...formData.questions];
        updated[index] = { ...updated[index], [field]: value };
        setFormData(prev => ({ ...prev, questions: updated }));
    };

    const removeQuestion = (index: number) => {
        const updated = formData.questions.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, questions: updated }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name) return alert("Template name is required");
        if (formData.questions.length === 0) return alert("At least one question is required");
        if (formData.questions.some(q => !q.text)) return alert("All questions must have text");

        setSaving(true);
        try {
            const url = editingTemplate ? `/api/admin/feedback/templates/${editingTemplate.id}` : "/api/admin/feedback/templates";
            const method = editingTemplate ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setIsModalOpen(false);
                fetchTemplates();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to save template");
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template? Active feedback forms using it might break.")) return;
        
        try {
            const res = await fetch(`/api/admin/feedback/templates/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                fetchTemplates();
            } else {
                alert("Failed to delete template");
            }
        } catch (e) {
            console.error(e);
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
                        <FaLayerGroup className="text-violet-600" />
                        Feedback Templates
                    </h1>
                    <p className="mt-1 text-slate-500">Create and manage feedback forms and their questions.</p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-violet-700"
                >
                    <FaPlus /> Create Template
                </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12"><LogoSpinner fullScreen={false} /></div>
                ) : templates.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No templates defined yet.</div>
                ) : (
                    <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.map((template) => (
                            <div key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-slate-900 text-lg">{template.name}</h3>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${template.type === "FACULTY_MAPPED" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                            {template.type === "FACULTY_MAPPED" ? "Faculty Mapped" : "General"}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-4">{template.description || "No description"}</p>
                                    <p className="text-xs font-semibold text-slate-600 mb-2">{template.questions.length} Questions:</p>
                                    <ul className="text-sm text-slate-700 space-y-1 mb-4 list-disc pl-4 h-24 overflow-y-auto">
                                        {template.questions.map((q: any) => (
                                            <li key={q.id}>
                                                <span className="truncate inline-block w-[180px] align-bottom">{q.text}</span>
                                                <span className="text-[10px] ml-1 text-slate-400">({q.type === "SCALE_1_5" ? "1-5" : "Text"})</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 mt-2">
                                    <button 
                                        onClick={() => openEditModal(template)}
                                        className="flex items-center gap-1 rounded bg-white px-3 py-1.5 text-sm font-semibold text-blue-600 shadow-sm border border-blue-200 hover:bg-blue-50"
                                    >
                                        <FaEdit /> Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(template.id)}
                                        className="flex items-center gap-1 rounded bg-white px-3 py-1.5 text-sm font-semibold text-red-600 shadow-sm border border-red-200 hover:bg-red-50"
                                    >
                                        <FaTrash /> Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingTemplate ? "Edit Template" : "Create Template"}
                maxWidth="max-w-3xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Template Name</label>
                            <input 
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                placeholder="E.g., STUDENT FEEDBACK ON FACULTY"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Template Type</label>
                            <select 
                                value={formData.type}
                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            >
                                <option value="FACULTY_MAPPED">Faculty Mapped (Evaluates mapped teachers)</option>
                                <option value="GENERAL">General (One-time form)</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-slate-700">Description</label>
                            <input 
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">Questions</h3>
                            <button 
                                type="button" 
                                onClick={addQuestion}
                                className="flex items-center gap-1 rounded bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-200"
                            >
                                <FaPlus /> Add Question
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {formData.questions.map((q, idx) => (
                                <div key={idx} className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <div className="pt-2 font-bold text-slate-400 w-6 text-center">{idx + 1}.</div>
                                    <div className="flex-1">
                                        <input 
                                            type="text"
                                            required
                                            value={q.text}
                                            onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                            placeholder="Question text..."
                                        />
                                    </div>
                                    <div className="w-40">
                                        <select 
                                            value={q.type}
                                            onChange={(e) => updateQuestion(idx, "type", e.target.value)}
                                            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                        >
                                            <option value="SCALE_1_5">1-5 Scale</option>
                                            <option value="TEXT">Text Box</option>
                                        </select>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => removeQuestion(idx)}
                                        className="mt-1 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            ))}
                            {formData.questions.length === 0 && (
                                <p className="text-sm text-red-500 italic">Please add at least one question.</p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "Save Template"}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
