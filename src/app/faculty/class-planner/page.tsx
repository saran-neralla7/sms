"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
    FaCalendarAlt, FaBookOpen, FaInfoCircle, FaSearch, FaFilter, 
    FaExclamationTriangle, FaCalendarCheck, FaHourglassHalf, FaAward, 
    FaFileInvoice, FaRegCalendarMinus, FaArrowLeft
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

export default function ClassPlannerPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedMappingId, setSelectedMappingId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && session?.user?.role === "FACULTY") {
            fetchCalendarAnalysis();
        } else if (status === "authenticated" && session?.user?.role !== "FACULTY") {
            router.push("/");
        }
    }, [status, session, router]);

    const fetchCalendarAnalysis = async () => {
        try {
            const res = await fetch("/api/faculty/calendar-analysis");
            if (res.ok) {
                const analysisData = await res.json();
                setData(analysisData);
                if (analysisData.results && analysisData.results.length > 0) {
                    setSelectedMappingId(analysisData.results[0].mappingId);
                }
            } else {
                console.error("Failed to fetch calendar analysis data");
            }
        } catch (error) {
            console.error("Error fetching calendar analysis:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
                <LogoSpinner />
                <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Calculating class calendars...</p>
            </div>
        );
    }

    if (!data || !data.results || data.results.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
                    <FaExclamationTriangle className="mx-auto text-4xl text-amber-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">No Mapped Subjects</h2>
                    <p className="text-sm text-slate-500 mt-2">You don't have any subjects mapped for this academic year yet. Please contact your HOD or Administrator to map your subjects.</p>
                    <button 
                        onClick={() => router.push("/faculty")}
                        className="mt-6 w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <FaArrowLeft size={12} /> Back to Gateway
                    </button>
                </div>
            </div>
        );
    }

    // Find the currently selected subject mapping
    const currentMapping = data.results.find((r: any) => r.mappingId === selectedMappingId) || data.results[0];

    // Helper for days of week
    const daysName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Filtered schedule entries
    const filteredSchedule = currentMapping.schedule.filter((item: any) => {
        const matchesSearch = item.date.includes(searchTerm) || 
            daysName[item.dayOfWeek].toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.period.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.details && item.details.toLowerCase().includes(searchTerm.toLowerCase()));
        
        if (statusFilter === "ALL") return matchesSearch;
        return matchesSearch && item.status === statusFilter;
    });

    const activeCount = currentMapping.stats?.activeClasses || 0;
    const holidayCount = currentMapping.stats?.lostToHolidays || 0;
    const examCount = currentMapping.stats?.lostToExams || 0;
    const totalCount = currentMapping.stats?.totalScheduled || 0;

    const activePercent = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;
    const holidayPercent = totalCount > 0 ? Math.round((holidayCount / totalCount) * 100) : 0;
    const examPercent = totalCount > 0 ? Math.round((examCount / totalCount) * 100) : 0;

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
                
                {/* Back Link & Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.push("/faculty")}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
                        >
                            <FaArrowLeft size={14} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Academic Class Planner</h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">
                                Analysis for Academic Session: <span className="text-blue-600 font-bold">{data.academicYear}</span>
                            </p>
                        </div>
                    </div>

                    {/* Subject Selector dropdown */}
                    <div className="w-full sm:w-80">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Select Assigned Class</label>
                        <select 
                            value={selectedMappingId} 
                            onChange={(e) => {
                                setSelectedMappingId(e.target.value);
                                setSearchTerm("");
                                setStatusFilter("ALL");
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                            {data.results.map((r: any) => (
                                <option key={r.mappingId} value={r.mappingId}>
                                    {r.subject.name} ({r.subject.code}) - Sec {r.section.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Subtitle Details Card */}
                <div className="mb-8 overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                Year {currentMapping.subject.year} - Sem {currentMapping.subject.semester}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded">
                                {currentMapping.subject.type}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                Section {currentMapping.section.name}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 leading-tight">{currentMapping.subject.name}</h2>
                        <p className="text-sm font-mono text-slate-500 mt-1">Course Code: {currentMapping.subject.code}</p>
                    </div>

                    {currentMapping.hasTimeline && (
                        <div className="grid grid-cols-2 gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0 text-slate-600">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Classwork Start</p>
                                <p className="font-bold text-slate-800 mt-0.5">{formatISTDate(currentMapping.timeline.classworkStart)}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Classwork End</p>
                                <p className="font-bold text-slate-800 mt-0.5">{formatISTDate(currentMapping.timeline.classworkEnd)}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Areas */}
                {!currentMapping.hasTimeline ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm text-center">
                        <FaExclamationTriangle className="mx-auto text-4xl text-amber-500 mb-4" />
                        <h3 className="text-lg font-bold text-slate-800">Timeline Not Configured</h3>
                        <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                            The administrator or director has not configured the B.Tech academic calendar milestones (Classwork Start/End dates) for **Year {currentMapping.subject.year} Semester {currentMapping.subject.semester}** yet.
                        </p>
                        <p className="text-xs text-slate-500 mt-4">Calculations cannot be performed without valid semester boundary dates.</p>
                    </div>
                ) : !currentMapping.hasTimetable ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 shadow-sm text-center">
                        <FaExclamationTriangle className="mx-auto text-4xl text-red-500 mb-4" />
                        <h3 className="text-lg font-bold text-slate-800">Timetable Entries Missing</h3>
                        <p className="text-sm text-slate-600 mt-2 max-w-lg mx-auto">
                            No active timetable slots were found for this subject/elective slot in **Section {currentMapping.section.name}**. 
                        </p>
                        <p className="text-xs text-slate-500 mt-4">Please request your department HOD or Administrator to upload/configure the timetable for Section {currentMapping.section.name}.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        
                        {/* Statistics Grid */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            
                            {/* Total Scheduled */}
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                                className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Scheduled</p>
                                        <h3 className="text-3xl font-black text-slate-900 mt-2">{totalCount} <span className="text-xs font-medium text-slate-400">Classes</span></h3>
                                    </div>
                                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                                        <FaCalendarAlt size={20} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-600 h-full rounded-full" style={{ width: "100%" }}></div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Timetable slots within timeline bounds</p>
                            </motion.div>

                            {/* Active Teaching Days */}
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Teaching Classes</p>
                                        <h3 className="text-3xl font-black text-green-600 mt-2">{activeCount} <span className="text-xs font-medium text-slate-400">Classes</span></h3>
                                    </div>
                                    <div className="rounded-xl bg-green-50 p-3 text-green-600">
                                        <FaCalendarCheck size={20} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-green-500 h-full rounded-full" style={{ width: `${activePercent}%` }}></div>
                                    </div>
                                    <span className="text-xs font-bold text-green-600">{activePercent}%</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Lectures available to cover syllabus</p>
                            </motion.div>

                            {/* Lost to Holidays */}
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                                className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lost to Holidays</p>
                                        <h3 className="text-3xl font-black text-amber-600 mt-2">{holidayCount} <span className="text-xs font-medium text-slate-400">Classes</span></h3>
                                    </div>
                                    <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                                        <FaRegCalendarMinus size={20} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${holidayPercent}%` }}></div>
                                    </div>
                                    <span className="text-xs font-bold text-amber-600">{holidayPercent}%</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Classes matching declared holidays</p>
                            </motion.div>

                            {/* Lost to Exams */}
                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lost to Exam Suspend</p>
                                        <h3 className="text-3xl font-black text-red-600 mt-2">{examCount} <span className="text-xs font-medium text-slate-400">Classes</span></h3>
                                    </div>
                                    <div className="rounded-xl bg-red-50 p-3 text-red-600">
                                        <FaHourglassHalf size={20} />
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-red-500 h-full rounded-full" style={{ width: `${examPercent}%` }}></div>
                                    </div>
                                    <span className="text-xs font-bold text-red-600">{examPercent}%</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Classes falling in Mid/Semester exam windows</p>
                            </motion.div>
                        </div>

                        {/* Calendar Planner Table & Search Filters */}
                        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            
                            {/* Toolbar */}
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6 pb-6 border-b border-slate-100">
                                <div className="flex items-center gap-3 self-start md:self-auto">
                                    <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><FaBookOpen /></div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Syllabus Class Schedule</h3>
                                        <p className="text-xs text-slate-500">Search dates and plan your lectures</p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    {/* Search Input */}
                                    <div className="relative flex-1 sm:w-64">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                            <FaSearch size={12} />
                                        </span>
                                        <input 
                                            type="text" 
                                            placeholder="Search Date, Day, Status..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Filter buttons */}
                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                                        <button 
                                            onClick={() => setStatusFilter("ALL")}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === "ALL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                        >
                                            All ({totalCount})
                                        </button>
                                        <button 
                                            onClick={() => setStatusFilter("ACTIVE")}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === "ACTIVE" ? "bg-white text-green-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                        >
                                            Active ({activeCount})
                                        </button>
                                        <button 
                                            onClick={() => setStatusFilter("HOLIDAY")}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === "HOLIDAY" ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                        >
                                            Holidays ({holidayCount})
                                        </button>
                                        <button 
                                            onClick={() => setStatusFilter("MID_I_EXAM")}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === "MID_I_EXAM" ? "bg-white text-red-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                        >
                                            Exams ({examCount})
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            {filteredSchedule.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-100">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                                            <tr>
                                                <th className="px-6 py-4 border-b border-slate-100">S.No</th>
                                                <th className="px-6 py-4 border-b border-slate-100">Scheduled Date</th>
                                                <th className="px-6 py-4 border-b border-slate-100">Day of Week</th>
                                                <th className="px-6 py-4 border-b border-slate-100">Period & Timing</th>
                                                <th className="px-6 py-4 border-b border-slate-100">Status</th>
                                                <th className="px-6 py-4 border-b border-slate-100">Details / Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                            {filteredSchedule.map((item: any, idx: number) => {
                                                let badgeClass = "";
                                                let statusLabel = "";

                                                switch (item.status) {
                                                    case "ACTIVE":
                                                        badgeClass = "bg-green-100 text-green-700 ring-1 ring-green-600/10";
                                                        statusLabel = "Active Class";
                                                        break;
                                                    case "HOLIDAY":
                                                        badgeClass = "bg-amber-100 text-amber-700 ring-1 ring-amber-600/10";
                                                        statusLabel = "Holiday";
                                                        break;
                                                    case "MID_I_EXAM":
                                                        badgeClass = "bg-red-100 text-red-700 ring-1 ring-red-600/10";
                                                        statusLabel = "Mid-I Exams";
                                                        break;
                                                    case "MID_II_EXAM":
                                                        badgeClass = "bg-rose-100 text-rose-700 ring-1 ring-rose-600/10";
                                                        statusLabel = "Mid-II Exams";
                                                        break;
                                                    case "SEM_EXAM":
                                                        badgeClass = "bg-purple-100 text-purple-700 ring-1 ring-purple-600/10";
                                                        statusLabel = "Sem Exams";
                                                        break;
                                                }

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                        <td className="px-6 py-4 font-bold text-slate-800">
                                                            {formatISTDate(item.date)}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600">{daysName[item.dayOfWeek]}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-indigo-600 text-xs">{item.period.name}</span>
                                                                <span className="text-[10px] text-slate-400 mt-0.5">{item.period.startTime} - {item.period.endTime}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${badgeClass}`}>
                                                                {statusLabel}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 italic text-xs max-w-xs truncate">
                                                            {item.details || "-"}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                                    <FaSearch className="mx-auto text-3xl text-slate-300 mb-4" />
                                    <p className="font-medium text-slate-600">No scheduled classes found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords.</p>
                                </div>
                            )}
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
}
