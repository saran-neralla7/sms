"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FaArrowLeft, FaHome, FaSignOutAlt, FaKey, FaClipboardList, FaHistory } from "react-icons/fa"; // Added icons
import AcademicYearSelector from "./AcademicYearSelector";
import ChangePasswordModal from "./ChangePasswordModal";
import { useState } from "react";

interface Props {
    years: { id: string; name: string; isCurrent: boolean }[];
    currentYearId?: string;
}

export default function Navbar({ years = [], currentYearId }: Props) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

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
                        <Link href={(session.user as any).role === "FACULTY" ? "/faculty/dashboard" : "/dashboard"} className="flex items-center gap-2">
                            <img
                                src="https://www.gvpcdpgc.edu.in/gvplogo.jpg"
                                alt="Logo"
                                className="h-8 w-8 rounded-full"
                            />
                            <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:block">
                                GVPCDPGC<span className="text-blue-600">(A)</span>
                            </span>
                        </Link>

                        {/* SMS User specific Links */}
                        {(session.user as any).role === "SMS_USER" && (
                            <div className="ml-6 flex items-center gap-4">
                                <Link href="/attendance" className={`${pathname === '/attendance' ? 'text-blue-600 font-bold' : 'text-slate-600'} hover:text-blue-600 flex items-center gap-1`}>
                                    <FaClipboardList /> Attendance
                                </Link>
                                <Link href="/attendance/history" className={`${pathname === '/attendance/history' ? 'text-blue-600 font-bold' : 'text-slate-600'} hover:text-blue-600 flex items-center gap-1`}>
                                    <FaHistory /> History
                                </Link>
                            </div>
                        )}

                        {/* Global Academic Year Selector - HIDE for SMS User */}
                        {(session.user as any).role !== "SMS_USER" && (
                            <div className="hidden md:block">
                                <AcademicYearSelector years={years} currentYearId={currentYearId} />
                            </div>
                        )}
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-3">
                        {/* Back Button - Hidden on Dashboard and for SMS User */}
                        {!isDashboard && (session.user as any).role !== "SMS_USER" && (
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                                title="Go Back"
                            >
                                <FaArrowLeft />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        )}

                        {/* Home Button - Hidden on Dashboard and for SMS User */}
                        {!isDashboard && (session.user as any).role !== "SMS_USER" && (
                            <Link
                                href={(session.user as any).role === "FACULTY" ? "/faculty/dashboard" : "/dashboard"}
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
                                onClick={() => setIsChangePasswordOpen(true)}
                                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
                                title="Change Password"
                            >
                                <FaKey size={14} />
                            </button>

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

            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />
        </motion.nav>
    );
}
