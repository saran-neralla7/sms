"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaArrowLeft, FaHome, FaSignOutAlt } from "react-icons/fa";

export default function Navbar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    if (!session) return null;

    const isDashboard = pathname === "/dashboard";

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all"
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo / Home via Logo */}
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <img
                                src="https://www.gvpcdpgc.edu.in/gvplogo.jpg"
                                alt="Logo"
                                className="h-8 w-8 rounded-full"
                            />
                            <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:block">
                                GVPCDPGC<span className="text-blue-600">(A)</span>
                            </span>
                        </Link>
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3">
                        {/* Back Button - Hidden on Dashboard */}
                        {!isDashboard && (
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                                title="Go Back"
                            >
                                <FaArrowLeft />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        )}

                        {/* Home Button - Hidden on Dashboard */}
                        {!isDashboard && (
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
                                title="Go to Dashboard"
                            >
                                <FaHome />
                                <span className="hidden sm:inline">Home</span>
                            </Link>
                        )}

                        <div className="h-6 w-px bg-slate-200 mx-1"></div>

                        {/* User Profile / Logout */}
                        <div className="flex items-center gap-4">
                            <span className="hidden text-sm font-medium text-slate-500 sm:block">
                                {session.user.username}
                            </span>
                            <button
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                            >
                                <FaSignOutAlt />
                                <span className="hidden sm:inline">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.nav>
    );
}
