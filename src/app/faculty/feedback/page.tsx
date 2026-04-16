"use client";

import { useState, useEffect } from "react";
import { FaChartBar, FaStar, FaArrowLeft, FaComments } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function FacultyFeedbackPage() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/faculty/feedback")
            .then(res => res.json())
            .then(res => {
                if (!res.error) setData(res);
                setLoading(false);
            })
            .catch(console.error);
    }, []);

    if (loading) return <div className="flex justify-center p-12"><LogoSpinner fullScreen={false} /></div>;

    if (!data || data.totalResponses === 0) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-8 animate-in fade-in">
                <div className="mb-6">
                    <button onClick={() => router.push("/faculty/dashboard")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
                        <FaArrowLeft /> Back to Dashboard
                    </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <FaChartBar className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">No Feedback Available</h2>
                    <p className="mt-2 text-slate-500">You have zero feedback responses at the moment.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-8 animate-in fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button onClick={() => router.push("/faculty/dashboard")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-2">
                        <FaArrowLeft /> Back to Dashboard
                    </button>
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">
                        <FaChartBar className="text-fuchsia-600" />
                        My Feedback Analytics
                    </h1>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-600 shadow-inner">
                        <span className="text-2xl font-black">{data.overallAverage}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Overall Rating</h3>
                        <p className="text-sm text-slate-500 hover:text-slate-700">Out of 5.0 (Across all subjects)</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-inner">
                        <span className="text-2xl font-black">{data.totalResponses}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Total Responses</h3>
                        <p className="text-sm text-slate-500">Number of students who provided feedback</p>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-4">Subject-wise Analytics</h2>
            
            <div className="grid gap-6 lg:grid-cols-2">
                {data.subjectAnalytics.map((sub: any, idx: number) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{sub.subject.name}</h3>
                                <p className="text-sm font-semibold text-fuchsia-600">{sub.subject.code}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black text-slate-900 flex items-center gap-1 justify-end">
                                    {sub.average} <FaStar className="text-yellow-400 text-lg" />
                                </div>
                                <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{sub.totalResponses} Responses</p>
                            </div>
                        </div>

                        <div className="flex-grow">
                            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                                <FaComments className="text-slate-400" />
                                Anonymous Student Comments:
                            </h4>
                            {sub.comments.length > 0 ? (
                                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {sub.comments.map((comment: string, i: number) => (
                                        <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100 italic relative">
                                            "{comment}"
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-400 italic bg-slate-50 p-4 rounded-lg text-center border border-slate-100">No written comments provided.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
