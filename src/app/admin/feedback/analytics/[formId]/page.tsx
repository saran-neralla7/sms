"use client";

import { useState, useEffect, use } from "react";
import { FaChartBar, FaStar, FaArrowLeft, FaUsers, FaCheckCircle, FaClock, FaDownload } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function AdminFeedbackAnalyticsPage({ params }: { params: Promise<{ formId: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [participationData, setParticipationData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [partLoading, setPartLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"analytics" | "participation">("analytics");
    const [searchQuery, setSearchQuery] = useState("");
    const [sectionFilter, setSectionFilter] = useState("ALL");

    useEffect(() => {
        if (!resolvedParams?.formId) return;
        
        // Fetch analytics
        fetch(`/api/admin/feedback/analytics?formId=${resolvedParams.formId}`)
            .then(res => res.json())
            .then(res => {
                if (!res.error) setAnalyticsData(res);
                setLoading(false);
            })
            .catch(() => setLoading(false));

        // Fetch participation
        fetch(`/api/admin/feedback/forms/${resolvedParams.formId}/participation`)
            .then(res => res.json())
            .then(res => {
                if (!res.error) setParticipationData(res);
                setPartLoading(false);
            })
            .catch(() => setPartLoading(false));
    }, [resolvedParams?.formId]);

    const downloadCSV = () => {
        if (!participationData) return;
        const rows = [
            ["Roll Number", "Name", "Section", "Year", "Semester", "Status"],
            ...participationData.submitted.map((s: any) => [s.rollNumber, s.name, s.section, s.year, s.semester, "Submitted"]),
            ...participationData.pending.map((s: any) => [s.rollNumber, s.name, s.section, s.year, s.semester, "Pending"])
        ];
        const csv = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `participation_${participationData.formTitle?.replace(/\s+/g, "_")}.csv`;
        a.click();
    };

    const sections = participationData
        ? ["ALL", ...new Set([...participationData.submitted, ...participationData.pending].map((s: any) => s.section))]
        : ["ALL"];

    const filterStudents = (list: any[]) => {
        return list.filter((s: any) => {
            const matchSearch = !searchQuery || 
                s.rollNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchSection = sectionFilter === "ALL" || s.section === sectionFilter;
            return matchSearch && matchSection;
        });
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6 animate-in fade-in">
            {/* Header */}
            <div>
                <button onClick={() => router.push("/admin/feedback/windows")} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 mb-3">
                    <FaArrowLeft /> Back to Windows
                </button>
                <h1 className="flex items-center gap-3 text-3xl font-extrabold text-slate-900">
                    <FaChartBar className="text-violet-600" />
                    {participationData?.formTitle || "Feedback"}
                </h1>
            </div>

            {/* Participation Summary Cards */}
            {!partLoading && participationData && (
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                            <FaUsers size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-800">{participationData.totalStudents}</p>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Students</p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <FaCheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-green-700">{participationData.submittedCount}</p>
                            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Submitted</p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                            <FaClock size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-orange-700">{participationData.pendingCount}</p>
                            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Not Yet Submitted</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {!partLoading && participationData && participationData.totalStudents > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">Response Rate</span>
                        <span className="text-sm font-bold text-violet-600">
                            {Math.round((participationData.submittedCount / participationData.totalStudents) * 100)}%
                        </span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-green-500 transition-all duration-700"
                            style={{ width: `${(participationData.submittedCount / participationData.totalStudents) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-slate-400">
                        <span>0%</span>
                        <span>100%</span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <div className="flex gap-0">
                    {[
                        { key: "analytics", label: "Analytics", icon: FaChartBar },
                        { key: "participation", label: "Participation", icon: FaUsers }
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key as any)}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                                activeTab === key
                                    ? "border-violet-600 text-violet-700 bg-violet-50"
                                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            <Icon /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content: Analytics */}
            {activeTab === "analytics" && (
                <div>
                    {loading ? (
                        <div className="flex justify-center p-12"><LogoSpinner fullScreen={false} /></div>
                    ) : !analyticsData || analyticsData.totalResponses === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                            <FaChartBar className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                            <h2 className="text-xl font-bold text-slate-800">No Data Available</h2>
                            <p className="mt-2 text-slate-500">No feedback responses yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
                                    <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                                        <span className="text-2xl font-black">{analyticsData.overallAverage}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Overall Average Rating</h3>
                                        <p className="text-sm text-slate-500">Out of 5.0</p>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
                                    <div className="h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                                        <span className="text-2xl font-black">{analyticsData.totalResponses}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">Total Evaluations</h3>
                                        <p className="text-sm text-slate-500">Anonymous faculty evaluations</p>
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-slate-800">Faculty Performance</h2>
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                        <tr>
                                            <th className="px-6 py-4">Faculty Name</th>
                                            <th className="px-6 py-4">Department</th>
                                            <th className="px-6 py-4">Subject</th>
                                            <th className="px-6 py-4 text-center">Evaluations</th>
                                            <th className="px-6 py-4 text-center">Avg Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {analyticsData.breakdown.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-800">{row.facultyName}</td>
                                                <td className="px-6 py-4 text-slate-500">{row.department}</td>
                                                <td className="px-6 py-4 text-slate-600">{row.subjectName}</td>
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
                    )}
                </div>
            )}

            {/* Tab Content: Participation */}
            {activeTab === "participation" && (
                <div className="space-y-4">
                    {partLoading ? (
                        <div className="flex justify-center p-12"><LogoSpinner fullScreen={false} /></div>
                    ) : !participationData ? (
                        <div className="text-center text-slate-500 p-12">Failed to load participation data.</div>
                    ) : (
                        <>
                            {/* Filters */}
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                                <div className="flex gap-3 flex-wrap">
                                    <input
                                        type="text"
                                        placeholder="Search by name or roll no..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    />
                                    <select
                                        value={sectionFilter}
                                        onChange={e => setSectionFilter(e.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                    >
                                        {sections.map(s => (
                                            <option key={s} value={s}>Section: {s}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    onClick={downloadCSV}
                                    className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 transition-colors"
                                >
                                    <FaDownload /> Export CSV
                                </button>
                            </div>

                            {/* Pending Students */}
                            <div className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
                                <div className="bg-orange-50 px-6 py-4 flex items-center gap-3 border-b border-orange-200">
                                    <FaClock className="text-orange-500" />
                                    <h3 className="font-bold text-orange-800">
                                        Not Yet Submitted ({filterStudents(participationData.pending).length})
                                    </h3>
                                </div>
                                {filterStudents(participationData.pending).length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">
                                        {searchQuery || sectionFilter !== "ALL" ? "No matching students." : "🎉 All students have submitted!"}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-3">#</th>
                                                    <th className="px-6 py-3">Roll Number</th>
                                                    <th className="px-6 py-3">Name</th>
                                                    <th className="px-6 py-3">Section</th>
                                                    <th className="px-6 py-3">Year / Sem</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filterStudents(participationData.pending).map((s: any, i: number) => (
                                                    <tr key={s.id} className="hover:bg-orange-50/50">
                                                        <td className="px-6 py-3 text-slate-400 font-mono">{i + 1}</td>
                                                        <td className="px-6 py-3 font-mono font-bold text-slate-700">{s.rollNumber}</td>
                                                        <td className="px-6 py-3 font-semibold text-slate-800">{s.name}</td>
                                                        <td className="px-6 py-3">
                                                            <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                                                                Section {s.section}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-500 text-xs font-semibold">
                                                            Year {s.year} · Sem {s.semester}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Submitted Students */}
                            <div className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
                                <div className="bg-green-50 px-6 py-4 flex items-center gap-3 border-b border-green-200">
                                    <FaCheckCircle className="text-green-500" />
                                    <h3 className="font-bold text-green-800">
                                        Submitted ({filterStudents(participationData.submitted).length})
                                    </h3>
                                </div>
                                {filterStudents(participationData.submitted).length === 0 ? (
                                    <div className="p-6 text-center text-slate-500 text-sm">No matching students.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-6 py-3">#</th>
                                                    <th className="px-6 py-3">Roll Number</th>
                                                    <th className="px-6 py-3">Name</th>
                                                    <th className="px-6 py-3">Section</th>
                                                    <th className="px-6 py-3">Year / Sem</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filterStudents(participationData.submitted).map((s: any, i: number) => (
                                                    <tr key={s.id} className="hover:bg-green-50/50">
                                                        <td className="px-6 py-3 text-slate-400 font-mono">{i + 1}</td>
                                                        <td className="px-6 py-3 font-mono font-bold text-slate-700">{s.rollNumber}</td>
                                                        <td className="px-6 py-3 font-semibold text-slate-800">{s.name}</td>
                                                        <td className="px-6 py-3">
                                                            <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                                                                Section {s.section}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-slate-500 text-xs font-semibold">
                                                            Year {s.year} · Sem {s.semester}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
