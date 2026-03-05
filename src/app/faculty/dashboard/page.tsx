
"use client";

import { useSession } from "next-auth/react";
import {
    FaUserCheck,
    FaHistory,
    FaChartBar,
    FaUserCircle
} from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import { motion } from "framer-motion";

export default function FacultyDashboard() {
    const { data: session } = useSession();

    const modules = [
        {
            title: "Take Attendance",
            icon: FaUserCheck,
            description: "Mark student attendance for your classes.",
            href: "/attendance",
            color: "bg-blue-500",
        },
        {
            title: "Attendance History",
            icon: FaHistory,
            description: "View past attendance records.",
            href: "/attendance/history", // Adjusted to point to existing history page or new one
            color: "bg-purple-500",
        },
        {
            title: "Reports",
            icon: FaChartBar,
            description: "View student performance and attendance reports.",
            href: "/reports",
            color: "bg-emerald-500",
        },
        {
            title: "My Profile",
            icon: FaUserCircle,
            description: "View your personal and professional details.",
            href: "/faculty/profile",
            color: "bg-amber-500",
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">
                        Welcome, {session?.user?.name || "Faculty"}
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Manage your classes, view reports, and check your profile.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {modules.map((module, index) => (
                        <motion.div
                            key={module.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <DashboardCard
                                title={module.title}
                                icon={<module.icon size={24} />}
                                description={module.description}
                                href={module.href}
                                colorClass={module.color}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
