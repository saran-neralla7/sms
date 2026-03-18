"use client";

import { useEffect, useState } from "react";
import { Student } from "@/types";
import { motion } from "framer-motion";
import { FaCalendarAlt, FaIdCard, FaMapMarkerAlt, FaPhone, FaUser, FaUserGraduate, FaLayerGroup, FaAward, FaEnvelope } from "react-icons/fa";
import Image from "next/image";
import AttendanceGraph from "@/components/AttendanceGraph";
import { formatISTDate } from "@/lib/dateUtils";

export default function StudentDashboardPage() {
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "results">("overview");
    const [stats, setStats] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [resultsLoading, setResultsLoading] = useState(false);

    useEffect(() => {
        fetchStudentMe();
    }, []);

    useEffect(() => {
        if (activeTab === "attendance" && student && !stats) {
            fetchStats();
        } else if (activeTab === "results" && student && results.length === 0) {
            fetchResults();
        }
    }, [activeTab, student]);

    const fetchStudentMe = async () => {
        try {
            const res = await fetch(`/api/students/me`);
            if (res.ok) {
                const data = await res.json();
                setStudent(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        if (!student?.id) return;
        setStatsLoading(true);
        try {
            const res = await fetch(`/api/students/${student.id}/stats?year=${student.year}&semester=${student.semester}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchResults = async () => {
        if (!student?.id) return;
        setResultsLoading(true);
        try {
            const res = await fetch(`/api/results?studentId=${student.id}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setResultsLoading(false);
        }
    };

    if (loading) {
        return <div className="flex h-96 items-center justify-center text-slate-500">Loading your profile...</div>;
    }

    if (!student) return <div className="text-center text-red-500 py-12">Failed to load student data.</div>;

    return (
        <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
            {/* Page Metadata for SEO */}
            <title>{`${student.name} | Student Dashboard`}</title>
            <meta name="description" content={`Academic overview, attendance, and results for ${student.name}`} />

            {/* Header */}
            <div className="mb-8 flex flex-col gap-6">
                {/* Photo & Basic Info */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Background Accent */}
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-r from-red-600 to-red-800 opacity-5" />
                    
                    <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
                        <div className="shrink-0">
                            <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-2xl border-2 border-white shadow-lg sm:mx-0 sm:h-36 sm:w-36 bg-slate-100">
                                {student.photoUrl ? (
                                    <Image src={student.photoUrl} alt={student.name} fill className="object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                                        <FaUser size={48} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 pt-2">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">{student.name}</h1>
                                <p className="mt-1 font-mono text-xl font-bold text-red-600">{student.rollNumber}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
                                    <FaUserGraduate className="text-red-500" />
                                    <span>Year {student.year}-{student.semester}</span>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700">
                                    <FaLayerGroup className="text-red-500" />
                                    <span>Section {typeof student.section === 'object' ? (student.section as any)?.name : student.section}</span>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-red-700">
                                    <FaAward />
                                    <span>{typeof student.department === 'object' ? (student.department as any)?.name : ""}</span>
                                </div>
                                {student.hallTicketNumber && (
                                    <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5 text-purple-700">
                                        <FaIdCard />
                                        <span>HT: {student.hallTicketNumber}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
                            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" />
                            <TabButton active={activeTab === "attendance"} onClick={() => setActiveTab("attendance")} label="Attendance" />
                            <TabButton active={activeTab === "results"} onClick={() => setActiveTab("results")} label="Results" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="min-h-[500px]">
                {activeTab === "overview" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Personal Details */}
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                            <h3 className="mb-4 text-lg font-bold text-slate-900">Personal Details</h3>
                            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                                <InfoItem label="Date of Birth" value={student.dateOfBirth ? formatISTDate(student.dateOfBirth) : "-"} icon={<FaCalendarAlt />} />
                                <InfoItem label="Gender" value={student.gender} />
                                <InfoItem label="Father's Name" value={student.fatherName} />
                                <InfoItem label="Mother's Name" value={student.motherName} />
                                <InfoItem label="Aadhar Number" value={student.aadharNumber} />
                                <InfoItem label="ABC ID" value={student.abcId} />
                                <div className="sm:col-span-2">
                                    <InfoItem label="Address" value={student.address} icon={<FaMapMarkerAlt />} />
                                </div>
                            </div>
                        </div>

                        {/* Contact & Admission */}
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-bold text-slate-900">Contact Information</h3>
                                <div className="flex flex-col gap-4">
                                    <InfoItem label="Email ID" value={student.emailId} icon={<FaEnvelope />} />
                                    <InfoItem label="Domain Mail ID" value={student.domainMailId} icon={<FaEnvelope />} />
                                    <InfoItem label="My Mobile" value={student.studentContactNumber} icon={<FaPhone />} />
                                    <InfoItem label="Parent Mobile" value={student.mobile} icon={<FaPhone />} />
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-bold text-slate-900">Academic Tags</h3>
                                <InfoItem label="Current Batch" value={(student.batch as any)?.name} icon={<FaLayerGroup />} />
                                <InfoItem label="Lab Batch" value={(student.labBatch as any)?.name} icon={<FaLayerGroup />} />
                                {student.isDetained && <InfoItem label="Status" value="Detained" />}
                                {student.isLateralEntry && <InfoItem label="Admission" value="Lateral Entry" />}
                            </div>
                        </div>
                        
                        {/* My Elective Subjects */}
                         {student.subjects && student.subjects.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3">
                                <h3 className="mb-4 text-lg font-bold text-slate-900">My Registered Electives</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {student.subjects.filter((sub: any) => sub.isElective || (sub.type && sub.type.toUpperCase().includes("ELECTIVE"))).map((subject: any) => (
                                        <div key={subject.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col">
                                            <span className="text-xs font-bold text-red-600 mb-1">{subject.code}</span>
                                            <span className="text-sm font-semibold text-slate-800">{subject.name}</span>
                                            <span className="text-[10px] uppercase text-slate-400 mt-2 font-bold">{subject.type}</span>
                                        </div>
                                    ))}
                                    {student.subjects.filter((sub: any) => sub.isElective || (sub.type && sub.type.toUpperCase().includes("ELECTIVE"))).length === 0 && (
                                        <div className="col-span-full py-4 text-center text-slate-500 bg-slate-50 rounded-lg">No electives registered yet.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === "attendance" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        {statsLoading ? (
                            <div className="flex h-60 items-center justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                            </div>
                        ) : stats ? (
                            <div className="space-y-6">
                                <AttendanceGraph data={stats.monthlyTrend} />

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
                                            <h3 className="text-lg font-bold text-slate-900 mb-4">Overall Attendance</h3>
                                            <div className="relative flex items-center justify-center py-4">
                                                <div className="text-center">
                                                    <span className={`text-5xl font-bold ${stats.overall.percentage >= 75 ? "text-green-600" : stats.overall.percentage >= 65 ? "text-yellow-600" : "text-red-600"}`}>
                                                        {stats.overall.percentage}%
                                                    </span>
                                                    <p className="text-sm font-medium text-slate-500 mt-2">Attendance Rate</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100">
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-slate-900">{stats.overall.attended}</p>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Classes Attended</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-bold text-slate-900">{stats.overall.total}</p>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Total Classes</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4">Subject-wise Breakdown</h3>
                                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                            {stats.subjects.map((sub: any) => (
                                                <div key={sub.id} className="group rounded-lg border border-slate-100 p-4 hover:border-red-100 hover:bg-red-50/30 transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <p className="font-semibold text-slate-900 text-sm">{sub.name}</p>
                                                        </div>
                                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${sub.percentage >= 75 ? "bg-green-100 text-green-700" : sub.percentage >= 65 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                                            {sub.percentage}%
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                                        <span>Progress</span>
                                                        <span className="font-mono">{sub.attended} / {sub.total} Classes</span>
                                                    </div>

                                                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${sub.percentage >= 75 ? "bg-green-500" : sub.percentage >= 65 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${sub.percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                            {stats.subjects.length === 0 && (
                                                <div className="text-center py-12 text-slate-400">
                                                    <p>Your attendance data has not been recorded yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                                <p>No attendance stats available at this time.</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === "results" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        {resultsLoading ? (
                            <div className="flex h-60 items-center justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                            </div>
                        ) : results.length > 0 ? (
                            <div className="space-y-6">
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
                                        <div className="flex items-center gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                            <div>
                                                <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Cumulative GPA</p>
                                                <p className="text-4xl font-extrabold text-slate-900 mt-1">{finalCGPA}</p>
                                            </div>
                                            {backlogCount > 0 && (
                                                <div className="flex flex-col items-start border-l border-slate-200 pl-6">
                                                    <p className="text-sm font-medium uppercase tracking-wide text-red-500">History of Backlogs</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">{backlogCount}</span>
                                                        <span className="text-sm text-red-600 font-medium">Failed Instances</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="grid grid-cols-1 gap-4">
                                    {results.map((semResult: any) => (
                                        <div key={semResult.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-all focus-within:ring-2 focus-within:ring-red-500">
                                            <button
                                                onClick={() => document.getElementById(`sem-result-${semResult.id}`)?.classList.toggle("hidden")}
                                                className="w-full flex items-center justify-between bg-slate-50 px-6 py-4 hover:bg-red-700 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                                                        {semResult.year}-{semResult.semester}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-800">
                                                            Year {semResult.year === "1" ? "1st" : semResult.year === "2" ? "2nd" : semResult.year === "3" ? "3rd" : semResult.year + "th"} - Semester {semResult.semester === "1" ? "1st" : semResult.semester === "2" ? "2nd" : semResult.semester + "th"}
                                                        </h4>
                                                        <p className="text-xs text-slate-500">Click to view grade breakdown</p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-6 mr-4">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SGPA</span>
                                                        <span className={`text-base font-bold ${semResult.sgpa === "Failed" ? "text-red-600" : "text-slate-700"}`}>
                                                            {Number(semResult.sgpa) ? Number(semResult.sgpa).toFixed(2) : semResult.sgpa}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CGPA</span>
                                                        <span className="text-base font-bold text-purple-600">
                                                            {Number(semResult.cgpa) ? Number(semResult.cgpa).toFixed(2) : semResult.cgpa}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>

                                            <div id={`sem-result-${semResult.id}`} className="hidden border-t border-slate-100">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-white text-slate-500 border-b border-slate-100">
                                                            <tr>
                                                                <th className="px-6 py-3 font-semibold">Subject Code</th>
                                                                <th className="px-6 py-3 font-semibold text-right">Grade</th>
                                                                <th className="px-6 py-3 font-semibold text-right">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {(semResult.grades as any[]).map((g: any, i: number) => (
                                                                <tr key={i} className="hover:bg-slate-50/50">
                                                                    <td className="px-6 py-3 font-medium text-slate-700">{g.subjectCode}</td>
                                                                    <td className="px-6 py-3 text-right font-bold text-slate-900">{g.grade}</td>
                                                                    <td className="px-6 py-3 text-right">
                                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${g.grade === "F" || g.grade === "ABSENT" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                                                                            {g.grade === "F" || g.grade === "ABSENT" ? "Fail" : "Pass"}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                                <p>Your exam results have not been posted yet.</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </div>
    );
}

function InfoItem({ label, value, icon }: { label: string, value?: string | number | null, icon?: React.ReactNode }) {
    return (
        <div className="group">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {icon && <span className="text-slate-400">{icon}</span>}
                {label}
            </p>
            <p className="mt-1 font-medium text-slate-900">{value || <span className="text-slate-300 italic">Not available</span>}</p>
        </div>
    );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                active 
                    ? "bg-red-600 text-white shadow-lg shadow-red-200" 
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            }`}
        >
            {label}
        </button>
    );
}
