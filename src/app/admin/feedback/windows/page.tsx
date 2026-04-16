"use client";

import { useState, useEffect } from "react";
import { FaTrash, FaPlus, FaArrowLeft, FaCalendarCheck } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function FeedbackWindowsPage() {
    const router = useRouter();
    const [forms, setForms] = useState<any[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [academicYearId, setAcademicYearId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const [formsRes, ayRes] = await Promise.all([
                fetch("/api/admin/feedback/forms"),
                fetch("/api/academic-years")
            ]);
            
            if (formsRes.ok) setForms(await formsRes.json());
            if (ayRes.ok) {
                const ayData = await ayRes.json();
                setAcademicYears(ayData);
                const currentAy = ayData.find((a: any) => a.isCurrent);
                if (currentAy) setAcademicYearId(currentAy.id);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/admin/feedback/forms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    title, 
                    description, 
                    academicYearId, 
                    startDate, 
                    endDate 
                })
            });

            if (res.ok) {
                setTitle("");
                setDescription("");
                setStartDate("");
                setEndDate("");
                fetchData();
            } else {
                alert("Failed to add feedback window");
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
                        <FaCalendarCheck className="text-fuchsia-600" />
                        Feedback Windows
                    </h1>
                    <p className="mt-1 text-slate-500">Manage time windows for collecting student feedback.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                    <form onSubmit={handleAdd} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-lg font-bold text-slate-800">New Window</h2>
                        
                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Title</label>
                            <input 
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                placeholder="E.g., Mid-Sem Feedback 2024"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Academic Year</label>
                            <select 
                                value={academicYearId}
                                onChange={(e) => setAcademicYearId(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                required
                            >
                                <option value="">Select Academic Year</option>
                                {academicYears.map(ay => (
                                    <option key={ay.id} value={ay.id}>{ay.name}{ay.isCurrent ? " (Current)" : ""}</option>
                                ))}
                            </select>
                        </div>

                        <div className="mb-4">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">Start Date</label>
                            <input 
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label className="mb-1 block text-sm font-semibold text-slate-600">End Date</label>
                            <input 
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                required
                            />
                        </div>

                        <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-md bg-fuchsia-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-fuchsia-700">
                            <FaPlus /> Create Window
                        </button>
                    </form>
                </div>

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
                                        
                                        return (
                                            <tr key={f.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-800">
                                                    {f.title}
                                                    <div className="text-xs text-slate-400 font-normal">{f.academicYear.name}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 text-xs">
                                                    <div>{new Date(f.startDate).toLocaleDateString()}</div>
                                                    <div>to {new Date(f.endDate).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-blue-600">{f._count?.submissions || 0}</td>
                                                <td className="px-4 py-3 text-center font-bold text-violet-600">{f._count?.responses || 0}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {isActive ? "ACTIVE" : "INACTIVE"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button 
                                                        onClick={() => router.push(`/admin/feedback/analytics/${f.id}`)}
                                                        className="inline-flex rounded bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                                    >
                                                        View Analytics
                                                    </button>
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
        </div>
    );
}
