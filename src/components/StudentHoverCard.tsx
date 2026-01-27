"use client";

import Link from "next/link";
import { FaUserGraduate, FaClipboardList, FaChartBar, FaInfoCircle } from "react-icons/fa";

interface StudentHoverCardProps {
    name: string;
    rollNumber: string;
    studentId: string;
    children: React.ReactNode;
    className?: string;
    disableHover?: boolean;
}

export default function StudentHoverCard({ name, rollNumber, studentId, children, className = "", disableHover = false }: StudentHoverCardProps) {
    return (
        <div className={`group relative inline-block ${className}`}>
            <Link href={`/admin/students/${studentId}?tab=overview`} className="cursor-pointer underline-offset-4 group-hover:underline decoration-blue-500/30 text-inherit">
                {children}
            </Link>

            {/* Hover Card Container with Bridge */}
            {!disableHover && (
                <div className="absolute left-1/2 top-full z-50 hidden pt-2 -translate-x-1/2 group-hover:block">
                    <div className="flex w-64 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                        {/* Arrow */}
                        <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-slate-200 bg-white"></div>

                        {/* Content */}
                        <div className="relative z-10">
                            <div className="mb-3 text-center border-b border-slate-100 pb-3">
                                <p className="font-bold text-slate-900">{name}</p>
                                <p className="font-mono text-xs text-slate-500">{rollNumber}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <Link
                                    href={`/admin/students/${studentId}?tab=overview`}
                                    className="flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors hover:bg-slate-50 text-slate-600 hover:text-blue-600"
                                    title="View Details"
                                >
                                    <FaInfoCircle size={16} />
                                    <span className="text-[10px] font-medium">Details</span>
                                </Link>
                                <Link
                                    href={`/admin/students/${studentId}?tab=attendance`}
                                    className="flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors hover:bg-slate-50 text-slate-600 hover:text-blue-600"
                                    title="Attendance"
                                >
                                    <FaClipboardList size={16} />
                                    <span className="text-[10px] font-medium">Attend</span>
                                </Link>
                                <Link
                                    href={`/admin/students/${studentId}?tab=results`}
                                    className="flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors hover:bg-slate-50 text-slate-600 hover:text-blue-600"
                                    title="Results"
                                >
                                    <FaChartBar size={16} />
                                    <span className="text-[10px] font-medium">Results</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
