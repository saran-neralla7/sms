"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Student } from "@/types";
import { motion } from "framer-motion";
import { FaArrowLeft, FaAward, FaCalendarAlt, FaEnvelope, FaIdCard, FaMapMarkerAlt, FaPhone, FaUser, FaUserGraduate, FaEdit } from "react-icons/fa";
import Image from "next/image";
import EditStudentModal from "@/components/EditStudentModal";
import Modal from "@/components/Modal";

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "results">("overview");
    const [stats, setStats] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(false);
    const [resultsLoading, setResultsLoading] = useState(false);
    const [dateRange, setDateRange] = useState({ start: "", end: "" });
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    useEffect(() => {
        const tab = searchParams?.get("tab");
        if (tab === "attendance" || tab === "results" || tab === "overview") {
            setActiveTab(tab);
        }
    }, [searchParams]);

    useEffect(() => {
        if (params?.id) {
            fetchStudent();
        }
    }, [params?.id]);

    useEffect(() => {
        if (activeTab === "attendance" && student && !stats) {
            fetchStats();
        } else if (activeTab === "results" && student && results.length === 0) {
            fetchResults();
        }
    }, [activeTab, student]);

    const fetchStudent = async () => {
        try {
            const res = await fetch(`/api/students/${params?.id}`);
            if (res.ok) {
                const data = await res.json();
                setStudent(data);
            } else {
                router.push("/admin/students");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const query = new URLSearchParams();
            if (dateRange.start) query.append("startDate", dateRange.start);
            if (dateRange.end) query.append("endDate", dateRange.end);

            const res = await fetch(`/api/students/${params?.id}/stats?${query.toString()}`);
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
        setResultsLoading(true);
        try {
            const res = await fetch(`/api/results?studentId=${params?.id}`);
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
        return <div className="flex h-96 items-center justify-center text-slate-500">Loading Profile...</div>;
    }

    if (!student) return null;

    return (
        <div className="mx-auto max-w-7xl animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-6 md:flex-row md:items-start">
                <button
                    onClick={() => router.back()}
                    className="mr-2 mt-2 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                    <FaArrowLeft />
                </button>

                {/* Photo & Basic Info */}
                <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-6 sm:flex-row">
                        <div className="shrink-0 text-center sm:text-left">
                            <div
                                className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-slate-50 shadow-md sm:mx-0 sm:h-40 sm:w-40 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => student.photoUrl && setIsPhotoModalOpen(true)}
                            >
                                {student.photoUrl ? (
                                    <Image
                                        src={student.photoUrl}
                                        alt={student.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
                                        <FaUser size={64} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 pt-2 text-center sm:text-left">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
                                    <p className="font-mono text-lg text-blue-600">{student.rollNumber}</p>
                                </div>
                                <button
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                                >
                                    <FaEdit className="text-blue-500" />
                                    Edit Profile
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 sm:justify-start">
                                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                                    <FaUserGraduate className="text-slate-400" />
                                    <span>{student.year}-{student.semester} ({typeof student.section === 'object' ? (student.section as any)?.name : student.section})</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                                    <FaAward className="text-slate-400" />
                                    <span>{typeof student.department === 'object' ? (student.department as any)?.name : ""}</span>
                                </div>
                                {student.hallTicketNumber && (
                                    <div className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-purple-700">
                                        <FaIdCard />
                                        <span>Hall Ticket: {student.hallTicketNumber}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                                <button
                                    onClick={() => setActiveTab("overview")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "overview" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab("attendance")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "attendance" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Attendance
                                </button>
                                <button
                                    onClick={() => setActiveTab("results")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "results" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Results
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="min-h-[500px]">
                {activeTab === "overview" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
                    >
                        {/* Personal Details */}
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                            <h3 className="mb-4 text-lg font-bold text-slate-900">Personal Details</h3>
                            <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
                                <InfoItem label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "-"} icon={<FaCalendarAlt />} />
                                <InfoItem label="Gender" value={student.gender} />
                                <InfoItem label="Father's Name" value={student.fatherName} />
                                <InfoItem label="Mother's Name" value={student.motherName} />
                                <InfoItem label="Caste" value={student.caste} />
                                <InfoItem label="Sub Caste / Category" value={`${student.casteName || ""} ${student.category ? `(${student.category})` : ""}`} />
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
                                    <InfoItem label="Student Mobile" value={student.studentContactNumber} icon={<FaPhone />} />
                                    <InfoItem label="Parent Mobile" value={student.mobile} icon={<FaPhone />} />
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-bold text-slate-900">Admission Details</h3>
                                <div className="flex flex-col gap-4">
                                    <InfoItem label="Admission Type" value={student.admissionType} />
                                    <InfoItem label="EAMCET Rank" value={student.eamcetRank} />
                                    <InfoItem label="Date of Reporting" value={student.dateOfReporting ? new Date(student.dateOfReporting).toLocaleDateString() : "-"} />
                                    <InfoItem label="Reimbursement" value={student.reimbursement ? "Yes" : "No"} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === "attendance" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        {/* Date Filter */}
                        <div className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="w-full sm:w-auto">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                            <div className="w-full sm:w-auto">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                onClick={fetchStats}
                                className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
                            >
                                Apply Filter
                            </button>
                        </div>

                        {statsLoading ? (
                            <div className="flex h-60 items-center justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                            </div>
                        ) : stats ? (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Overall Stats Card */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
                                        <h3 className="text-lg font-bold text-slate-900 mb-4">Overall Attendance</h3>
                                        <div className="relative flex items-center justify-center py-4">
                                            {/* Circular Progress or Big Number */}
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

                                {/* Subject List */}
                                <div className="lg:col-span-2 rounded-xl bg-white p-6 border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4">Subject-wise Breakdown</h3>
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                        {stats.subjects.map((sub: any) => (
                                            <div key={sub.id} className="group rounded-lg border border-slate-100 p-4 hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-semibold text-slate-900 text-sm">{sub.name}</p>
                                                        <p className="text-xs text-slate-500 hidden sm:block">Subject ID: {sub.id.substring(0, 8)}...</p>
                                                    </div>
                                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${sub.percentage >= 75 ? "bg-green-100 text-green-700" :
                                                        sub.percentage >= 65 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                                        }`}>
                                                        {sub.percentage}%
                                                    </span>
                                                </div>

                                                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                                                    <span>Attendance Progress</span>
                                                    <span className="font-mono">{sub.attended} / {sub.total} Classes</span>
                                                </div>

                                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${sub.percentage >= 75 ? "bg-green-500" : sub.percentage >= 65 ? "bg-yellow-500" : "bg-red-500"}`}
                                                        style={{ width: `${sub.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        ))}
                                        {stats.subjects.length === 0 && (
                                            <div className="text-center py-12 text-slate-400">
                                                <p>No subjects found for this student.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                                <p>No attendance data available.</p>
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
                                {/* Stats Header */}
                                {(() => {
                                    // Calculate Stats
                                    // 1. Final CGPA: From Latest Semester
                                    const sortedResults = [...results].sort((a, b) => {
                                        if (a.year !== b.year) return Number(b.year) - Number(a.year);
                                        return Number(b.semester) - Number(a.semester);
                                    });
                                    const finalCGPA = Number(sortedResults[0]?.cgpa || 0).toFixed(2);

                                    // 2. Backlogs: Count 'F' grades across all results
                                    // Note: If student passed a subject later, does the old F disappear? 
                                    // Assuming raw count of Fs in the list for now based on user request "no of F grades".
                                    // To be more accurate, we might want unique subjects failed. But simple count is safer for "Backlog History".
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
                                                <div className="flex flex-col items-start">
                                                    <p className="text-sm font-medium uppercase tracking-wide text-red-500">Active Backlogs</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">{backlogCount}</span>
                                                        <span className="text-sm text-red-600 font-medium">Failed Subjects</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Accordion List */}
                                <div className="grid grid-cols-1 gap-4">
                                    {results.map((semResult: any) => (
                                        <div key={semResult.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-all">
                                            {/* Accordion Header */}
                                            <button
                                                onClick={() => document.getElementById(`sem-result-${semResult.id}`)?.classList.toggle("hidden")}
                                                className="w-full flex items-center justify-between bg-slate-50 px-6 py-4 hover:bg-slate-100 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                                        {semResult.year}-{semResult.semester}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-slate-800">
                                                            Year {semResult.year === "1" ? "1st" : semResult.year === "2" ? "2nd" : semResult.year === "3" ? "3rd" : semResult.year + "th"} - Semester {semResult.semester === "1" ? "1st" : semResult.semester === "2" ? "2nd" : semResult.semester + "th"}
                                                        </h4>
                                                        <p className="text-xs text-slate-500">Click to view details</p>
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
                                                    <div className="text-slate-400">▼</div>
                                                </div>
                                            </button>

                                            {/* Accordion Content (Hidden by default) */}
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
                                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${g.grade === "F" || g.grade === "ABSENT" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
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
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
                                <p>No results found for this student.</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* Edit Modal */}
            <EditStudentModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                student={student}
                onSuccess={() => {
                    fetchStudent();
                    setIsEditModalOpen(false);
                }}
            />

            {/* Photo Modal */}
            <Modal
                isOpen={isPhotoModalOpen}
                onClose={() => setIsPhotoModalOpen(false)}
                title="Student Photo"
                maxWidth="max-w-xl"
            >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                    {student.photoUrl && (
                        <Image
                            src={student.photoUrl}
                            alt={student.name}
                            fill
                            className="object-contain"
                        />
                    )}
                </div>
            </Modal>
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
            <p className="mt-1 font-medium text-slate-900">{value || <span className="text-slate-300 italic">Not set</span>}</p>
        </div>
    );
}
