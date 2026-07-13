"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    ReferenceLine
} from "recharts";
import {
    FaArrowLeft,
    FaFilter,
    FaCalendarAlt,
    FaChalkboard,
    FaBook,
    FaChartLine,
    FaUserGraduate,
    FaClock,
    FaCheckCircle,
    FaExclamationTriangle,
    FaChevronDown,
    FaChevronUp,
    FaEdit,
    FaSave,
    FaTimes,
    FaUniversity,
    FaBookOpen,
    FaPlus,
    FaUserTie
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function AttendanceStatisticsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const role = (session?.user?.role || "").toUpperCase();
    const isFaculty = role === "FACULTY";
    const isHOD = role === "HOD";
    const isAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);

    // Initial Loading
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);

    // Metadata for dropdowns
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [facultyMappings, setFacultyMappings] = useState<any[]>([]); // For Faculty Role

    // Filters State
    const [academicYearId, setAcademicYearId] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [selectedMappingId, setSelectedMappingId] = useState(""); // For Faculty Role

    // Configurable Detention Threshold
    const [detentionThreshold, setDetentionThreshold] = useState(75);

    // Aggregated Stats State
    const [stats, setStats] = useState<any>(null);

    // Active visual chart tab
    const [chartTab, setChartTab] = useState<"trend" | "dayOfWeek">("trend");

    // Daily Logs Expander states (contains record ID mapping to boolean)
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

    // Inline Teaching Diary Editing State
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editingTopic, setEditingTopic] = useState("");
    const [savingDiary, setSavingDiary] = useState(false);

    // Fetch initial data based on role
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
            return;
        }

        if (status === "authenticated") {
            const loadMetadata = async () => {
                setLoading(true);
                try {
                    // Fetch Academic Years
                    const ayRes = await fetch("/api/academic-years");
                    if (ayRes.ok) {
                        const ays = await ayRes.json();
                        setAcademicYears(ays);
                        const active = ays.find((y: any) => y.isCurrent);
                        if (active) setAcademicYearId(active.id);
                        else if (ays.length > 0) setAcademicYearId(ays[0].id);
                    }

                    if (isFaculty) {
                        // Load faculty subject mappings
                        const meRes = await fetch("/api/faculty/me/dashboard");
                        if (meRes.ok) {
                            const dashboardData = await meRes.json();
                            const mappings = dashboardData.subjects || [];
                            setFacultyMappings(mappings);
                            if (mappings.length > 0) {
                                setSelectedMappingId(mappings[0].id);
                                setSubjectId(mappings[0].subjectId);
                                setSectionId(mappings[0].sectionId);
                            }
                        }
                    } else {
                        // Admin or HOD
                        const deptRes = await fetch("/api/departments");
                        if (deptRes.ok) {
                            const depts = await deptRes.json();
                            setDepartments(depts);

                            if (isHOD) {
                                // Locked to their own department
                                const hodDeptId = (session?.user as any)?.departmentId || "";
                                setDepartmentId(hodDeptId);
                                if (hodDeptId) {
                                    fetchSectionsAndSubjects(hodDeptId, year, semester);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error loading metadata:", e);
                } finally {
                    setLoading(false);
                }
            };
            loadMetadata();
        }
    }, [status, session]);

    // Fetch sections and subjects helper for HOD/Admin
    const fetchSectionsAndSubjects = async (deptId: string, yr: string, sem: string) => {
        try {
            const secRes = await fetch(`/api/sections?departmentId=${deptId}`);
            if (secRes.ok) setSections(await secRes.json());

            if (yr && sem) {
                const subParams = new URLSearchParams({
                    departmentId: deptId,
                    year: yr,
                    semester: sem,
                    excludeElectives: "false" // We want all subjects including electives
                });
                const subRes = await fetch(`/api/subjects?${subParams}`);
                if (subRes.ok) setSubjects(await subRes.json());
            } else {
                setSubjects([]);
            }
        } catch (e) {
            console.error("Error fetching sections/subjects:", e);
        }
    };

    // Refetch when HOD/Admin filters change
    useEffect(() => {
        if (!isFaculty && departmentId) {
            fetchSectionsAndSubjects(departmentId, year, semester);
        }
    }, [departmentId, year, semester]);

    // Handle Faculty Mapping selection changes
    const handleFacultyMappingChange = (mappingId: string) => {
        setSelectedMappingId(mappingId);
        const selected = facultyMappings.find(m => m.id === mappingId);
        if (selected) {
            setSubjectId(selected.subjectId);
            setSectionId(selected.sectionId);
        }
    };

    // Load statistics based on selected subject and section
    const loadStatistics = async () => {
        if (!subjectId || !sectionId) return;
        setStatsLoading(true);
        setStats(null);
        setExpandedLogs({});
        try {
            const params = new URLSearchParams({
                subjectId,
                sectionId,
                academicYearId
            });
            const res = await fetch(`/api/faculty/attendance-stats?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error("Error loading stats:", e);
        } finally {
            setStatsLoading(false);
        }
    };

    // Load statistics when final query criteria are met
    useEffect(() => {
        if (subjectId && sectionId && academicYearId) {
            loadStatistics();
        }
    }, [subjectId, sectionId, academicYearId]);

    // Log expander toggle
    const toggleLogExpansion = (id: string) => {
        setExpandedLogs(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Start inline teaching diary editing
    const startEditingDiary = (log: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingLogId(log.id);
        setEditingTopic(log.topicsTaught || "");
    };

    // Save inline teaching diary edit
    const saveDiaryEdit = async (logId: string) => {
        setSavingDiary(true);
        try {
            const res = await fetch("/api/teaching-diary", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: logId,
                    topicsTaught: editingTopic
                })
            });

            if (res.ok) {
                // Refresh local stats data
                if (stats) {
                    const updatedLogs = stats.dailyLogs.map((log: any) => {
                        if (log.id === logId) {
                            return { ...log, topicsTaught: editingTopic };
                        }
                        return log;
                    });
                    setStats({
                        ...stats,
                        dailyLogs: updatedLogs
                    });
                }
                setEditingLogId(null);
            } else {
                alert("Failed to update teaching diary entry.");
            }
        } catch (e) {
            console.error("Error saving diary edit:", e);
        } finally {
            setSavingDiary(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <LogoSpinner fullScreen={false} />
            </div>
        );
    }

    // Filter students at risk based on configurable threshold
    const atRiskStudents = stats?.studentsStats?.filter((s: any) => s.rate < detentionThreshold) || [];

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Header Navigation */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <button
                            onClick={() => router.push(isFaculty ? "/faculty" : "/dashboard")}
                            className="group mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                            Back to Dashboard
                        </button>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl flex items-center gap-3">
                            <FaChartLine className="text-indigo-600" />
                            Attendance Analytics
                        </h1>
                        <p className="mt-1 text-slate-500 text-sm sm:text-base">
                            Monitor student attendance records, trends, detention lists, and teaching logs.
                        </p>
                    </div>
                </div>

                {/* Filters Board Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg border-b border-slate-100 pb-3 mb-4">
                        <FaFilter className="text-slate-400" /> Filter Criteria
                    </h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6 items-end">
                        {/* Academic Year Selection (Visible to all) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Academic Year</label>
                            <select
                                value={academicYearId}
                                onChange={(e) => setAcademicYearId(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 font-medium"
                            >
                                {academicYears.map(ay => (
                                    <option key={ay.id} value={ay.id}>{ay.name} {ay.isCurrent ? "(Current)" : ""}</option>
                                ))}
                            </select>
                        </div>

                        {/* Faculty Mode: Single Dropdown for mappings */}
                        {isFaculty ? (
                            <div className="col-span-1 md:col-span-2 lg:col-span-5">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Assigned Course / Section</label>
                                <select
                                    value={selectedMappingId}
                                    onChange={(e) => handleFacultyMappingChange(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 font-semibold"
                                >
                                    {facultyMappings.length === 0 ? (
                                        <option value="">No subjects mapped</option>
                                    ) : (
                                        facultyMappings.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.subject?.name} ({m.subject?.code}) — Section {m.section?.name} [Yr {m.subject?.year} Sem {m.subject?.semester}]
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        ) : (
                            /* Admin & HOD Mode: Multi-dropdowns */
                            <>
                                {/* Department Dropdown */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Department</label>
                                    <select
                                        disabled={isHOD}
                                        value={departmentId}
                                        onChange={(e) => {
                                            setDepartmentId(e.target.value);
                                            setSectionId("");
                                            setSubjectId("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 disabled:opacity-75 disabled:cursor-not-allowed font-medium"
                                    >
                                        <option value="">Select Dept</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Year Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                                    <select
                                        value={year}
                                        onChange={(e) => {
                                            setYear(e.target.value);
                                            setSubjectId("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 font-medium"
                                    >
                                        <option value="">Select</option>
                                        <option value="1">I Year</option>
                                        <option value="2">II Year</option>
                                        <option value="3">III Year</option>
                                        <option value="4">IV Year</option>
                                    </select>
                                </div>

                                {/* Semester Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semester</label>
                                    <select
                                        value={semester}
                                        onChange={(e) => {
                                            setSemester(e.target.value);
                                            setSubjectId("");
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 font-medium"
                                    >
                                        <option value="">Select</option>
                                        <option value="1">1st Semester</option>
                                        <option value="2">2nd Semester</option>
                                    </select>
                                </div>

                                {/* Section Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Section</label>
                                    <select
                                        disabled={!departmentId}
                                        value={sectionId}
                                        onChange={(e) => setSectionId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 font-medium"
                                    >
                                        <option value="">Select Section</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>Section {s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subject Selection */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                    <select
                                        disabled={!departmentId || !year || !semester}
                                        value={subjectId}
                                        onChange={(e) => setSubjectId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 text-slate-700 font-medium"
                                    >
                                        <option value="">Select Subject</option>
                                        {subjects.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                {statsLoading ? (
                    <div className="flex h-96 items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <LogoSpinner fullScreen={false} />
                    </div>
                ) : !stats ? (
                    <div className="flex flex-col items-center justify-center h-96 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-400 gap-4 p-8 text-center">
                        <FaChartLine size={48} className="opacity-20 text-indigo-600" />
                        <h3 className="font-bold text-slate-700 text-lg">No Statistics Loaded</h3>
                        <p className="text-sm max-w-md text-slate-400">
                            Please select a valid subject and section from the filters above to retrieve real-time attendance analytics.
                        </p>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Faculty Details Card */}
                        {stats.mappedFaculty && stats.mappedFaculty.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-center gap-6">
                                <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-slate-50 shadow-md flex items-center justify-center bg-slate-100 shrink-0">
                                    {stats.mappedFaculty[0].photoUrl ? (
                                        <img
                                            src={stats.mappedFaculty[0].photoUrl}
                                            alt={stats.mappedFaculty[0].name}
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(stats.mappedFaculty[0].name)}&background=f1f5f9&color=6366f1`;
                                            }}
                                        />
                                    ) : (
                                        <FaUserTie className="h-10 w-10 text-slate-400" />
                                    )}
                                </div>
                                <div className="text-center sm:text-left">
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                        Assigned Faculty
                                    </span>
                                    <h2 className="text-xl font-extrabold text-slate-900 mt-1">{stats.mappedFaculty[0].name}</h2>
                                    <p className="text-sm font-medium text-slate-500 font-mono mt-0.5">
                                        {stats.mappedFaculty[0].designation || "Faculty Member"} • {stats.mappedFaculty[0].empCode}
                                    </p>
                                </div>
                                {stats.mappedFaculty.length > 1 && (
                                    <div className="sm:ml-auto flex items-center gap-2">
                                        <span className="text-xs text-slate-400 font-semibold">Additional faculty:</span>
                                        <div className="flex -space-x-2">
                                            {stats.mappedFaculty.slice(1).map((fac: any, idx: number) => (
                                                <div
                                                    key={fac.empCode || idx}
                                                    title={`${fac.name} (${fac.empCode})`}
                                                    className="h-8 w-8 rounded-full border-2 border-white bg-slate-150 flex items-center justify-center text-xs font-bold text-slate-700 overflow-hidden"
                                                >
                                                    {fac.photoUrl ? (
                                                        <img
                                                            src={fac.photoUrl}
                                                            alt={fac.name}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fac.name)}&background=f1f5f9&color=6366f1`;
                                                            }}
                                                        />
                                                    ) : (
                                                        fac.name.charAt(0)
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Overall Analytics Summary Cards & detention config */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                            {/* Attendance Rate Circle Card */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Avg Attendance</span>
                                    <h2 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.overallAttendanceRate}%</h2>
                                    <span className="text-xs text-slate-400 block mt-1">Across all logged classes</span>
                                </div>
                                <div className="relative h-20 w-20 flex items-center justify-center">
                                    {/* SVG Circular Progress Ring */}
                                    <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                                        <path
                                            className="text-slate-100"
                                            strokeWidth="3.5"
                                            stroke="currentColor"
                                            fill="none"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                        <path
                                            className={`${stats.overallAttendanceRate >= 75 ? "text-indigo-600" : "text-amber-500"}`}
                                            strokeWidth="3.5"
                                            strokeDasharray={`${stats.overallAttendanceRate}, 100`}
                                            strokeLinecap="round"
                                            stroke="currentColor"
                                            fill="none"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                    <span className="absolute text-sm font-bold text-slate-700">{stats.overallAttendanceRate}%</span>
                                </div>
                            </div>

                            {/* Classes Conducted Card */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Sessions Held</span>
                                    <h2 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.totalSessions}</h2>
                                    <span className="text-xs text-slate-400 block mt-1">Total periods recorded</span>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                    <FaCheckCircle size={22} />
                                </div>
                            </div>

                            {/* Detention Risk Card */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Detention Risk</span>
                                    <h2 className="text-3xl font-extrabold text-rose-600 mt-1">{atRiskStudents.length}</h2>
                                    <span className="text-xs text-slate-400 block mt-1">Students below {detentionThreshold}%</span>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                    <FaExclamationTriangle size={22} className={atRiskStudents.length > 0 ? "animate-bounce" : ""} />
                                </div>
                            </div>

                            {/* Configurable Detention Threshold Settings Slider */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Detention Limit Config</span>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-lg font-bold text-slate-800">{detentionThreshold}% Limit</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="50"
                                        max="90"
                                        value={detentionThreshold}
                                        onChange={(e) => setDetentionThreshold(Number(e.target.value))}
                                        className="w-full accent-indigo-600 mt-3 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-1">Updates indicators in real-time</span>
                            </div>
                        </div>

                        {/* Chart Analysis Section */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                    <FaChartLine className="text-indigo-500" /> Attendance Trends & Patterns
                                </h3>
                                <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
                                    <button
                                        onClick={() => setChartTab("trend")}
                                        className={`px-3 py-1.5 rounded-md transition-colors ${chartTab === "trend" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                    >
                                        Session-wise Trend
                                    </button>
                                    <button
                                        onClick={() => setChartTab("dayOfWeek")}
                                        className={`px-3 py-1.5 rounded-md transition-colors ${chartTab === "dayOfWeek" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                                    >
                                        Day-of-Week Averages
                                    </button>
                                </div>
                            </div>

                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartTab === "trend" ? (
                                        <LineChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                                                labelStyle={{ fontWeight: "bold", color: "#1e293b", fontSize: "12px" }}
                                                itemStyle={{ color: "#4f46e5", fontSize: "12px" }}
                                                formatter={(value) => [`${value}% Attendance`]}
                                            />
                                            <ReferenceLine y={detentionThreshold} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: `${detentionThreshold}% Limit`, fill: "#f43f5e", fontSize: 10, position: "top" }} />
                                            <Line type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={3} dot={{ stroke: "#4f46e5", strokeWidth: 1, r: 3 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    ) : (
                                        <BarChart data={stats.dayOfWeekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} stroke="#cbd5e1" />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                                                itemStyle={{ color: "#06b6d4", fontSize: "12px" }}
                                                formatter={(value) => [`${value}% Avg`]}
                                            />
                                            <Bar dataKey="rate" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Grid: Low Attendance Alert & Daily logs list */}
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
                            {/* Low Attendance Student Alerts Panel */}
                            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <FaUserGraduate className="text-rose-500" />
                                        Detention Risk Alerts
                                    </h3>
                                    <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                                        {atRiskStudents.length} Students
                                    </span>
                                </div>

                                <div className="overflow-y-auto max-h-[500px] p-4 space-y-2">
                                    {atRiskStudents.length === 0 ? (
                                        <div className="flex h-32 flex-col items-center justify-center text-slate-400 gap-2">
                                            <FaCheckCircle className="text-2xl text-emerald-500" />
                                            <span className="text-sm font-semibold text-slate-600">All students safe!</span>
                                            <span className="text-xs text-slate-400">Everyone is above the {detentionThreshold}% mark.</span>
                                        </div>
                                    ) : (
                                        atRiskStudents.map((s: any) => (
                                            <div
                                                key={s.rollNumber}
                                                className="flex items-center justify-between rounded-xl border border-slate-150 p-3 bg-rose-50/10 hover:bg-slate-50 transition-colors"
                                            >
                                                <div>
                                                    <p className="font-mono text-xs font-bold text-slate-600">{s.rollNumber}</p>
                                                    <p className="text-sm font-medium text-slate-900">{s.name}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-bold text-rose-600">{s.rate}%</span>
                                                    <p className="text-[10px] text-slate-400">{s.present} of {s.total} classes</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Daily Sessions Log with expanders */}
                            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <FaCalendarAlt className="text-indigo-500" />
                                        Daily Session Logs & Teaching Diary
                                    </h3>
                                </div>

                                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                    {stats.dailyLogs.length === 0 ? (
                                        <div className="flex h-32 items-center justify-center text-slate-400">
                                            No session logs recorded.
                                        </div>
                                    ) : (
                                        stats.dailyLogs.map((log: any) => {
                                            const isExpanded = !!expandedLogs[log.id];
                                            const isEditing = editingLogId === log.id;

                                            return (
                                                <div key={log.id} className="p-4 hover:bg-slate-50/30 transition-colors">
                                                    {/* Row Summary */}
                                                    <div
                                                        onClick={() => toggleLogExpansion(log.id)}
                                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                                                <FaCalendarAlt className="text-blue-500" size={10} />
                                                                {log.date}
                                                            </span>
                                                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                                                <FaClock className="text-emerald-500" size={10} />
                                                                P{log.periodName}
                                                            </span>
                                                            {log.topicsTaught ? (
                                                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                                                                    Completed
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase animate-pulse">
                                                                    Pending
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right text-xs">
                                                                <span className="font-semibold text-slate-700">{log.presentCount} Present</span>
                                                                <span className="text-slate-400 mx-1.5">•</span>
                                                                <span className="text-rose-600 font-semibold">{log.absentCount} Absent</span>
                                                            </div>
                                                            <div className={`px-2 py-0.5 rounded text-xs font-bold text-white ${log.attendanceRate >= 75 ? "bg-emerald-500" : "bg-amber-500"}`}>
                                                                {log.attendanceRate}%
                                                            </div>
                                                            {isExpanded ? <FaChevronUp className="text-slate-400" /> : <FaChevronDown className="text-slate-400" />}
                                                        </div>
                                                    </div>

                                                    {/* Expanded Content Details */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: "auto" }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                className="overflow-hidden mt-4 pt-4 border-t border-slate-100 space-y-4"
                                                            >
                                                                {/* Teaching Diary Box */}
                                                                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                                            <FaBookOpen className="text-indigo-500" /> Teaching Diary Topic
                                                                        </span>
                                                                        {!isEditing && (
                                                                            <button
                                                                                onClick={(e) => startEditingDiary(log, e)}
                                                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                                                            >
                                                                                <FaEdit size={12} />
                                                                                {log.topicsTaught ? "Edit Topic" : "Fill Topic"}
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {isEditing ? (
                                                                        <div className="space-y-2">
                                                                            <textarea
                                                                                value={editingTopic}
                                                                                onChange={(e) => setEditingTopic(e.target.value)}
                                                                                rows={3}
                                                                                placeholder="Enter the topics taught during this period..."
                                                                                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 bg-white"
                                                                            />
                                                                            <div className="flex justify-end gap-2">
                                                                                <button
                                                                                    onClick={() => setEditingLogId(null)}
                                                                                    disabled={savingDiary}
                                                                                    className="px-3 py-1 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                                                                                >
                                                                                    <FaTimes size={10} /> Cancel
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => saveDiaryEdit(log.id)}
                                                                                    disabled={savingDiary || !editingTopic.trim()}
                                                                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:bg-slate-300"
                                                                                >
                                                                                    <FaSave size={10} /> {savingDiary ? "Saving..." : "Save"}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : log.topicsTaught ? (
                                                                        <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{log.topicsTaught}</p>
                                                                    ) : (
                                                                        <p className="text-xs text-amber-700 font-bold bg-amber-50 rounded-lg p-2 flex items-center gap-1.5">
                                                                            <FaExclamationTriangle className="animate-pulse" />
                                                                            Diary entry is currently missing for this session.
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Absentees List */}
                                                                <div>
                                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                                                                        Absentees ({log.absentees.length})
                                                                    </span>
                                                                    {log.absentees.length === 0 ? (
                                                                        <p className="text-xs text-emerald-600 font-bold bg-emerald-50 rounded-lg p-2">
                                                                            Awesome! 100% attendance, no absentees for this period.
                                                                        </p>
                                                                    ) : (
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {log.absentees.map((std: any) => (
                                                                                <span
                                                                                    key={std.rollNumber}
                                                                                    title={std.name}
                                                                                    className="text-[10px] font-bold bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-1 rounded-md"
                                                                                >
                                                                                    {std.rollNumber}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
