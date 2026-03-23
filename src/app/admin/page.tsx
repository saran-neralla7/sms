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
    FaFileAlt
} from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [backupStatus, setBackupStatus] = useState<any>(null);
    const [pendingRequests, setPendingRequests] = useState<number>(0);
    const [dismissBanner, setDismissBanner] = useState(false);
    const [mounted, setMounted] = useState(false);

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
            title: "Exam Applications",
            icon: <FaFileAlt className="h-6 w-6" />,
            description: "Configure exam dates, create office accounts, and view statistics.",
            href: "/admin/exam-applications",
            color: "bg-amber-50 text-amber-600"
        }
    ];

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
                                    <button
                                        onClick={() => setDismissBanner(true)}
                                        className="rounded-lg p-2 hover:bg-black/5 transition-colors absolute sm:static top-2 right-2 sm:top-auto sm:right-auto"
                                        title="Dismiss"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                            Administration
                        </h1>
                        <p className="mt-2 text-lg text-slate-600">
                            Configure system settings and manage academic structures.
                        </p>
                    </div>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence>
                        {modules.map((module, index) => (
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
            </div>
        </div>
    );
}
