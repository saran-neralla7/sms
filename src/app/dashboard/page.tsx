"use client";

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

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  }

  const role = (session?.user?.role || "").toUpperCase();
  // Admin Check
  const isAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);

  // Define modules based on role
  let modules = [];

  if (isAdmin) {
    modules = [
      {
        title: "Students",
        icon: <FaUserGraduate className="h-6 w-6" />,
        description: "Manage student profiles, enrollments, and attendance.",
        href: "/admin/students",
        color: "bg-blue-50 text-blue-600"
      },
      // ... (rest of admin modules) should be copied or preserved? 
      // Better to list them all here for clarity in replacement
      {
        title: "Faculty",
        icon: <FaChalkboardTeacher className="h-6 w-6" />,
        description: "Manage faculty records, assignments, and workload.",
        href: "/faculty",
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
      },
      {
        title: "Mark Attendance",
        icon: <FaUserGraduate className="h-6 w-6" />,
        description: "Mark student attendance (Academic).",
        href: "/attendance",
        color: "bg-red-50 text-red-600"
      }
    ];
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
