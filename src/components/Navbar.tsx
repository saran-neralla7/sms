"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { FaBars, FaTimes, FaUserCircle } from "react-icons/fa";

export default function Navbar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    if (!session) return null;

    // Role-based Link Logic
    const getLinks = () => {
        if (session.user.role === "ADMIN") {
            return [
                { href: "/", label: "Attendance" },
                { href: "/admin/students", label: "Students" },
                { href: "/admin/promote", label: "Promote" },
                { href: "/admin/users", label: "Users" },
                { href: "/admin/alumni", label: "Alumni" },
                { href: "/admin/departments", label: "Depts" },
                { href: "/admin/sections", label: "Sections" },
                { href: "/admin/periods", label: "Periods" },
                { href: "/admin/subjects", label: "Subjects" },
                { href: "/reports", label: "Reports" },
                { href: "/attendance/history", label: "History" },
            ];
        } else if (session.user.role === "HOD") {
            return [
                { href: "/reports", label: "Reports" },
                { href: "/attendance/history", label: "History" },
                { href: "/admin/students", label: "Students" },
            ];
        } else if (session.user.role === "FACULTY") {
            return [
                { href: "/", label: "Mark Attendance" },
                { href: "/attendance/history", label: "History" },
            ];
        } else {
            // USER
            return [
                { href: "/", label: "Attendance" },
            ];
        }
    };

    const links = getLinks();
    return (
        <>
            <nav className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-xl font-bold tracking-tight text-slate-900">GVPCDPGC<span className="text-blue-600">(A)</span></span>
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center space-x-8">
                            {links.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`relative text-sm font-medium transition-colors ${isActive ? "text-blue-600" : "text-slate-600 hover:text-slate-900"
                                            }`}
                                    >
                                        {link.label}
                                        {isActive && (
                                            <motion.div
                                                layoutId="nav-pill"
                                                className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-blue-600"
                                            />
                                        )}
                                    </Link>
                                );
                            })}

                            <div className="pl-6 border-l border-slate-200">
                                <button
                                    onClick={() => signOut()}
                                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                        >
                            {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="fixed left-0 right-0 top-16 z-40 overflow-hidden border-b border-slate-200 bg-white shadow-xl md:hidden"
                    >
                        <div className="flex flex-col space-y-1 p-4">
                            <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 p-3">
                                <FaUserCircle className="text-blue-600" size={24} />
                                <div>
                                    <p className="text-sm font-bold text-slate-900">{session.user.username}</p>
                                    <p className="text-xs text-slate-500 capitalize">{session.user.role} role</p>
                                </div>
                            </div>
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setIsOpen(false)}
                                    className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${pathname === link.href
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            {(session?.user.role === "ADMIN" || session?.user.role === "HOD" || session?.user.role === "USER") && (
                                <Link
                                    href="/reports"
                                    onClick={() => setIsOpen(false)}
                                    className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${pathname === "/reports"
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    Reports
                                </Link>
                            )}
                            <div className="my-2 h-px bg-slate-100" />
                            <button
                                onClick={() => signOut()}
                                className="w-full rounded-lg bg-red-50 p-3 text-left text-sm font-medium text-red-600 hover:bg-red-100"
                            >
                                Sign Out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Spacer to push content down below fixed header */}
            <div className="h-20" />
        </>
    );
}
