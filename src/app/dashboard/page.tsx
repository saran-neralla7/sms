"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUserGraduate,
  FaChalkboardTeacher,
  FaCalendarAlt,
  FaBook,
  FaPoll,
  FaFileAlt,
  FaCogs,
  FaRupeeSign
} from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import LogoSpinner from "@/components/LogoSpinner";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  const role = (session?.user?.role || "").toUpperCase();
  const isAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(role);

  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [dismissBanner, setDismissBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (status === "authenticated" && isAdmin) {
      fetch("/api/system/backup-status")
        .then(res => res.json())
        .then(data => {
          if (!data.error && data.status) setBackupStatus(data);
        })
        .catch(console.error);
    }
  }, [status, isAdmin]);

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  }

  // Define modules based on role
  let modules: any[] = [];

  if (isAdmin) {
    modules = [
      {
        title: "Students",
        icon: <FaUserGraduate className="h-6 w-6" />,
        description: "Manage student profiles, enrollments, and attendance.",
        href: "/admin/students",
        color: "bg-blue-50 text-blue-600"
      },
      {
        title: "Mark Attendance",
        icon: <FaUserGraduate className="h-6 w-6" />,
        description: "Mark student attendance (Academic).",
        href: "/attendance",
        color: "bg-red-50 text-red-600"
      },
      {
        title: "Attendance History",
        icon: <FaFileAlt className="h-6 w-6" />,
        description: "View history of marked attendance (Regular & SMS).",
        href: "/attendance/history",
        color: "bg-cyan-50 text-cyan-600"
      },
      {
        title: "Faculty",
        icon: <FaChalkboardTeacher className="h-6 w-6" />,
        description: "Manage faculty records, assignments, and workload.",
        href: "/admin/faculty",
        color: "bg-indigo-50 text-indigo-600"
      },
      {
        title: "Time Tables",
        icon: <FaCalendarAlt className="h-6 w-6" />,
        description: "Manage class schedules, periods, and academic calendar.",
        href: "/timetables",
        color: "bg-purple-50 text-purple-600"
      },
      {
        title: "Subjects",
        icon: <FaBook className="h-6 w-6" />,
        description: "Manage course catalog, electives, and curriculum.",
        href: "/admin/subjects",
        color: "bg-pink-50 text-pink-600"
      },
      {
        title: "Results",
        icon: <FaPoll className="h-6 w-6" />,
        description: "Process and view examination results and grades.",
        href: "/admin/results",
        color: "bg-orange-50 text-orange-600"
      },
      {
        title: "Reports",
        icon: <FaFileAlt className="h-6 w-6" />,
        description: "Generate attendance, performance, and analytical reports.",
        href: "/reports",
        color: "bg-teal-50 text-teal-600"
      },
      {
        title: "Administration",
        icon: <FaCogs className="h-6 w-6" />,
        description: "System configuration, user management, and settings.",
        href: "/admin", // Points to the new Admin Dashboard
        color: "bg-slate-50 text-slate-600"
      },
      {
        title: "Fees",
        icon: <FaRupeeSign className="h-6 w-6" />,
        description: "Manage fee structure, payments, and dues.",
        href: "/fees",
        color: "bg-green-50 text-green-600"
      }
    ];

    // Filter out Administration and Fees for HOD if desired, or keep them.
    // User said "HODs have global edit/view access".
    // Usually HOD doesn't manage Users (Administration).
    if (role === "HOD") {
      modules = modules.filter(m => m.title !== "Administration" && m.title !== "Fees");
    }

  } else {
    // User / Faculty Modules
    modules = [
      {
        title: "Mark Attendance",
        icon: <FaUserGraduate className="h-6 w-6" />,
        description: "Mark student attendance for your classes.",
        href: "/attendance",
        color: "bg-blue-50 text-blue-600"
      },
      {
        title: "History & Downloads",
        icon: <FaFileAlt className="h-6 w-6" />,
        description: "View past records and download reports.",
        href: "/attendance/history",
        color: "bg-teal-50 text-teal-600"
      }
    ];
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Backup Status Banner (Admins Only) */}
        {mounted && isAdmin && (
          <AnimatePresence mode="wait">
            {!dismissBanner && backupStatus && backupStatus.status !== "unknown" && (
              <motion.div
                key="backup-banner"
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
          className="mb-10 text-center sm:text-left"
        >
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Student Management System
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Welcome back, <span className="font-semibold text-blue-600">{session?.user?.username}</span>. What would you like to manage today?
          </p>
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
