"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Student } from "@/types";
import { motion } from "framer-motion";
import { FaArrowLeft, FaAward, FaCalendarAlt, FaEnvelope, FaIdCard, FaMapMarkerAlt, FaPhone, FaUser, FaUserGraduate } from "react-icons/fa";
import Image from "next/image";

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "results">("overview");

    useEffect(() => {
        if (params.id) {
            fetchStudent();
        }
    }, [params.id]);

    const fetchStudent = async () => {
        try {
            const res = await fetch(`/api/students/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setStudent(data);
            } else {
                // Handle 404/403
                router.push("/admin/students");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
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
                            <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-slate-50 shadow-md sm:mx-0 sm:h-40 sm:w-40">
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
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{student.name}</h1>
                                <p className="font-mono text-lg text-blue-600">{student.rollNumber}</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 sm:justify-start">
                                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                                    <FaUserGraduate className="text-slate-400" />
                                    <span>{student.year}-{student.semester} ({typeof student.section === 'object' ? student.section?.name : student.section})</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                                    <FaAward className="text-slate-400" />
                                    <span>{typeof student.department === 'object' ? student.department?.name : ""}</span>
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
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                            <p className="text-slate-500">Attendance Analytics Integration Coming Soon</p>
                            <p className="text-sm text-slate-400">Current View is available in the Reports section.</p>
                            {/* Can integrate the existing AttendanceStats component here if we refactor it out of StudentPage modal */}
                        </div>
                    </motion.div>
                )}

                {activeTab === "results" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                            <p className="text-slate-500">Results Integration Coming Soon</p>
                        </div>
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
            <p className="mt-1 font-medium text-slate-900">{value || <span className="text-slate-300 italic">Not set</span>}</p>
        </div>
    );
}
