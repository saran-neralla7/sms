"use client";

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
    FaArrowLeft
} from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    if (status === "loading") {
        return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
    }

    const modules = [
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
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">

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
