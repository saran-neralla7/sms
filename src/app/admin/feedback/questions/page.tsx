"use client";

import { useState, useEffect } from "react";
import { FaTrash, FaPlus, FaArrowLeft, FaLayerGroup } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function FeedbackQuestionsPage() {
    const router = useRouter();
    const [questions, setQuestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [order, setOrder] = useState("");

    const fetchQuestions = async () => {
        try {
            const res = await fetch("/api/admin/feedback/questions");
            if (res.ok) {
                const data = await res.json();
                setQuestions(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text) return;
        
        try {
            const res = await fetch("/api/admin/feedback/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, order: parseInt(order || "0") })
            });

            if (res.ok) {
                setText("");
                setOrder("");
                fetchQuestions();
            } else {
                alert("Failed to add question");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this question?")) return;
        
        try {
            const res = await fetch(`/api/admin/feedback/questions/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                fetchQuestions();
            } else {
                alert("Failed to delete question");
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="mx-auto max-w-4xl animate-in fade-in">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button onClick={() => router.push("/admin")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
                        <FaArrowLeft /> Back to Admin
                    </button>
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">
                        <FaLayerGroup className="text-violet-600" />
                        Feedback Questions
                    </h1>
                    <p className="mt-1 text-slate-500">Configure global questions used in student feedback forms.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                    <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-bold text-slate-800">Add Question</h2>
                        
                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Question Text</label>
                            <input 
                                type="text"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                placeholder="E.g., Rate the teaching methodology"
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Sort Order</label>
                            <input 
                                type="number"
                                value={order}
                                onChange={(e) => setOrder(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                placeholder="E.g., 1 (Optional)"
                            />
                        </div>

                        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-violet-700">
                            <FaPlus /> Add Question
                        </button>
                    </form>
                </div>

                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12"><LogoSpinner fullScreen={false} /></div>
                    ) : questions.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">No questions defined yet.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Order</th>
                                    <th className="px-4 py-3">Question</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {questions.map((q) => (
                                    <tr key={q.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-600">{q.order}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{q.text}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                onClick={() => handleDelete(q.id)}
                                                className="rounded p-2 text-red-500 hover:bg-red-50"
                                                title="Delete"
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
