"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { FaFileAlt } from "react-icons/fa";
import DashboardCard from "@/components/DashboardCard";
import LogoSpinner from "@/components/LogoSpinner";

export default function OfficeDashboardPage() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
    }

    return (
        <div className="mx-auto max-w-4xl">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                <h1 className="text-3xl font-extrabold text-slate-900">Office Dashboard</h1>
                <p className="mt-2 text-lg text-slate-600">
                    Welcome, <span className="font-semibold text-blue-600">{(session?.user as any)?.username}</span>
                </p>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <DashboardCard
                        title="Exam Applications"
                        icon={<FaFileAlt className="h-6 w-6" />}
                        description="Review, approve, and export exam applications."
                        href="/office/exam-applications"
                        colorClass="bg-blue-50 text-blue-600"
                    />
                </motion.div>
            </div>
        </div>
    );
}
