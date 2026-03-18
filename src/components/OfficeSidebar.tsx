"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaSignOutAlt, FaBars, FaTimes, FaHome, FaFileAlt, FaCog } from "react-icons/fa";
import { useState } from "react";

export default function OfficeSidebar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const navLinks = [
        { href: "/office/dashboard", label: "Dashboard", icon: <FaHome /> },
        { href: "/office/exam-applications", label: "Exam Applications", icon: <FaFileAlt /> },
    ];

    if (!session || (session.user as any).role !== "OFFICE") return null;

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="https://www.gvpcdpgc.edu.in/gvplogo.jpg" alt="Logo" className="h-8 w-8 rounded-full" />
                    <span className="font-bold text-slate-800 text-sm">Office Portal</span>
                </div>
                <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                    {isOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
                </button>
            </div>

            {/* Overlay */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-16 left-0 bottom-0 z-40 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out overflow-y-auto
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
                md:translate-x-0 md:flex md:flex-col
            `}>
                <div className="p-6 md:hidden"></div>

                <div className="p-6 bg-slate-800/50 mb-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Office Staff</p>
                    <p className="text-base font-bold text-white truncate">{(session.user as any)?.username}</p>
                </div>

                <nav className="px-4 space-y-2">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href || (link.href !== "/office/dashboard" && pathname?.startsWith(link.href));
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                            >
                                <span className={isActive ? "text-white" : "text-slate-500"}>{link.icon}</span>
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 border-t border-slate-800">
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all font-medium"
                    >
                        <FaSignOutAlt />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
