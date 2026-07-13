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
    FaRegCalendarTimes,
    FaBuilding,
    FaUserTie
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function AdminTeachingDiary() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [diaries, setDiaries] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userDeptId, setUserDeptId] = useState<string | null>(null);

    // Filters
    const [departmentId, setDepartmentId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && !["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(session?.user?.role || "")) {
            router.push("/");
        } else if (status === "authenticated") {
            fetchInitialData();
        }
    }, [status, session, router]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Load departments
            const deptRes = await fetch("/api/departments");
            if (deptRes.ok) {
                const depts = await deptRes.json();
                setDepartments(depts);
            }

            // If HOD, fetch profile to lock departmentId
            if (session?.user?.role === "HOD") {
                const profileRes = await fetch("/api/students/me"); // gets user context
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    if (profileData.user?.departmentId) {
                        setUserDeptId(profileData.user.departmentId);
                        setDepartmentId(profileData.user.departmentId);
                    }
                }
            }

            await fetchDiaries();
        } catch (error) {
            console.error("Error loading initial data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDiaries = async () => {
        try {
            const params = new URLSearchParams();
            if (departmentId) params.append("departmentId", departmentId);
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);
            if (searchQuery.trim()) params.append("search", searchQuery.trim());

            const res = await fetch(`/api/teaching-diary?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setDiaries(data);
            }
        } catch (error) {
            console.error("Error loading diaries:", error);
        }
    };

    // Refetch when filters change
    useEffect(() => {
        if (status === "authenticated") {
            fetchDiaries();
        }
    }, [departmentId, startDate, endDate]);

    // Handle search input submission
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchDiaries();
    };

    const clearFilters = () => {
        setDepartmentId(userDeptId || "");
        setStartDate("");
        setEndDate("");
        setSearchQuery("");
        // Trigger fetch directly for text inputs
        setTimeout(() => fetchDiaries(), 50);
    };

    if (status === "loading" || loading && diaries.length === 0) {
        return <LogoSpinner />;
    }

    const isHOD = session?.user?.role === "HOD";

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
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Teaching Diary Logs</h1>
                            <p className="text-sm text-slate-500">Monitor and filter faculty teaching diary records</p>
                        </div>
                    </div>
                </div>

                {/* Filters Board */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold text-sm">
                        <FaFilter className="text-blue-500" />
                        <span>Search & Filter Logs</span>
                    </div>

                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Search Input */}
                        <div className="relative">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Search Faculty Name / Emp Code</label>
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                        <FaSearch size={12} />
                                    </span>
                                    <input
                                        type="text"
                                        placeholder="Search faculty..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Department Filter */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Department</label>
                            <select
                                value={departmentId}
                                onChange={(e) => setDepartmentId(e.target.value)}
                                disabled={isHOD}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                {!isHOD && <option value="">All Departments</option>}
                                {departments.map((dept: any) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name} ({dept.code})
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
                    </form>

                    {(departmentId !== (userDeptId || "") || startDate || endDate || searchQuery) && (
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
                {diaries.length > 0 ? (
                    <div className="space-y-6">
                        {diaries.map((diary: any, idx: number) => {
                            const facultyName = diary.user?.faculty?.empName || diary.user?.username || "Faculty";
                            const empCode = diary.user?.faculty?.empCode || "N/A";
                            return (
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
                                                {new Date(diary.date).toLocaleDateString("en-IN", {
                                                    timeZone: "Asia/Kolkata",
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
                                            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <FaBuilding className="text-amber-500" />
                                                {diary.department?.code || "N/A"}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <FaUserTie className="text-slate-400" />
                                            <div className="text-right leading-none">
                                                <p className="text-xs font-bold text-slate-800">{facultyName}</p>
                                                <span className="text-[10px] text-slate-400 font-mono">Emp: {empCode}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-6">
                                        {diary.subject && (
                                            <h3 className="text-base font-bold text-slate-950 mb-3 flex items-center gap-2">
                                                <FaBookOpen className="text-blue-500" />
                                                {diary.subject.name}
                                                <span className="text-xs font-normal text-slate-400 font-mono">
                                                    ({diary.subject.code} • Year {diary.subject.year} Sem {diary.subject.semester})
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
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <FaRegCalendarTimes className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 mb-1">No Diary Logs Found</h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                            No teaching diary records match the filter criteria. Make sure topics were filled in attendance marking.
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
