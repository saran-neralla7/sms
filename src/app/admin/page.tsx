"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaUsers,
    FaBuilding,
    FaLayerGroup,
    FaClock,
    FaGavel,
    FaUserGraduate,
    FaBook,
    FaCalendarCheck,
    FaArrowLeft,
    FaCalendarAlt,
    FaGraduationCap,
    FaKey,
    FaMobileAlt,
    FaSms,
    FaFileAlt,
    FaHistory,
    FaChartLine,
    FaBirthdayCake,
    FaAward,
    FaDatabase,
    FaSync
} from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [backupStatus, setBackupStatus] = useState<any>(null);
    const [backingUp, setBackingUp] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<number>(0);
    const [dismissBanner, setDismissBanner] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [liveLogs, setLiveLogs] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(true);

    const [popupEnabled, setPopupEnabled] = useState(true);
    const [togglingPopup, setTogglingPopup] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetch("/api/system/announcement-settings")
            .then(res => res.json())
            .then(data => {
                if (typeof data.enabled === "boolean") setPopupEnabled(data.enabled);
            })
            .catch(console.error);
    }, []);

    const handleTogglePopup = async () => {
        try {
            setTogglingPopup(true);
            const next = !popupEnabled;
            const res = await fetch("/api/system/announcement-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: next })
            });
            const data = await res.json();
            if (data.success) {
                setPopupEnabled(data.enabled);
            }
        } catch (err) {
            console.error("Failed to toggle popup:", err);
        } finally {
            setTogglingPopup(false);
        }
    };

    const handlePreviewPopup = () => {
        window.dispatchEvent(new CustomEvent("preview_gvpihlr_popup"));
    };

    const handleManualBackup = async () => {
        try {
            setBackingUp(true);
            const res = await fetch("/api/system/trigger-backup", { method: "POST" });
            const data = await res.json();
            if (data.backupStatus) setBackupStatus(data.backupStatus);
        } catch (err) {
            console.error("Manual backup error:", err);
        } finally {
            setBackingUp(false);
        }
    };

    const [birthdayType, setBirthdayType] = useState<"upcoming" | "thisMonth" | "month">("upcoming");
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [birthdayTab, setBirthdayTab] = useState<"faculty" | "student">("faculty");
    const [birthdaysData, setBirthdaysData] = useState<{ upcoming: any[], thisMonth: any[], birthdays?: any[] }>({ upcoming: [], thisMonth: [] });
    const [birthdaysLoading, setBirthdaysLoading] = useState(true);

    const [anniversaryType, setAnniversaryType] = useState<"upcoming" | "thisMonth" | "month">("upcoming");
    const [anniversarySelectedMonth, setAnniversarySelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [anniversariesData, setAnniversariesData] = useState<{ upcoming: any[], thisMonth: any[], anniversaries?: any[] }>({ upcoming: [], thisMonth: [] });
    const [anniversariesLoading, setAnniversariesLoading] = useState(true);

    useEffect(() => {
        if (status !== "authenticated" || !session?.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) return;

        const fetchLiveLogs = async () => {
            try {
                const res = await fetch("/api/audit-logs?limit=5");
                if (res.ok) {
                    const data = await res.json();
                    setLiveLogs(data.data || []);
                }
            } catch (err) {
                console.error("Live logs error:", err);
            } finally {
                setLogsLoading(false);
            }
        };

        fetchLiveLogs();
        const interval = setInterval(fetchLiveLogs, 7000);
        return () => clearInterval(interval);
    }, [status, session]);

    useEffect(() => {
        if (status !== "authenticated" || !session?.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) return;

        const fetchBirthdays = async () => {
            try {
                setBirthdaysLoading(true);
                let url = "/api/admin/birthdays";
                if (birthdayType === "month") {
                    url += `?month=${selectedMonth}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (birthdayType === "month") {
                        setBirthdaysData(prev => ({ ...prev, birthdays: data.birthdays }));
                    } else {
                        setBirthdaysData(data);
                    }
                }
            } catch (err) {
                console.error("Birthdays fetch error:", err);
            } finally {
                setBirthdaysLoading(false);
            }
        };

        fetchBirthdays();
    }, [status, session, birthdayType, selectedMonth]);

    useEffect(() => {
        if (status !== "authenticated" || !session?.user || !["ADMIN", "DIRECTOR"].includes((session.user as any).role)) return;

        const fetchAnniversaries = async () => {
            try {
                setAnniversariesLoading(true);
                let url = "/api/admin/work-anniversaries";
                if (anniversaryType === "month") {
                    url += `?month=${anniversarySelectedMonth}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (anniversaryType === "month") {
                        setAnniversariesData(prev => ({ ...prev, anniversaries: data.anniversaries }));
                    } else {
                        setAnniversariesData(data);
                    }
                }
            } catch (err) {
                console.error("Work anniversaries fetch error:", err);
            } finally {
                setAnniversariesLoading(false);
            }
        };

        fetchAnniversaries();
    }, [status, session, anniversaryType, anniversarySelectedMonth]);

    useEffect(() => {
        setMounted(true);
        if (status === "authenticated" && session?.user && ["ADMIN", "DIRECTOR"].includes((session.user as any).role)) {
            fetch("/api/system/backup-status")
                .then(res => res.json())
                .then(data => {
                    if (!data.error && data.status) setBackupStatus(data);
                })
                .catch(console.error);

            fetch("/api/auth/forgot-password/pending")
                .then(res => res.json())
                .then(data => {
                    if (data.count !== undefined) setPendingRequests(data.count);
                })
                .catch(console.error);
        }
    }, [status, session]);

    if (status === "loading") {
        return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
    }

    const modules = [
        {
            title: "Academic Years",
            icon: <FaCalendarAlt className="h-6 w-6" />,
            description: "Manage academic years and active sessions.",
            href: "/admin/academic-years",
            color: "bg-emerald-50 text-emerald-600"
        },
        {
            title: "Academic Calendar",
            icon: <FaCalendarCheck className="h-6 w-6" />,
            description: "Configure manual holidays and semester milestones.",
            href: "/admin/academic-calendar",
            color: "bg-rose-50 text-rose-600"
        },
        {
            title: "Batches",
            icon: <FaGraduationCap className="h-6 w-6" />,
            description: "Manage student batches (e.g., 2024-2028).",
            href: "/admin/batches",
            color: "bg-violet-50 text-violet-600"
        },
        {
            title: "Lab Batches",
            icon: <FaLayerGroup className="h-6 w-6" />,
            description: "Manage practical/lab batches per section.",
            href: "/admin/batches/lab",
            color: "bg-fuchsia-50 text-fuchsia-600"
        },
        {
            title: "Password Requests",
            icon: <FaKey className="h-6 w-6" />,
            description: "Manage user password reset requests.",
            href: "/admin/requests",
            color: "bg-orange-50 text-orange-600",
            badge: pendingRequests > 0 ? (
                <div className="absolute right-4 top-4">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
                        {pendingRequests > 99 ? "99+" : pendingRequests}
                    </span>
                </div>
            ) : undefined
        },
        {
            title: "Users",
            icon: <FaUsers className="h-6 w-6" />,
            description: "Manage system users and access roles.",
            href: "/admin/users",
            color: "bg-blue-50 text-blue-600"
        },
        {
            title: "Departments",
            icon: <FaBuilding className="h-6 w-6" />,
            description: "Manage academic departments.",
            href: "/admin/departments",
            color: "bg-indigo-50 text-indigo-600"
        },
        {
            title: "Sections",
            icon: <FaLayerGroup className="h-6 w-6" />,
            description: "Manage class sections and intakes.",
            href: "/admin/sections",
            color: "bg-purple-50 text-purple-600"
        },
        {
            title: "Periods",
            icon: <FaClock className="h-6 w-6" />,
            description: "Define class periods and timings.",
            href: "/admin/periods",
            color: "bg-pink-50 text-pink-600"
        },
        {
            title: "Regulations",
            icon: <FaGavel className="h-6 w-6" />,
            description: "Manage course regulations (e.g., R15, R19).",
            href: "/admin/regulations",
            color: "bg-orange-50 text-orange-600"
        },
        {
            title: "Promote Students",
            icon: <FaUserGraduate className="h-6 w-6" />,
            description: "Promote students to next year/semester.",
            href: "/admin/promote",
            color: "bg-teal-50 text-teal-600"
        },
        {
            title: "Alumni",
            icon: <FaUserGraduate className="h-6 w-6" />, // Using generic grad icon or custom
            description: "View and manage alumni records.",
            href: "/admin/alumni",
            color: "bg-slate-50 text-slate-600"
        },
        {
            title: "Elective Slots",
            icon: <FaBook className="h-6 w-6" />,
            description: "Configure elective subject slots.",
            href: "/admin/elective-slots",
            color: "bg-green-50 text-green-600"
        },
        {
            title: "Elective Enrollment",
            icon: <FaCalendarCheck className="h-6 w-6" />,
            description: "Manage student elective choices.",
            href: "/admin/electives",
            color: "bg-cyan-50 text-cyan-600"
        },
        {
            title: "OE Batch Division",
            icon: <FaLayerGroup className="h-6 w-6" />,
            description: "Divide open elective students into batches for faculty.",
            href: "/admin/electives/batches",
            color: "bg-indigo-50 text-indigo-600"
        },
        {
            title: "SMS Logs",
            icon: <FaSms className="h-6 w-6" />,
            description: "View and audit all sent SMS messages.",
            href: "/admin/sms-logs",
            color: "bg-purple-50 text-purple-600"
        },
        {
            title: "SMS Tester",
            icon: <FaMobileAlt className="h-6 w-6" />,
            description: "Test PlatinumSMS API configurations.",
            href: "/admin/sms-test",
            color: "bg-emerald-50 text-emerald-600"
        },
        {
            title: "Broadcast Notifications",
            icon: <FaMobileAlt className="h-6 w-6" />,
            description: "Send push & in-app notifications filtered by role, department & batch.",
            href: "/admin/notifications",
            color: "bg-indigo-50 text-indigo-600"
        },
        {
            title: "Faculty Mapping",
            icon: <FaUsers className="h-6 w-6" />,
            description: "Map faculty to subjects for attendance and feedback.",
            href: "/admin/faculty-mapping",
            color: "bg-blue-50 text-blue-600"
        },
        {
            title: "Feedback Templates",
            icon: <FaLayerGroup className="h-6 w-6" />,
            description: "Define templates and questions for student feedback.",
            href: "/admin/feedback/templates",
            color: "bg-violet-50 text-violet-600"
        },
        {
            title: "Feedback Windows",
            icon: <FaCalendarCheck className="h-6 w-6" />,
            description: "Manage feedback collection windows and analytics.",
            href: "/admin/feedback/windows",
            color: "bg-fuchsia-50 text-fuchsia-600"
        },
        {
            title: "Feedback Analysis",
            icon: <FaFileAlt className="h-6 w-6" />,
            description: "Generate detailed feedback reports and matrices.",
            href: "/admin/feedback/analysis",
            color: "bg-rose-50 text-rose-600"
        },
        {
            title: "Exam Applications",
            icon: <FaFileAlt className="h-6 w-6" />,
            description: "Configure exam dates, create office accounts, and view statistics.",
            href: "/admin/exam-applications",
            color: "bg-amber-50 text-amber-600"
        },
        {
            title: "Internal Marks",
            icon: <FaBook className="h-6 w-6" />,
            description: "Bulk upload internal marks via Excel templates.",
            href: "/admin/internal-marks",
            color: "bg-red-50 text-red-600"
        },
        {
            title: "MID Exam Engine",
            icon: <FaBook className="h-6 w-6" />,
            description: "OBE-ready Mid examinations & marks evaluation control panel.",
            href: "/admin/mid-exam",
            color: "bg-blue-50 text-blue-600"
        },
        {
            title: "Batch Rollup & Gap Analysis",
            icon: <FaChartLine className="h-6 w-6" />,
            description: "Calculate direct/indirect attainment and analyze program gaps.",
            href: "/admin/course-files/rollup",
            color: "bg-indigo-50 text-indigo-600"
        },
        {
            title: "Syllabus Analytics",
            icon: <FaChartLine className="h-6 w-6" />,
            description: "Track unit-wise syllabus completion rates and diaries.",
            href: "/faculty/syllabus-analytics",
            color: "bg-teal-50 text-teal-600"
        },
        {
            title: "Certificates",
            icon: <FaFileAlt className="h-6 w-6" />,
            description: "Generate and manage Transfer Certificates.",
            href: "/admin/certificates",
            color: "bg-orange-50 text-orange-600"
        },
        {
            title: "System Audit Logs",
            icon: <FaHistory className="h-6 w-6" />,
            description: "Track all critical actions performed by users.",
            href: "/admin/logs",
            color: "bg-slate-50 text-slate-600"
        },
        {
            title: "System Backup & Sync",
            icon: <FaDatabase className="h-6 w-6" />,
            description: "Trigger manual database & photo backups to Google Drive.",
            href: "/admin/system/backup",
            color: "bg-blue-50 text-blue-600"
        }
    ];

    const isBSH = session?.user?.role === "HOD" && (session?.user?.username === "hodbsh" || session?.user?.username === "hod-bsh");
    const visibleModules = isBSH 
        ? modules.filter(m => ["Batches", "Sections", "Faculty Mapping", "Feedback Analysis", "MID Exam Engine"].includes(m.title))
        : modules;

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">

                {/* Backup Status Banner */}
                {mounted && (
                    <AnimatePresence mode="wait">
                        {!dismissBanner && backupStatus && backupStatus.status !== "unknown" && (
                            <motion.div
                                key="backup-banner-admin"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                className="mb-6 overflow-hidden"
                            >
                                <div className={`relative flex items-center justify-between rounded-xl border p-4 shadow-sm ${backupStatus.status === "success"
                                    ? "border-green-200 bg-green-50 text-green-800"
                                    : "border-red-200 bg-red-50 text-red-800"
                                    }`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60">
                                            {backupStatus.status === "success" ? "✅" : "⚠️"}
                                        </span>
                                        <div>
                                            <p className="font-semibold">
                                                {backupStatus.status === "success" ? "System Auto-Sync Successful" : "System Auto-Sync Failed"}
                                            </p>
                                            <p className="text-sm opacity-90">
                                                {backupStatus.message}
                                                {backupStatus.timestamp && ` • ${new Date(backupStatus.timestamp).toLocaleString()}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 absolute sm:static top-2 right-2 sm:top-auto sm:right-auto">
                                        <button
                                            onClick={handleManualBackup}
                                            disabled={backingUp}
                                            className="flex items-center gap-1.5 rounded-lg bg-white/90 border border-slate-200/60 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-white active:scale-95 transition-all disabled:opacity-50"
                                            title="Run Full System Backup Now"
                                        >
                                            <FaSync className={backingUp ? "animate-spin" : ""} size={12} />
                                            {backingUp ? "Backing up..." : "Backup Now"}
                                        </button>
                                        <button
                                            onClick={() => setDismissBanner(true)}
                                            className="rounded-lg p-2 hover:bg-black/5 transition-colors"
                                            title="Dismiss"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}

                {/* Header with University Celebration Popup Control */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl bg-white p-5 sm:p-6 border border-slate-200/90 shadow-sm"
                >
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                            Administration
                        </h1>
                        <p className="mt-1 text-sm sm:text-base text-slate-600">
                            Configure system settings and manage academic structures.
                        </p>
                    </div>

                    {/* Announcement Popup Quick Toggle */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl">🎓</span>
                            <div>
                                <div className="text-xs font-bold text-slate-800">
                                    GVPIHLR Celebration Popup
                                </div>
                                <div className="text-[11px] font-medium text-slate-500">
                                    {popupEnabled ? "Active on every user login" : "Turned off"}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleTogglePopup}
                                disabled={togglingPopup}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${popupEnabled ? "bg-amber-500" : "bg-slate-300"}`}
                                title={popupEnabled ? "Click to disable popup" : "Click to enable popup"}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${popupEnabled ? "translate-x-6" : "translate-x-1"}`}
                                />
                            </button>

                            <button
                                onClick={handlePreviewPopup}
                                className="px-3 py-1.5 text-xs font-extrabold rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all shadow-sm"
                            >
                                Preview Popup 🎉
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence>
                        {visibleModules.map((module, index) => (
                            <motion.div
                                key={module.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <DashboardCard
                                    title={module.title}
                                    icon={module.icon}
                                    description={module.description}
                                    href={module.href}
                                    colorClass={module.color}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Birthday Celebrations Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mt-12 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
                                <FaBirthdayCake className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-slate-900">Birthday Celebrations</h3>
                                    <button
                                        onClick={() => router.push("/admin/birthdays")}
                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 ml-2"
                                    >
                                        View All Birthdays →
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">Celebrate faculty and student milestones</p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Filter Buttons */}
                            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                <button
                                    onClick={() => setBirthdayType("upcoming")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        birthdayType === "upcoming"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Upcoming
                                </button>
                                <button
                                    onClick={() => setBirthdayType("thisMonth")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        birthdayType === "thisMonth"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => setBirthdayType("month")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        birthdayType === "month"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    By Month
                                </button>
                            </div>

                            {/* Month Select Dropdown (Visible only when 'month' filter selected) */}
                            {birthdayType === "month" && (
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {/* Student / Faculty Tabs */}
                            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                <button
                                    onClick={() => setBirthdayTab("faculty")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        birthdayTab === "faculty"
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Faculty
                                </button>
                                <button
                                    onClick={() => setBirthdayTab("student")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        birthdayTab === "student"
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Students
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Row */}
                    <div className="w-full">
                        {birthdaysLoading ? (
                            <div className="py-12 text-center text-sm text-slate-500">Loading birthdays...</div>
                        ) : (() => {
                            const activeBirthdaysList = (
                                birthdayType === "upcoming"
                                    ? birthdaysData.upcoming
                                    : birthdayType === "thisMonth"
                                    ? birthdaysData.thisMonth
                                    : birthdaysData.birthdays || []
                            ).filter((b: any) => b.type === birthdayTab);

                            if (activeBirthdaysList.length === 0) {
                                return (
                                    <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        No {birthdayTab === "faculty" ? "faculty" : "student"} birthdays found {
                                            birthdayType === "upcoming"
                                                ? "coming up"
                                                : birthdayType === "thisMonth"
                                                ? "in this month"
                                                : `in ${new Date(2000, selectedMonth - 1, 1).toLocaleString("en-US", { month: "long" })}`
                                        }.
                                    </div>
                                );
                            }

                            return (
                                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                    {activeBirthdaysList.map((b: any) => {
                                        const isToday = b.daysUntil === 0 || b.daysUntil === 365 || (b.birthMonth === (new Date().getMonth() + 1) && b.birthDay === new Date().getDate());
                                        const fallbackAvatar = b.type === 'faculty'
                                            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name)}&background=f1f5f9&color=6366f1`
                                            : `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name)}&background=f1f5f9&color=0284c7`;
                                        const photoSrc = b.photoUrl ? b.photoUrl : fallbackAvatar;

                                        return (
                                            <motion.div
                                                key={b.id}
                                                whileHover={{ y: -4, scale: 1.02 }}
                                                className={`relative flex flex-col items-center justify-between rounded-xl border p-4 bg-white min-w-[200px] max-w-[200px] shadow-sm select-none shrink-0 transition-all ${
                                                    isToday ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10' : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {isToday && (
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-10 animate-bounce">
                                                        Today 🎂
                                                    </div>
                                                )}

                                                <div className="relative flex h-16 w-16 items-center justify-center rounded-full overflow-hidden border border-slate-100 bg-slate-50 mb-3 shrink-0">
                                                    <img
                                                        src={photoSrc}
                                                        alt={b.name}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = fallbackAvatar;
                                                        }}
                                                    />
                                                </div>

                                                <div className="text-center w-full">
                                                    <p className="font-bold text-sm text-slate-800 line-clamp-1" title={b.name}>
                                                        {b.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                                                        {b.designation}
                                                    </p>
                                                    <p className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-1">
                                                        {b.deptCode}
                                                    </p>
                                                </div>

                                                <div className="mt-3 pt-2 border-t border-slate-100 w-full text-center">
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {new Date(b.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-400 mt-0.5">
                                                        {isToday ? "Happy Birthday!" : b.daysUntil === 1 ? "Tomorrow" : `In ${b.daysUntil} days`}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </motion.div>

                {/* Work Anniversary Celebrations Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                                <FaAward className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-slate-900">Work Anniversary Celebrations</h3>
                                    <button
                                        onClick={() => router.push("/admin/work-anniversaries")}
                                        className="text-xs font-semibold text-purple-600 hover:text-purple-700 ml-2"
                                    >
                                        View All Anniversaries →
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">Celebrate faculty service milestones and joining dates</p>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Filter Buttons */}
                            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                <button
                                    onClick={() => setAnniversaryType("upcoming")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        anniversaryType === "upcoming"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Upcoming
                                </button>
                                <button
                                    onClick={() => setAnniversaryType("thisMonth")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        anniversaryType === "thisMonth"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => setAnniversaryType("month")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                        anniversaryType === "month"
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    By Month
                                </button>
                            </div>

                            {/* Month Select Dropdown */}
                            {anniversaryType === "month" && (
                                <select
                                    value={anniversarySelectedMonth}
                                    onChange={(e) => setAnniversarySelectedMonth(parseInt(e.target.value, 10))}
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-purple-500"
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>
                                            {new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Content Row */}
                    <div className="w-full">
                        {anniversariesLoading ? (
                            <div className="py-12 text-center text-sm text-slate-500">Loading work anniversaries...</div>
                        ) : (() => {
                            const activeAnniversariesList = (
                                anniversaryType === "upcoming"
                                    ? anniversariesData.upcoming
                                    : anniversaryType === "thisMonth"
                                    ? anniversariesData.thisMonth
                                    : anniversariesData.anniversaries || []
                            );

                            if (activeAnniversariesList.length === 0) {
                                return (
                                    <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        No faculty work anniversaries found {
                                            anniversaryType === "upcoming"
                                                ? "coming up"
                                                : anniversaryType === "thisMonth"
                                                ? "in this month"
                                                : `in ${new Date(2000, anniversarySelectedMonth - 1, 1).toLocaleString("en-US", { month: "long" })}`
                                        }.
                                    </div>
                                );
                            }

                            return (
                                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                    {activeAnniversariesList.map((a: any) => {
                                        const isToday = a.daysUntil === 0 || a.daysUntil === 365 || (a.joinMonth === (new Date().getMonth() + 1) && a.joinDay === new Date().getDate());
                                        const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=f3e8ff&color=7e22ce`;
                                        const photoSrc = a.photoUrl ? a.photoUrl : fallbackAvatar;
                                        const yearText = a.completedYears === 1 ? "1 Year" : `${a.completedYears} Years`;

                                        return (
                                            <motion.div
                                                key={a.id}
                                                whileHover={{ y: -4, scale: 1.02 }}
                                                className={`relative flex flex-col items-center justify-between rounded-xl border p-4 bg-white min-w-[200px] max-w-[200px] shadow-sm select-none shrink-0 transition-all ${
                                                    isToday ? 'border-purple-400 ring-2 ring-purple-400/20 bg-purple-50/20' : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            >
                                                {isToday && (
                                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-10 animate-bounce">
                                                        Today 🎖️
                                                    </div>
                                                )}

                                                <div className="relative flex h-16 w-16 items-center justify-center rounded-full overflow-hidden border border-slate-100 bg-slate-50 mb-3 shrink-0">
                                                    <img
                                                        src={photoSrc}
                                                        alt={a.name}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = fallbackAvatar;
                                                        }}
                                                    />
                                                </div>

                                                <div className="text-center w-full">
                                                    <p className="font-bold text-sm text-slate-800 line-clamp-1" title={a.name}>
                                                        {a.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                                                        {a.designation}
                                                    </p>
                                                    <div className="flex items-center justify-center gap-1 mt-1">
                                                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                                                            {a.deptCode}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 rounded-full">
                                                            🌟 {yearText}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-3 pt-2 border-t border-slate-100 w-full text-center">
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {new Date(a.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                    <span className="block text-[10px] text-slate-400 mt-0.5">
                                                        {isToday ? "Happy Work Anniversary!" : a.daysUntil === 1 ? "Tomorrow" : `In ${a.daysUntil} days`}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </motion.div>

                {/* Live System Activity Feed */}
                {!isBSH && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-12 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                    >
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                </span>
                                <h3 className="text-lg font-bold text-slate-900">Live System Activity</h3>
                            </div>
                            <button
                                onClick={() => router.push("/admin/logs")}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                            >
                                View All Logs →
                            </button>
                        </div>

                        <div className="flow-root">
                            <ul className="-mb-8">
                                {logsLoading ? (
                                    <div className="py-4 text-center text-sm text-slate-500">Loading activity...</div>
                                ) : liveLogs.length === 0 ? (
                                    <div className="py-4 text-center text-sm text-slate-500">No activity recorded yet.</div>
                                ) : (
                                    liveLogs.map((log, logIdx) => (
                                        <li key={log.id}>
                                            <div className="relative pb-8">
                                                {logIdx !== liveLogs.length - 1 ? (
                                                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                                ) : null}
                                                <div className="relative flex space-x-3">
                                                    <div>
                                                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white
                                                            ${log.action === 'CREATE' ? 'bg-green-50 text-green-600' :
                                                              log.action === 'DELETE' ? 'bg-red-50 text-red-600' :
                                                              'bg-blue-50 text-blue-600'}`}>
                                                            {log.action === 'CREATE' ? '＋' : log.action === 'DELETE' ? '✕' : '✎'}
                                                        </span>
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                                        <div>
                                                            <p className="text-sm text-slate-600">
                                                                <strong className="font-semibold text-slate-900">{log.performerName}</strong> ({log.performerRole}){' '}
                                                                <span className="text-slate-500">performed</span>{' '}
                                                                <span className="font-medium text-slate-800">{log.action}</span>{' '}
                                                                <span className="text-slate-500">on</span>{' '}
                                                                <strong className="font-semibold text-slate-900">{log.entity}</strong>{' '}
                                                                <span className="text-xs font-mono text-slate-400">({log.entityId})</span>
                                                            </p>
                                                        </div>
                                                        <div className="whitespace-nowrap text-right text-xs text-slate-500">
                                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
