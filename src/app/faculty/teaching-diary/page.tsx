"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    FaBookOpen,
    FaArrowLeft,
    FaCalendarAlt,
    FaChalkboard,
    FaClock,
    FaFilter,
    FaSearch,
    FaRegCalendarTimes
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function FacultyTeachingDiary() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [diaries, setDiaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [subjectId, setSubjectId] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Dynamic Lists for filter dropdowns
    const [subjectsList, setSubjectsList] = useState<any[]>([]);
    const [sectionsList, setSectionsList] = useState<any[]>([]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && !["FACULTY", "SMS_USER"].includes(session?.user?.role || "")) {
            router.push("/");
        } else if (status === "authenticated") {
            fetchDiaries();
        }
    }, [status, session, router]);

    const fetchDiaries = async () => {
        setLoading(true);
        try {
            // Fetch diaries
            const params = new URLSearchParams();
            if (subjectId) params.append("subjectId", subjectId);
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            const res = await fetch(`/api/teaching-diary?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setDiaries(data);

                // Populate filter lists from loaded diaries
                const uniqueSubjects = new Map();
                const uniqueSections = new Map();

                data.forEach((d: any) => {
                    if (d.subject) {
                        uniqueSubjects.set(d.subject.id, d.subject);
                    }
                    if (d.section) {
                        uniqueSections.set(d.section.id, d.section);
                    }
                });

                if (subjectsList.length === 0) setSubjectsList(Array.from(uniqueSubjects.values()));
                if (sectionsList.length === 0) setSectionsList(Array.from(uniqueSections.values()));
            }
        } catch (error) {
            console.error("Error loading diaries:", error);
        } finally {
            setLoading(false);
        }
    };

    // Trigger fetch on filter change
    useEffect(() => {
        if (status === "authenticated") {
            fetchDiaries();
        }
    }, [subjectId, startDate, endDate]);

    // Client-side text search and section filter
    const filteredDiaries = diaries.filter((d: any) => {
        // Section filter
        if (sectionId && d.sectionId !== sectionId) return false;

        // Search text query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const topicsText = (d.topicsTaught || "").toLowerCase();
            const subjectName = (d.subject?.name || "").toLowerCase();
            const subjectCode = (d.subject?.code || "").toLowerCase();
            const sectionName = (d.section?.name || "").toLowerCase();
            
            return (
                topicsText.includes(query) ||
                subjectName.includes(query) ||
                subjectCode.includes(query) ||
                sectionName.includes(query)
            );
        }

        return true;
    });

    const clearFilters = () => {
        setSubjectId("");
        setSectionId("");
        setStartDate("");
        setEndDate("");
        setSearchQuery("");
    };

    if (status === "loading" || loading && diaries.length === 0) {
        return <LogoSpinner />;
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <FaArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Teaching Diary</h1>
                            <p className="text-sm text-slate-500">View and track session topics taught chronologically</p>
                        </div>
                    </div>
                </div>

                {/* Filters Board */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold text-sm">
                        <FaFilter className="text-blue-500" />
                        <span>Filter Diary Logs</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Search Input */}
                        <div className="relative">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Search Keywords</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                    <FaSearch size={12} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search topics..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                                />
                            </div>
                        </div>

                        {/* Subject Filter */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Subject</label>
                            <select
                                value={subjectId}
                                onChange={(e) => setSubjectId(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white"
                            >
                                <option value="">All Subjects</option>
                                {subjectsList.map((sub: any) => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.name} ({sub.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Section Filter */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Section</label>
                            <select
                                value={sectionId}
                                onChange={(e) => setSectionId(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white"
                            >
                                <option value="">All Sections</option>
                                {sectionsList.map((sec: any) => (
                                    <option key={sec.id} value={sec.id}>
                                        Section {sec.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">From Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                            />
                        </div>

                        {/* End Date */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">To Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                            />
                        </div>
                    </div>

                    {(subjectId || sectionId || startDate || endDate || searchQuery) && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={clearFilters}
                                className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    )}
                </div>

                {/* Diary Timeline / Cards */}
                {filteredDiaries.length > 0 ? (
                    <div className="space-y-6">
                        {filteredDiaries.map((diary: any, idx: number) => (
                            <motion.div
                                key={diary.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Header band */}
                                <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                            <FaCalendarAlt className="text-blue-500" />
                                            {new Date(diary.date).toLocaleDateString("en-US", {
                                                weekday: "short",
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric"
                                            })}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                            <FaClock className="text-emerald-500" />
                                            Period {diary.period?.name || "N/A"} ({diary.period?.startTime || ""} - {diary.period?.endTime || ""})
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                            <FaChalkboard className="text-indigo-500" />
                                            Section {diary.section?.name || "N/A"}
                                        </span>
                                    </div>

                                    {diary.subject && (
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">
                                                {diary.subject.code}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    {diary.subject && (
                                        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <FaBookOpen className="text-blue-500" />
                                            {diary.subject.name}
                                            <span className="text-xs font-normal text-slate-400">
                                                (Year {diary.subject.year} Sem {diary.subject.semester})
                                            </span>
                                        </h3>
                                    )}

                                    <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: diary.topicsTaught || `<p className="italic text-slate-400">No topics entered.</p>`
                                            }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <FaRegCalendarTimes className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 mb-1">No Diary Logs Found</h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                            We couldn't find any teaching diary entries matching your selected filters. Let faculty mark attendance and fill the diary to start logging.
                        </p>
                    </div>
                )}
            </div>
            
            {/* Custom CSS for editor styles */}
            <style jsx global>{`
                .prose ul {
                    list-style-type: disc !important;
                    padding-left: 1.5rem !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                }
                .prose ol {
                    list-style-type: decimal !important;
                    padding-left: 1.5rem !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                }
                .prose li {
                    margin-top: 0.25rem !important;
                    margin-bottom: 0.25rem !important;
                }
            `}</style>
        </div>
    );
}
