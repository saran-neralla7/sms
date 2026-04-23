"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Faculty } from "@/types";
import { motion } from "framer-motion";
import { FaArrowLeft, FaCalendarAlt, FaEnvelope, FaMapMarkerAlt, FaPhone, FaUserTie, FaBuilding, FaIdCard, FaLayerGroup, FaStar } from "react-icons/fa";
import Image from "next/image";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate } from "@/lib/dateUtils";

const InfoItem = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) => (
    <div className="flex flex-col border-b border-slate-100 pb-2 last:border-0 last:pb-0">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {icon && <span className="text-slate-400">{icon}</span>}
            {label}
        </span>
        <span className="text-sm font-medium text-slate-900">{value || "-"}</span>
    </div>
);

export default function FacultyProfilePage() {
    const params = useParams();
    const router = useRouter();
    const [faculty, setFaculty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "subjects" | "timetable" | "feedback">("overview");
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    
    const [timetables, setTimetables] = useState<any[]>([]);
    const [timetablesLoading, setTimetablesLoading] = useState(false);

    useEffect(() => {
        if (params?.id) {
            fetchFaculty();
        }
    }, [params?.id]);

    useEffect(() => {
        if (activeTab === "timetable" && faculty && timetables.length === 0) {
            fetchTimetable();
        }
    }, [activeTab, faculty]);

    const fetchFaculty = async () => {
        try {
            const res = await fetch(`/api/faculty/${params?.id}`);
            if (res.ok) {
                const data = await res.json();
                setFaculty(data);
            } else {
                router.push("/admin/faculty");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTimetable = async () => {
        setTimetablesLoading(true);
        try {
            const res = await fetch(`/api/faculty/${params?.id}/timetable`);
            if (res.ok) {
                const data = await res.json();
                setTimetables(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setTimetablesLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 flex-col items-center justify-center space-y-4">
                <LogoSpinner />
                <p className="text-sm font-medium text-slate-500 animate-pulse">Loading Faculty Profile...</p>
            </div>
        );
    }

    if (!faculty) return null;

    // Helper for Timetable Grid
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    // Get unique periods for table headers based on the fetched timetables
    const uniquePeriods = Array.from(new Set(timetables.map(t => t.period.id)))
        .map(id => timetables.find(t => t.period.id === id)?.period)
        .filter(Boolean)
        .sort((a, b) => a.order - b.order);

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
                                className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-slate-50 shadow-md sm:mx-0 sm:h-40 sm:w-40 cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center bg-slate-100"
                                onClick={() => faculty.photoUrl && setIsPhotoModalOpen(true)}
                            >
                                {faculty.photoUrl ? (
                                    <Image
                                        src={faculty.photoUrl}
                                        alt={faculty.empName}
                                        fill
                                        className="object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(faculty.empName)}&background=f1f5f9&color=94a3b8`;
                                            (e.currentTarget as HTMLImageElement).style.objectFit = 'cover';
                                        }}
                                    />
                                ) : (
                                    <FaUserTie size={64} className="text-slate-300" />
                                )}
                            </div>
                        </div>

                        <div className="flex-1 space-y-4 pt-2 text-center sm:text-left">
                            <div className="flex flex-col">
                                <h1 className="text-2xl font-bold text-slate-900">{faculty.empName}</h1>
                                <p className="font-mono text-lg text-blue-600">{faculty.empCode}</p>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600 sm:justify-start">
                                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                                    <FaBuilding className="text-slate-400" />
                                    <span>{faculty.department?.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1">
                                    <FaIdCard className="text-slate-400" />
                                    <span>{faculty.designation}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap justify-center gap-2 sm:justify-start pt-2">
                                <button
                                    onClick={() => setActiveTab("overview")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "overview" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setActiveTab("subjects")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "subjects" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Subjects
                                </button>
                                <button
                                    onClick={() => setActiveTab("timetable")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "timetable" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Timetable
                                </button>
                                <button
                                    onClick={() => setActiveTab("feedback")}
                                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "feedback" ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                        }`}
                                >
                                    Feedback
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
                                <InfoItem label="Short Name" value={faculty.shortName} />
                                <InfoItem label="Gender" value={faculty.gender} />
                                <InfoItem label="Date of Birth" value={faculty.dob ? formatISTDate(faculty.dob) : "-"} icon={<FaCalendarAlt />} />
                                <InfoItem label="Blood Group" value={faculty.bloodGroup} />
                                <InfoItem label="Father's Name" value={faculty.fatherName} />
                                <InfoItem label="Mother's Name" value={faculty.motherName} />
                                <InfoItem label="Qualification" value={faculty.qualification} />
                                <InfoItem label="Aadhar Number" value={faculty.aadharNo} />
                                <InfoItem label="PAN Number" value={faculty.panNo} />
                                <div className="sm:col-span-2">
                                    <InfoItem label="Address" value={faculty.address} icon={<FaMapMarkerAlt />} />
                                </div>
                            </div>
                        </div>

                        {/* Contact & Professional Details */}
                        <div className="flex flex-col gap-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-bold text-slate-900">Contact Information</h3>
                                <div className="flex flex-col gap-4">
                                    <InfoItem label="Email ID" value={faculty.email} icon={<FaEnvelope />} />
                                    <InfoItem label="Mobile" value={faculty.mobile} icon={<FaPhone />} />
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-bold text-slate-900">Employment Details</h3>
                                <div className="flex flex-col gap-4">
                                    <InfoItem label="Date of Joining" value={faculty.joinDate ? formatISTDate(faculty.joinDate) : "-"} icon={<FaCalendarAlt />} />
                                    <InfoItem label="Date of Resignation" value={faculty.resignDate ? formatISTDate(faculty.resignDate) : "-"} icon={<FaCalendarAlt />} />
                                    <InfoItem label="Basic Salary" value={faculty.basicSalary ? `₹${faculty.basicSalary}` : "-"} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === "subjects" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-bold text-slate-900">Assigned Subjects</h3>
                            {faculty.FacultySubjectMapping && faculty.FacultySubjectMapping.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {faculty.FacultySubjectMapping.map((mapping: any) => (
                                        <div key={mapping.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                                    {mapping.academicYear?.name}
                                                </span>
                                                <h4 className="font-bold text-slate-900">{mapping.subject?.name}</h4>
                                                <p className="text-xs text-slate-500 font-mono">{mapping.subject?.code}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 border border-slate-200 shadow-sm">
                                                        Section: {mapping.section?.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    <p>No subjects assigned yet.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {activeTab === "timetable" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-bold text-slate-900">Weekly Timetable</h3>
                            {timetablesLoading ? (
                                <div className="flex h-40 items-center justify-center">
                                    <LogoSpinner />
                                </div>
                            ) : timetables.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold border-r border-slate-200">Day / Period</th>
                                                {uniquePeriods.map(p => (
                                                    <th key={p.id} className="px-4 py-3 font-semibold text-center border-r border-slate-200 last:border-0">
                                                        {p.name}<br />
                                                        <span className="text-xs font-normal text-slate-400">{p.startTime} - {p.endTime}</span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                                            {daysOfWeek.map((day, dayIndex) => {
                                                const dayNumber = dayIndex + 1; // 1=Monday
                                                return (
                                                    <tr key={day} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-4 font-bold text-slate-700 bg-slate-50 border-r border-slate-200">{day}</td>
                                                        {uniquePeriods.map(p => {
                                                            const entry = timetables.find(t => t.dayOfWeek === dayNumber && t.periodId === p.id);
                                                            return (
                                                                <td key={p.id} className="px-2 py-2 text-center border-r border-slate-100 last:border-0 align-middle">
                                                                    {entry ? (
                                                                        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 border border-blue-100 min-h-[4rem]">
                                                                            <span className="font-semibold text-blue-700 text-xs">{entry.subject?.code}</span>
                                                                            <span className="text-[10px] font-bold text-slate-600 mt-1">{entry.section?.name}</span>
                                                                            {entry.isLab && <span className="mt-1 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 uppercase">Lab</span>}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="min-h-[4rem] text-slate-300 flex items-center justify-center text-xs">-</div>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    <p>No timetable entries found for assigned subjects.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {activeTab === "feedback" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="mb-4 text-lg font-bold text-slate-900">Feedback Overview</h3>
                            {faculty.FeedbackResponse && faculty.FeedbackResponse.length > 0 ? (
                                <div className="space-y-6">
                                    {/* Overall Calculation could go here. For now, list them. */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {faculty.FeedbackResponse.map((fb: any) => (
                                            <div key={fb.id} className="rounded-lg border border-slate-100 p-4 shadow-sm hover:shadow transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{fb.subject?.name || "General Feedback"}</h4>
                                                        <p className="text-xs text-slate-500">From Form: {fb.form?.title}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold border border-yellow-200">
                                                        <FaStar /> {fb.overallRating} / 5
                                                    </div>
                                                </div>
                                                {fb.comments && (
                                                    <div className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded italic border border-slate-100">
                                                        "{fb.comments}"
                                                    </div>
                                                )}
                                                <div className="mt-2 text-[10px] text-slate-400 text-right">
                                                    {formatISTDate(fb.createdAt)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    <p>No feedback recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Photo Modal */}
            <Modal
                isOpen={isPhotoModalOpen}
                onClose={() => setIsPhotoModalOpen(false)}
                title="Faculty Photo"
                maxWidth="max-w-xl"
            >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                    {faculty.photoUrl && (
                        <Image
                            src={faculty.photoUrl}
                            alt={faculty.empName}
                            fill
                            className="object-contain"
                            onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(faculty.empName)}&background=f1f5f9&color=94a3b8`;
                                (e.currentTarget as HTMLImageElement).style.objectFit = 'contain';
                            }}
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
}
