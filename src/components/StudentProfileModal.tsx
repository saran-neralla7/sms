"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaUser, FaUserGraduate, FaAward, FaCalendarAlt, FaEnvelope, FaPhone, FaMapMarkerAlt, FaIdCard, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import Image from "next/image";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

interface StudentProfileModalProps {
    studentId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function StudentProfileModal({ studentId, isOpen, onClose }: StudentProfileModalProps) {
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "results" | "internal-marks">("overview");
    const [stats, setStats] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [resultsLoading, setResultsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && studentId) {
            fetchStudent();
        } else {
            setStudent(null);
            setStats(null);
            setResults([]);
            setActiveTab("overview");
        }
    }, [isOpen, studentId]);

    useEffect(() => {
        if (isOpen && studentId && activeTab === "attendance" && !stats) {
            fetchStats();
        } else if (isOpen && studentId && activeTab === "results" && results.length === 0) {
            fetchResults();
        }
    }, [activeTab, isOpen, studentId]);

    const fetchStudent = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/students/${studentId}`);
            if (res.ok) {
                const data = await res.json();
                setStudent(data);
            }
        } catch (error) {
            console.error("Error fetching student profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await fetch(`/api/students/${studentId}/stats`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Error fetching student attendance stats:", error);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchResults = async () => {
        setResultsLoading(true);
        try {
            const res = await fetch(`/api/results?studentId=${studentId}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data);
            }
        } catch (error) {
            console.error("Error fetching student results:", error);
        } finally {
            setResultsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
                >
                    {/* Modal Header Bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
                        <div className="flex items-center gap-2">
                            <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                                View-Only Mode
                            </span>
                            <h2 className="text-lg font-bold text-slate-800">Student Profile & Academic Record</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                        >
                            <FaTimes size={18} />
                        </button>
                    </div>

                    {/* Modal Content Body */}
                    {loading ? (
                        <div className="flex h-96 flex-col items-center justify-center bg-white p-8">
                            <LogoSpinner />
                            <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading Student Profile...</p>
                        </div>
                    ) : student ? (
                        <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-6">
                            {/* Basic Info Summary */}
                            <div className="flex flex-col gap-6 sm:flex-row sm:items-center bg-slate-50 p-5 rounded-xl border border-slate-100">
                                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md mx-auto sm:mx-0">
                                    {student.photoUrl ? (
                                        <Image
                                            src={student.photoUrl}
                                            alt={student.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
                                            <FaUser size={40} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 text-center sm:text-left space-y-1">
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        <h3 className="text-xl font-bold text-slate-900">{student.name}</h3>
                                        <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                                            {student.rollNumber}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-600 pt-1">
                                        <span className="flex items-center gap-1 font-semibold">
                                            <FaUserGraduate className="text-slate-400" />
                                            Year {student.year} Sem {student.semester} ({typeof student.section === 'object' ? (student.section as any)?.name : student.section})
                                        </span>
                                        <span className="flex items-center gap-1 font-semibold">
                                            <FaAward className="text-slate-400" />
                                            {typeof student.department === 'object' ? (student.department as any)?.name : ""}
                                        </span>
                                        {student.hallTicketNumber && (
                                            <span className="flex items-center gap-1 font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                                HT: {student.hallTicketNumber}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tabs Navigation */}
                            <div className="flex border-b border-slate-200 gap-2">
                                <button
                                    onClick={() => setActiveTab("overview")}
                                    className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                        activeTab === "overview"
                                            ? "border-blue-600 text-blue-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab("attendance")}
                                    className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                        activeTab === "attendance"
                                            ? "border-blue-600 text-blue-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Attendance Record
                                </button>
                                <button
                                    onClick={() => setActiveTab("results")}
                                    className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                        activeTab === "results"
                                            ? "border-blue-600 text-blue-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Semester Results
                                </button>
                                <button
                                    onClick={() => setActiveTab("internal-marks")}
                                    className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                                        activeTab === "internal-marks"
                                            ? "border-blue-600 text-blue-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Internal Marks
                                </button>
                            </div>

                            {/* Tab Content */}
                            {activeTab === "overview" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                                        <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 text-sm uppercase tracking-wider text-slate-500">
                                            Personal Details
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <p className="text-slate-400 font-medium">Date of Birth</p>
                                                <p className="font-semibold text-slate-800">{student.dateOfBirth ? formatISTDate(student.dateOfBirth) : "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-medium">Gender</p>
                                                <p className="font-semibold text-slate-800">{student.gender || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-medium">Father's Name</p>
                                                <p className="font-semibold text-slate-800">{student.fatherName || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-medium">Mother's Name</p>
                                                <p className="font-semibold text-slate-800">{student.motherName || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-medium">Category</p>
                                                <p className="font-semibold text-slate-800">{student.casteName || student.category || "-"}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 font-medium">ABC ID</p>
                                                <p className="font-semibold text-slate-800 font-mono">{student.abcId || "-"}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-slate-400 font-medium">Address</p>
                                                <p className="font-semibold text-slate-800">{student.address || "-"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                                            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 text-sm uppercase tracking-wider text-slate-500">
                                                Contact Info
                                            </h4>
                                            <div className="space-y-2 text-xs">
                                                <div>
                                                    <p className="text-slate-400 font-medium">Email</p>
                                                    <p className="font-semibold text-slate-800">{student.emailId || student.domainMailId || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-medium">Student Contact</p>
                                                    <p className="font-semibold text-slate-800">{student.studentContactNumber || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-medium">Parent Contact</p>
                                                    <p className="font-semibold text-slate-800">{student.mobile || "-"}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                                            <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 text-sm uppercase tracking-wider text-slate-500">
                                                Admission & Status
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div>
                                                    <p className="text-slate-400 font-medium">Admission Type</p>
                                                    <p className="font-semibold text-slate-800">{student.admissionType || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-medium">EAMCET Rank</p>
                                                    <p className="font-semibold text-slate-800">{student.eamcetRank || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-medium">Lab Batch</p>
                                                    <p className="font-semibold text-slate-800">{(student.labBatch as any)?.name || "-"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-medium">Fee Reimbursement</p>
                                                    <p className="font-semibold text-slate-800">{student.reimbursement ? "Yes" : "No"}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "attendance" && (
                                <div className="space-y-6">
                                    {statsLoading ? (
                                        <div className="flex h-48 items-center justify-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                                        </div>
                                    ) : stats ? (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Overall Rate</p>
                                                    <span className={`text-3xl font-black ${
                                                        stats.overall?.percentage >= 75 ? "text-emerald-600" : stats.overall?.percentage >= 65 ? "text-amber-600" : "text-rose-600"
                                                    }`}>
                                                        {stats.overall?.percentage}%
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Attended</p>
                                                    <p className="text-2xl font-bold text-slate-800">{stats.overall?.attended} Classes</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Total Held</p>
                                                    <p className="text-2xl font-bold text-slate-800">{stats.overall?.total} Classes</p>
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 mb-3">Subject-wise Attendance Breakdown</h4>
                                                <div className="space-y-3">
                                                    {(stats.subjects || []).map((sub: any) => (
                                                        <div key={sub.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className="font-bold text-slate-800">{sub.name}</span>
                                                                <span className={`font-bold px-2 py-0.5 rounded-full ${
                                                                    sub.percentage >= 75 ? "bg-emerald-100 text-emerald-700" : sub.percentage >= 65 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                                                                }`}>
                                                                    {sub.percentage}% ({sub.attended}/{sub.total})
                                                                </span>
                                                            </div>
                                                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${sub.percentage >= 75 ? "bg-emerald-500" : sub.percentage >= 65 ? "bg-amber-500" : "bg-rose-500"}`}
                                                                    style={{ width: `${sub.percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(stats.subjects || []).length === 0 && (
                                                        <p className="text-center py-6 text-xs text-slate-400 italic">No subject breakdown recorded.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-center py-12 text-slate-400 text-sm">No attendance records found.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === "results" && (
                                <div className="space-y-6">
                                    {resultsLoading ? (
                                        <div className="flex h-48 items-center justify-center">
                                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                                        </div>
                                    ) : results.length > 0 ? (
                                        <>
                                            {(() => {
                                                const sortedResults = [...results].sort((a, b) => {
                                                    if (a.year !== b.year) return Number(b.year) - Number(a.year);
                                                    return Number(b.semester) - Number(a.semester);
                                                });
                                                const finalCGPA = Number(sortedResults[0]?.cgpa || 0).toFixed(2);
                                                const backlogCount = results.reduce((acc: number, res: any) => {
                                                    return acc + (res.grades as any[]).filter((g: any) => g.grade === "F" || g.grade === "ABSENT").length;
                                                }, 0);

                                                return (
                                                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-500">Cumulative GPA (CGPA)</p>
                                                            <p className="text-3xl font-black text-purple-700">{finalCGPA}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-500">Active Backlogs</p>
                                                            <span className={`inline-block text-lg font-bold px-3 py-0.5 rounded-full ${
                                                                backlogCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                                            }`}>
                                                                {backlogCount} Failures
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="space-y-4">
                                                {results.map((semResult: any) => (
                                                    <div key={semResult.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-100">
                                                            <h5 className="font-bold text-slate-800 text-sm">
                                                                Year {semResult.year} - Semester {semResult.semester}
                                                            </h5>
                                                            <div className="flex gap-4 text-xs font-semibold">
                                                                <span>SGPA: <strong className="text-blue-600">{semResult.sgpa}</strong></span>
                                                                <span>CGPA: <strong className="text-purple-600">{semResult.cgpa}</strong></span>
                                                            </div>
                                                        </div>
                                                        <div className="p-3">
                                                            <table className="w-full text-left text-xs">
                                                                <thead className="text-slate-400 font-semibold border-b border-slate-100">
                                                                    <tr>
                                                                        <th className="py-1 px-2">Subject Code</th>
                                                                        <th className="py-1 px-2 text-right">Grade</th>
                                                                        <th className="py-1 px-2 text-right">Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {(semResult.grades as any[]).map((g: any, i: number) => (
                                                                        <tr key={i}>
                                                                            <td className="py-1.5 px-2 font-medium text-slate-700">{g.subjectCode}</td>
                                                                            <td className="py-1.5 px-2 text-right font-bold text-slate-900">{g.grade}</td>
                                                                            <td className="py-1.5 px-2 text-right">
                                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                    g.grade === "F" || g.grade === "ABSENT" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                                                                }`}>
                                                                                    {g.grade === "F" || g.grade === "ABSENT" ? "Fail" : "Pass"}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-center py-12 text-slate-400 text-sm">No exam results recorded.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === "internal-marks" && (
                                <div className="space-y-4">
                                    {student.internalMarks && student.internalMarks.length > 0 ? (
                                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-3">Academic Year</th>
                                                        <th className="p-3">Subject Code</th>
                                                        <th className="p-3">Subject Name</th>
                                                        <th className="p-3 text-center">MID-I</th>
                                                        <th className="p-3 text-center">MID-II</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {(() => {
                                                        const groupedMarks = new Map();
                                                        student.internalMarks.forEach((mark: any) => {
                                                            const key = `${mark.academicYearId}_${mark.subjectId}`;
                                                            if (!groupedMarks.has(key)) {
                                                                groupedMarks.set(key, {
                                                                    academicYear: mark.academicYear?.name,
                                                                    subjectCode: mark.subject?.code,
                                                                    subjectName: mark.subject?.name,
                                                                    midIMark: null,
                                                                    midIIMark: null
                                                                });
                                                            }
                                                            const group = groupedMarks.get(key);
                                                            if (mark.examType === "MID_I") group.midIMark = mark.marksObtained;
                                                            else if (mark.examType === "MID_II") group.midIIMark = mark.marksObtained;
                                                            else group.midIMark = mark.marksObtained;
                                                        });

                                                        return Array.from(groupedMarks.values()).map((g: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50">
                                                                <td className="p-3 font-semibold text-slate-700">{g.academicYear}</td>
                                                                <td className="p-3 font-mono text-slate-600">{g.subjectCode}</td>
                                                                <td className="p-3 font-semibold text-slate-800">{g.subjectName}</td>
                                                                <td className="p-3 text-center font-bold text-blue-600">{g.midIMark !== null ? g.midIMark : "-"}</td>
                                                                <td className="p-3 text-center font-bold text-indigo-600">{g.midIIMark !== null ? g.midIIMark : "-"}</td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-center py-12 text-slate-400 text-sm">No internal marks recorded.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-400">
                            Student information not found.
                        </div>
                    )}

                    {/* Footer Close Button */}
                    <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
                        <button
                            onClick={onClose}
                            className="rounded-lg bg-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 transition-colors"
                        >
                            Close Profile
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
