"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaSignOutAlt, FaUserGraduate, FaBars, FaTimes, FaCog, FaFlask, FaBookOpen, FaFileAlt } from "react-icons/fa";
import { useState, useEffect } from "react";

export default function StudentSidebar() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [studentData, setStudentData] = useState<any>(null);

    const navLinks = [
        { href: "/student/dashboard", label: "My Profile", icon: <FaUserGraduate /> },
        { href: "/student/exam-application", label: "Exam Application", icon: <FaFileAlt /> },
        { href: "/student/settings", label: "Settings", icon: <FaCog /> },
    ];

    useEffect(() => {
        if (session?.user?.role === "STUDENT") {
            fetch("/api/students/me")
                .then(res => res.ok ? res.json() : null)
                .then(data => { if (data) setStudentData(data); })
                .catch(() => {});
        }
    }, [session]);

    if (!session || session.user.role !== "STUDENT") return null;

    // Derive lab batch info
    const labBatchName = studentData?.labBatch?.name || null;
    const studentYear = studentData?.year || null;
    const studentSemester = studentData?.semester || null;

    // Derive elective subjects
    const electives = (studentData?.subjects || []).filter(
        (sub: any) => sub.isElective || (sub.type && sub.type.toUpperCase().includes("ELECTIVE"))
    );

    return (
        <>
            {/* Mobile Header - Compact */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="https://www.gvpcdpgc.edu.in/gvplogo.jpg" alt="Logo" className="h-8 w-8 rounded-full" />
                    <span className="font-bold text-slate-800 text-sm">Portal</span>
                </div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    {isOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
                </button>
            </div>

            {/* Sidebar Overlay */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar - Positioned below Navbar */}
            <aside className={`
                fixed top-16 left-0 bottom-0 z-40 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out overflow-y-auto
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
                md:translate-x-0 md:flex md:flex-col
            `}>
                <div className="p-6 md:hidden"></div> {/* Mobile Spacer */}

                <div className="p-6 bg-slate-800/50 mb-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Logged in as</p>
                    <p className="text-base font-bold text-white truncate">{session.user?.username}</p>
                </div>

                <nav className="px-4 space-y-2">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                                    ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                    }`}
                            >
                                <span className={isActive ? "text-white" : "text-slate-500"}>{link.icon}</span>
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Lab Batches Section */}
                {studentData && (
                    <div className="mx-4 mt-6 rounded-xl bg-slate-800/60 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <FaFlask className="text-red-400" size={14} />
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Lab Batches</h3>
                        </div>

                        {studentYear && studentSemester && (
                            <p className="text-[11px] font-semibold text-slate-400 mb-2">
                                Year {studentYear} – Semester {studentSemester}
                            </p>
                        )}

                        {labBatchName ? (
                            <div className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2">
                                <span className="h-2 w-2 rounded-full bg-green-400 shrink-0"></span>
                                <span className="text-sm font-semibold text-white truncate">{labBatchName}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic">Not assigned to a lab batch</p>
                        )}
                    </div>
                )}

                {/* Electives Section */}
                {studentData && (
                    <div className="mx-4 mt-4 rounded-xl bg-slate-800/60 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <FaBookOpen className="text-red-400" size={14} />
                            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">My Electives</h3>
                        </div>

                        {electives.length > 0 ? (
                            <div className="space-y-2">
                                {electives.map((sub: any) => (
                                    <div key={sub.id} className="rounded-lg bg-slate-700/50 px-3 py-2">
                                        <p className="text-[10px] font-bold text-red-400 uppercase">{sub.code}</p>
                                        <p className="text-xs font-semibold text-white leading-tight mt-0.5">{sub.name}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 italic">No electives in this semester</p>
                        )}
                    </div>
                )}

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
