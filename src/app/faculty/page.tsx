"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { FaUserTie, FaCheckSquare, FaChartBar, FaHistory, FaClipboardList, FaFileAlt, FaCalendarAlt } from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import LogoSpinner from "@/components/LogoSpinner";

export default function FacultyIndexPage() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
    }

    return (
        <div className="w-full bg-slate-50 px-4 py-8 sm:px-6 lg:px-8 flex-grow">
            <div className="mx-auto max-w-7xl">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                    <h1 className="text-3xl font-extrabold text-slate-900">Faculty Gateway</h1>
                    <p className="mt-2 text-lg text-slate-600">
                        Welcome, <span className="font-semibold text-blue-600">{(session?.user as any)?.name || (session?.user as any)?.username}</span>
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <DashboardCard
                            title="My Dashboard"
                            icon={<FaUserTie className="h-6 w-6" />}
                            description="View your profile, timetable, subjects, and student feedback."
                            href="/faculty/dashboard"
                            colorClass="bg-purple-50 text-purple-600"
                        />
                    </motion.div>
                    
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <DashboardCard
                            title="Mark Attendance"
                            icon={<FaCheckSquare className="h-6 w-6" />}
                            description="Mark daily attendance for your assigned sections."
                            href="/attendance"
                            colorClass="bg-green-50 text-green-600"
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <DashboardCard
                            title="Attendance History"
                            icon={<FaHistory className="h-6 w-6" />}
                            description="View and edit previous attendance records."
                            href="/attendance/history"
                            colorClass="bg-orange-50 text-orange-600"
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <DashboardCard
                            title="Reports"
                            icon={<FaChartBar className="h-6 w-6" />}
                            description="Generate cumulative attendance reports."
                            href="/reports"
                            colorClass="bg-blue-50 text-blue-600"
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                        <DashboardCard
                            title="Mid Exams & OBE"
                            icon={<FaClipboardList className="h-6 w-6" />}
                            description="Build question paper blueprints, enter sub-question marks, and submit assignment scores."
                            href="/faculty/mid-exam"
                            colorClass="bg-rose-50 text-rose-600"
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <DashboardCard
                            title="Course Files"
                            icon={<FaFileAlt className="h-6 w-6" />}
                            description="Manage, compile, and print official Course Files containing syllabus, plans, and results."
                            href="/faculty/course-files"
                            colorClass="bg-teal-50 text-teal-600"
                        />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                        <DashboardCard
                            title="Leaves Management"
                            icon={<FaCalendarAlt className="h-6 w-6" />}
                            description="Apply for CL/OD/AL/ML leaves, check balance quotas, and print approved leave slips."
                            href="/faculty/leaves"
                            colorClass="bg-indigo-50 text-indigo-600"
                        />
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

