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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    if (!session) return null;

    // Structure
    const mainLinks = [
        { href: "/", label: "Attendance" },
        { href: "/attendance/history", label: "History" },
    ];

    // Admin Only
    const adminManageLinks = [
        {
            header: "People", items: [
                { href: "/admin/users", label: "Users" },
                { href: "/admin/students", label: "Students" },
                { href: "/admin/promote", label: "Promote" },
                { href: "/admin/alumni", label: "Alumni" },
            ]
        },
        {
            header: "Academic", items: [
                { href: "/admin/departments", label: "Departments" },
                { href: "/admin/sections", label: "Sections" },
                { href: "/admin/regulations", label: "Regulations" },
                { href: "/admin/periods", label: "Periods" },
                { href: "/admin/subjects", label: "Subjects" },
                { href: "/admin/elective-slots", label: "Elective Slots" },
                { href: "/admin/electives", label: "Elective Enrollment" },
                { href: "/admin/results", label: "Results" },
            ]
        }
    ];

    // Roles & Access
    const role = session.user.role;
    const isGlobalAdmin = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
    const isHOD = role === "HOD";
    const canManage = isGlobalAdmin || isHOD;

    // Filter Links Based on Role
    // HODs should NOT see "Departments" creation or "Users" (unless creating faculty - maybe later).
    // For now, let's restrict HODs from: Departments, Alumni (maybe?), Periods (maybe?)
    // Actually, HODs need to manage Sections, Periods, Subjects, Electives, Results, Students for THEIR department.
    // They should NOT manage: Users (Global), Departments (Global).

    const filteredAdminLinks = adminManageLinks.map(group => {
        return {
            ...group,
            items: group.items.filter(item => {
                if (isHOD) {
                    // HOD Restrictions
                    if (["/admin/users", "/admin/departments", "/admin/alumni", "/admin/regulations"].includes(item.href)) return false;
                }
                return true;
            })
        };
    }).filter(group => group.items.length > 0);

    const getExtraLinks = () => {
        if (canManage || session.user.role === "USER") {
            return [{ href: "/reports", label: "Reports" }];
        }
        return [];
    };

    const visibleLinks = [
        ...mainLinks,
        ...getExtraLinks(),
        ...(isHOD ? [{ href: "/admin/students", label: "Students" }] : [])
    ];

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className="fixed left-0 right-0 top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all"
            >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-2 pr-8">
                            <span className="text-xl font-bold tracking-tight text-slate-900">GVPCDPGC<span className="text-blue-600">(A)</span></span>
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden flex-1 items-center justify-between md:flex">
                            <div className="flex items-center space-x-6">
                                {visibleLinks.map((link) => {
                                    const isActive = pathname === link.href;
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`relative text-sm font-medium transition-colors ${isActive ? "text-blue-600" : "text-slate-600 hover:text-slate-900"}`}
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

                                {/* Admin/HOD Dropdown */}
                                {canManage && (
                                    <div
                                        className="relative"
                                        onMouseEnter={() => setIsDropdownOpen(true)}
                                        onMouseLeave={() => setIsDropdownOpen(false)}
                                    >
                                        <button
                                            className={`flex items-center gap-1 text-sm font-medium transition-colors ${pathname.startsWith("/admin") ? "text-blue-600" : "text-slate-600 hover:text-slate-900"
                                                }`}
                                        >
                                            {isGlobalAdmin ? "Administration" : "Department"}
                                            <svg className={`h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        <AnimatePresence>
                                            {isDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-xl ring-1 ring-black ring-opacity-5"
                                                >
                                                    <div className="flex flex-col gap-2">
                                                        {filteredAdminLinks.map((group, idx) => (
                                                            <div key={idx} className="px-2 py-2">
                                                                <h3 className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">{group.header}</h3>
                                                                <div className="space-y-1">
                                                                    {group.items.map(item => (
                                                                        <Link
                                                                            key={item.href}
                                                                            href={item.href}
                                                                            onClick={() => setIsDropdownOpen(false)} // Optional: close on click
                                                                            className="block rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                                                                        >
                                                                            {item.label}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-sm font-medium text-slate-500">
                                    {session.user.username}
                                </span>
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
            </motion.nav>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="fixed left-0 right-0 top-16 z-40 overflow-hidden border-b border-slate-200 bg-white shadow-xl md:hidden"
                    >
                        <div className="flex max-h-[80vh] flex-col overflow-y-auto p-4">
                            <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 p-3">
                                <div className="h-10 w-10 rounded-full bg-blue-200 flex items-center justify-center text-blue-700">
                                    <span className="font-bold text-lg">{session.user.username.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900">{session.user.username}</p>
                                    <p className="text-xs text-slate-500 capitalize">{session.user.role} role</p>
                                </div>
                            </div>

                            <div className="space-y-1">
                                {visibleLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`block rounded-lg px-4 py-3 text-sm font-medium transition-colors ${pathname === link.href
                                            ? "bg-blue-600 text-white"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                            }`}
                                    >
                                        {link.label}
                                    </Link>
                                ))}

                                {canManage && (
                                    <div className="mt-4 border-t border-slate-100 pt-4">
                                        <p className="mb-2 px-4 text-xs font-bold uppercase text-slate-400">Management</p>
                                        {filteredAdminLinks.map(group => (
                                            <div key={group.header}>
                                                {group.items.map(item => (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        onClick={() => setIsOpen(false)}
                                                        className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${pathname === item.href
                                                            ? "bg-blue-50 text-blue-700"
                                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                            }`}
                                                    >
                                                        {item.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="my-4 h-px bg-slate-100" />
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

            {/* Spacer */}
            <div className="h-20" />
        </>
    );
}
