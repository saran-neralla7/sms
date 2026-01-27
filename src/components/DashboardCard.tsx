"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { motion } from "framer-motion";

export default function DashboardCard({ title, icon, description, href, colorClass = "bg-blue-50 text-blue-600" }: { title: string, icon: ReactNode, description?: string, href: string, colorClass?: string }) {
    return (
        <Link href={href} className="block h-full">
            <motion.div
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl cursor-pointer"
            >
                <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity group-hover:opacity-20">
                    <div className="scale-150 transform">{icon}</div>
                </div>

                <div>
                    <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${colorClass}`}>
                        {icon}
                    </div>
                    <h3 className="mb-1 text-lg font-bold text-slate-800">{title}</h3>
                    {description && <p className="text-sm text-slate-500">{description}</p>}
                </div>

                <div className="mt-4 flex items-center text-sm font-semibold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                    <span>Open Module</span>
                    <span className="ml-1">→</span>
                </div>
            </motion.div>
        </Link>
    );
}
