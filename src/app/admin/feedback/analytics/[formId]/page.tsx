"use client";

import { useState, useEffect, use } from "react";
import { FaChartBar, FaStar, FaArrowLeft } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function AdminFeedbackAnalyticsPage({ params }: { params: Promise<{ formId: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!resolvedParams?.formId) return;
        fetch(`/api/admin/feedback/analytics?formId=${resolvedParams.formId}`)
            .then(res => res.json())
            .then(res => {
                if (!res.error) setData(res);
                setLoading(false);
            })
            .catch(console.error);
    }, [resolvedParams?.formId]);

    if (loading) return <div className="flex justify-center p-12"><LogoSpinner fullScreen={false} /></div>;

    if (!data || data.totalResponses === 0) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-8 animate-in fade-in">
                <div className="mb-6">
                    <button onClick={() => router.push("/admin/feedback/windows")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
                        <FaArrowLeft /> Back to Windows
                    </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <FaChartBar className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">No Data Available</h2>
                    <p className="mt-2 text-slate-500">There are no feedback responses for this form yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-8 animate-in fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button onClick={() => router.push("/admin/feedback/windows")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
                        <FaArrowLeft /> Back to Windows
                    </button>
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">
                        <FaChartBar className="text-blue-600" />
                        Feedback Result Analytics
                    </h1>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-inner">
                        <span className="text-2xl font-black">{data.overallAverage}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Institution Overall Average</h3>
                        <p className="text-sm text-slate-500 hover:text-slate-700">Out of 5.0</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                        <span className="text-2xl font-black">{data.totalResponses}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Total Analytics Tracked</h3>
                        <p className="text-sm text-slate-500">Individual student evaluations collected</p>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-4">Faculty Performance Breakdown</h2>
            
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                        <tr>
                            <th className="px-6 py-4">Faculty Name</th>
                            <th className="px-6 py-4">Department</th>
                            <th className="px-6 py-4">Subject</th>
                            <th className="px-6 py-4 text-center">Evaluations</th>
                            <th className="px-6 py-4 text-center">Average Rating</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.breakdown.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-800">{row.facultyName}</td>
                                <td className="px-6 py-4 font-bold text-slate-500">{row.department}</td>
                                <td className="px-6 py-4 font-medium text-slate-600">{row.subjectName}</td>
                                <td className="px-6 py-4 text-center font-bold text-slate-600">{row.totalResponses}</td>
                                <td className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center gap-1 font-bold rounded-lg px-3 py-1 bg-slate-100">
                                        {row.average} <FaStar className="text-yellow-400" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
