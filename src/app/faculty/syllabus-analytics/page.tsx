"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaChartPie,
    FaCheckCircle,
    FaTimesCircle,
    FaBookOpen,
    FaCalendarAlt,
    FaChevronDown,
    FaChevronUp,
    FaExclamationTriangle,
    FaArrowLeft,
    FaFileAlt
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from "recharts";

export default function SyllabusAnalyticsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [mappedSubjects, setMappedSubjects] = useState<any[]>([]);

    // Admin / Director / HOD states
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
    const [selectedSectionId, setSelectedSectionId] = useState<string>("");
    const [adminMappings, setAdminMappings] = useState<any[]>([]);
    const [mappingsLoading, setMappingsLoading] = useState(false);

    const [selectedMappingId, setSelectedMappingId] = useState<string>("");
    const [analytics, setAnalytics] = useState<any>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [expandedUnit, setExpandedUnit] = useState<string | null>("UNIT-I");

    const role = session?.user?.role || "";
    const isAdminOrHod = ["ADMIN", "DIRECTOR", "HOD"].includes(role);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && !["FACULTY", "SMS_USER", "ADMIN", "DIRECTOR", "HOD"].includes(role)) {
            router.push("/");
        } else if (status === "authenticated") {
            fetchInitialData();
        }
    }, [status, session, router, role]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            if (isAdminOrHod) {
                // 1. Fetch Academic Years
                const resAy = await fetch("/api/academic-years");
                let ayList = [];
                if (resAy.ok) {
                    ayList = await resAy.json();
                    setAcademicYears(ayList);
                    const currentAy = ayList.find((y: any) => y.isCurrent);
                    if (currentAy) {
                        setSelectedAcademicYearId(currentAy.id);
                    } else if (ayList.length > 0) {
                        setSelectedAcademicYearId(ayList[0].id);
                    }
                }

                // 2. Fetch Departments
                const resDept = await fetch("/api/departments");
                if (resDept.ok) {
                    const depts = await resDept.json();
                    setDepartments(depts);

                    // Determine department selection
                    let deptId = "";
                    if (role === "HOD" && session?.user?.departmentId) {
                        deptId = session.user.departmentId;
                    } else if (depts.length > 0) {
                        deptId = depts[0].id;
                    }
                    setSelectedDepartmentId(deptId);

                    const dept = depts.find((d: any) => d.id === deptId);
                    if (dept && dept.sections && dept.sections.length > 0) {
                        setSelectedSectionId(dept.sections[0].id);
                    }
                }
            } else {
                // Faculty flow
                const resDashboard = await fetch("/api/faculty/me/dashboard");
                if (resDashboard.ok) {
                    const dataDashboard = await resDashboard.json();
                    const subjects = dataDashboard.subjects || [];
                    setMappedSubjects(subjects);
                    if (subjects.length > 0) {
                        setSelectedMappingId(subjects[0].id);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading mapped subjects:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMappings = async (ayId: string, secId: string) => {
        setMappingsLoading(true);
        try {
            const res = await fetch(`/api/admin/faculty-mappings?academicYearId=${ayId}&sectionId=${secId}`);
            if (res.ok) {
                const data = await res.json();
                setAdminMappings(data);
            } else {
                setAdminMappings([]);
            }
        } catch (error) {
            console.error("Error fetching mappings:", error);
            setAdminMappings([]);
        } finally {
            setMappingsLoading(false);
        }
    };

    useEffect(() => {
        if (isAdminOrHod && selectedAcademicYearId && selectedSectionId) {
            fetchMappings(selectedAcademicYearId, selectedSectionId);
        }
    }, [selectedAcademicYearId, selectedSectionId, isAdminOrHod]);

    const currentDept = departments.find((d: any) => d.id === selectedDepartmentId);
    const departmentSections = currentDept?.sections || [];
    const filteredMappings = adminMappings.filter(m => m.subject?.departmentId === selectedDepartmentId);

    useEffect(() => {
        if (isAdminOrHod) {
            if (filteredMappings.length > 0) {
                const exists = filteredMappings.some(m => m.id === selectedMappingId);
                if (!exists) {
                    setSelectedMappingId(filteredMappings[0].id);
                }
            } else {
                setSelectedMappingId("");
                setAnalytics(null);
            }
        }
    }, [adminMappings, selectedDepartmentId, isAdminOrHod]);

    const fetchAnalytics = async (mappingId: string) => {
        const mapping = isAdminOrHod
            ? filteredMappings.find(m => m.id === mappingId)
            : mappedSubjects.find(m => m.id === mappingId);

        if (!mapping) {
            setAnalytics(null);
            return;
        }

        setAnalyticsLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("subjectId", mapping.subjectId);
            params.append("sectionId", mapping.sectionId);
            
            const ayId = mapping.academicYearId || mapping.academicYear?.id || selectedAcademicYearId;
            if (ayId) {
                params.append("academicYearId", ayId);
            }

            const res = await fetch(`/api/faculty/syllabus-completion?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
                // Expand first unit by default
                if (data.units && data.units.length > 0) {
                    setExpandedUnit(data.units[0].name);
                }
            } else {
                setAnalytics(null);
            }
        } catch (error) {
            console.error("Error fetching syllabus analytics:", error);
            setAnalytics(null);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedMappingId) {
            fetchAnalytics(selectedMappingId);
        }
    }, [selectedMappingId]);

    if (!mounted || loading || status === "loading") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
                <LogoSpinner />
                <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading Syllabus Analytics...</p>
            </div>
        );
    }

    const currentMapping = isAdminOrHod
        ? filteredMappings.find(m => m.id === selectedMappingId)
        : mappedSubjects.find(m => m.id === selectedMappingId);

    // Prepare chart data if analytics exists
    let pieData: any[] = [];
    let barData: any[] = [];
    if (analytics) {
        pieData = [
            { name: "Completed", value: analytics.completedTopicsCount },
            { name: "Remaining", value: analytics.totalTopicsCount - analytics.completedTopicsCount }
        ];

        barData = analytics.units.map((unit: any) => ({
            name: unit.name,
            Percentage: unit.completionPercentage,
            Completed: unit.completedCount,
            Total: unit.totalCount
        }));
    }

    const PIE_COLORS = ["#10b981", "#cbd5e1"]; // emerald-500 and slate-300

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", year: "numeric" });
    };

    const getBackUrl = () => {
        if (role === "ADMIN" || role === "DIRECTOR") return "/admin";
        if (role === "HOD") return "/dashboard";
        return "/faculty";
    };

    const getBackText = () => {
        if (role === "ADMIN" || role === "DIRECTOR") return "Back to Admin Dashboard";
        if (role === "HOD") return "Back to Dashboard";
        return "Back to Gateway";
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
                
                {/* Header Back Bar */}
                <div className="mb-6">
                    <Link
                        href={getBackUrl()}
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        <FaArrowLeft /> {getBackText()}
                    </Link>
                </div>

                {/* Main Heading */}
                <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b border-slate-200 pb-6">
                    <div className="max-w-xl">
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                            <FaChartPie className="text-blue-600 animate-pulse" /> Syllabus Completion Analytics
                        </h1>
                        <p className="mt-2 text-slate-600">
                            Track the overall and unit-wise completion progress of course syllabus based on teaching diaries.
                        </p>
                    </div>

                    {/* Subject Selector (Admin / HOD Filter vs Faculty selector) */}
                    {isAdminOrHod ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full md:max-w-4xl bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            {/* Academic Year */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Academic Year
                                </label>
                                <select
                                    value={selectedAcademicYearId}
                                    onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                >
                                    {academicYears.map((ay) => (
                                        <option key={ay.id} value={ay.id}>
                                            {ay.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Department */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Department
                                </label>
                                <select
                                    value={selectedDepartmentId}
                                    onChange={(e) => {
                                        const deptId = e.target.value;
                                        setSelectedDepartmentId(deptId);
                                        const dept = departments.find((d: any) => d.id === deptId);
                                        if (dept && dept.sections && dept.sections.length > 0) {
                                            setSelectedSectionId(dept.sections[0].id);
                                        } else {
                                            setSelectedSectionId("");
                                        }
                                    }}
                                    disabled={role === "HOD"}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                >
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} ({d.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Section */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Section
                                </label>
                                <select
                                    value={selectedSectionId}
                                    onChange={(e) => setSelectedSectionId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                >
                                    {departmentSections.length === 0 ? (
                                        <option value="">No sections</option>
                                    ) : (
                                        departmentSections.map((sec: any) => (
                                            <option key={sec.id} value={sec.id}>
                                                {sec.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Subject Selector */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Subject & Faculty
                                </label>
                                <select
                                    value={selectedMappingId}
                                    onChange={(e) => setSelectedMappingId(e.target.value)}
                                    disabled={filteredMappings.length === 0 || mappingsLoading}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                                >
                                    {mappingsLoading ? (
                                        <option>Loading mappings...</option>
                                    ) : filteredMappings.length === 0 ? (
                                        <option value="">No subjects mapped</option>
                                    ) : (
                                        filteredMappings.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.subject?.name} - {m.faculty?.empName || "No Faculty"}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>
                    ) : (
                        mappedSubjects.length > 0 && (
                            <div className="w-full md:w-80">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Select Course Mapping
                                </label>
                                <select
                                    value={selectedMappingId}
                                    onChange={(e) => setSelectedMappingId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                >
                                    {mappedSubjects.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.subject?.name} ({m.subject?.code}) - Sec {m.section?.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )
                    )}
                </div>

                {analyticsLoading ? (
                    <div className="flex h-96 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="text-center">
                            <LogoSpinner fullScreen={false} />
                            <p className="mt-4 text-sm text-slate-500 animate-pulse">Calculating syllabus completion rate...</p>
                        </div>
                    </div>
                ) : !analytics || analytics.totalTopicsCount === 0 ? (
                    /* No Syllabus Uploaded / Configured screen */
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm max-w-2xl mx-auto my-8">
                        <FaExclamationTriangle className="mx-auto text-5xl text-amber-500 mb-4 animate-bounce" />
                        <h3 className="text-xl font-bold text-slate-800">Syllabus Not Configured</h3>
                        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                            No syllabus found or configured for this subject. In order to get completion analytics, the syllabus must be uploaded and broken down into comma-separated topics.
                        </p>
                        {!isAdminOrHod && (
                            <div className="mt-8 flex justify-center gap-4">
                                <Link
                                    href="/faculty/mid-exam"
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all"
                                >
                                    <FaFileAlt /> Go to Syllabus Editor
                                </Link>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Dashboard Stats and Charts */
                    <div className="space-y-8">
                        
                        {/* High Impact Stat Cards */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Overall Progress</p>
                                    <h4 className="mt-2 text-4xl font-black text-slate-900">{analytics.overallCompletionPercentage}%</h4>
                                    <div className="mt-3 w-36 bg-slate-100 rounded-full h-2">
                                        <div 
                                            className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                                            style={{ width: `${analytics.overallCompletionPercentage}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="rounded-full bg-emerald-50 p-4 text-emerald-500">
                                    <FaCheckCircle className="h-8 w-8" />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.05 }}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Topics</p>
                                    <h4 className="mt-2 text-4xl font-black text-slate-900">{analytics.completedTopicsCount}</h4>
                                    <p className="mt-2 text-xs text-slate-500">topics taught and logged in teaching diary</p>
                                </div>
                                <div className="rounded-full bg-blue-50 p-4 text-blue-500">
                                    <FaBookOpen className="h-8 w-8" />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.1 }}
                                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remaining Topics</p>
                                    <h4 className="mt-2 text-4xl font-black text-slate-900">{analytics.totalTopicsCount - analytics.completedTopicsCount}</h4>
                                    <p className="mt-2 text-xs text-slate-500">out of {analytics.totalTopicsCount} total syllabus topics</p>
                                </div>
                                <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                                    <FaTimesCircle className="h-8 w-8" />
                                </div>
                            </motion.div>
                        </div>

                        {/* Chart and Detail Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            
                            {/* Left Column: Visual Charts */}
                            <div className="lg:col-span-1 space-y-6">
                                
                                {/* Pie Chart Card */}
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <FaChartPie className="text-blue-500" /> Syllabus Breakdown
                                    </h3>
                                    <div className="relative h-64 flex items-center justify-center">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {pieData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-3xl font-extrabold text-slate-800">{analytics.overallCompletionPercentage}%</span>
                                            <span className="text-xs font-semibold text-slate-400">Completed</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-center gap-6 mt-2 text-xs font-semibold text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded bg-emerald-500" />
                                            Completed ({analytics.completedTopicsCount})
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-3 rounded bg-slate-300" />
                                            Remaining ({analytics.totalTopicsCount - analytics.completedTopicsCount})
                                        </div>
                                    </div>
                                </div>

                                {/* Unit Progress Bar Chart */}
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 mb-6">Unit Completion Rates</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={barData}
                                                layout="vertical"
                                                margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                                            >
                                                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                <YAxis dataKey="name" type="category" tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }} />
                                                <Tooltip formatter={(value) => [`${value}%`, 'Completion']} />
                                                <Bar dataKey="Percentage" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                                    {barData.map((entry, index) => {
                                                        const isFinished = entry.Percentage === 100;
                                                        return <Cell key={`cell-${index}`} fill={isFinished ? "#10b981" : "#3b82f6"} />;
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Detailed Accordion Checklist */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                                        <h3 className="text-lg font-bold text-slate-900">Topic Completion Checklist</h3>
                                        <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                                            Click Unit Header to Expand
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        {analytics.units.map((unit: any) => {
                                            const isExpanded = expandedUnit === unit.name;
                                            const isFull = unit.completionPercentage === 100;

                                            return (
                                                <div 
                                                    key={unit.name} 
                                                    className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all hover:border-slate-300"
                                                >
                                                    {/* Accordion Trigger */}
                                                    <button
                                                        onClick={() => setExpandedUnit(isExpanded ? null : unit.name)}
                                                        className="flex w-full items-center justify-between bg-white px-5 py-4 text-left transition-colors hover:bg-slate-50/50"
                                                    >
                                                        <div className="flex-grow pr-4">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                                    {unit.name}
                                                                </span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isFull ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {unit.completionPercentage}% Completed
                                                                </span>
                                                            </div>
                                                            <h4 className="mt-1.5 text-sm font-bold text-slate-900 line-clamp-1">
                                                                {unit.title
                                                                    ? unit.title
                                                                        .replace(/<[^>]*>/g, "")
                                                                        .replace(/&amp;/g, "&")
                                                                        .replace(/&lt;/g, "<")
                                                                        .replace(/&gt;/g, ">")
                                                                        .replace(/&quot;/g, '"')
                                                                        .replace(/&#39;/g, "'")
                                                                        .replace(/&nbsp;/g, " ")
                                                                    : "No Title"}
                                                            </h4>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs font-semibold text-slate-500 hidden sm:inline-block">
                                                                {unit.completedCount}/{unit.totalCount} topics
                                                            </span>
                                                            {isExpanded ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                                        </div>
                                                    </button>

                                                    {/* Accordion Content */}
                                                    <AnimatePresence initial={false}>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0 }}
                                                                animate={{ height: "auto" }}
                                                                exit={{ height: 0 }}
                                                                className="overflow-hidden border-t border-slate-100"
                                                            >
                                                                <div className="p-5 bg-white divide-y divide-slate-100">
                                                                    {unit.topics.length === 0 ? (
                                                                        <p className="text-xs text-slate-400 italic text-center py-4">No topics found inside this unit content.</p>
                                                                    ) : (
                                                                        unit.topics.map((topic: any, tIdx: number) => (
                                                                            <div 
                                                                                key={tIdx} 
                                                                                className="flex items-start justify-between py-3 gap-4 text-sm"
                                                                            >
                                                                                <div className="flex items-start gap-3">
                                                                                    <div className="mt-0.5">
                                                                                        {topic.completed ? (
                                                                                            <FaCheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                                                                        ) : (
                                                                                            <div className="h-5 w-5 rounded-full border-2 border-slate-200 shrink-0" />
                                                                                        )}
                                                                                    </div>
                                                                                    <span className={`font-medium ${topic.completed ? 'text-slate-800 line-through decoration-slate-300' : 'text-slate-700'}`}>
                                                                                        {topic.name}
                                                                                    </span>
                                                                                </div>
                                                                                
                                                                                {topic.completed && topic.dateTaught && (
                                                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100 shrink-0">
                                                                                        <FaCalendarAlt className="h-3 w-3" /> {formatDate(topic.dateTaught)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
}
