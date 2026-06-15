"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { FaUserTie, FaBuilding, FaIdCard, FaEnvelope, FaPhone, FaCalendarAlt, FaStar, FaBookOpen, FaClock, FaChalkboard } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function FacultyDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "personal-timetable" | "section-timetable">("overview");
    const [expandedMappings, setExpandedMappings] = useState<Record<string, boolean>>({});
    const [studentSearch, setStudentSearch] = useState<Record<string, string>>({});

    const toggleMapping = (id: string) => {
        setExpandedMappings(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSearchChange = (id: string, val: string) => {
        setStudentSearch(prev => ({ ...prev, [id]: val }));
    };

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && session?.user?.role === "FACULTY") {
            fetchDashboardData();
        } else if (status === "authenticated" && session?.user?.role !== "FACULTY") {
            router.push("/");
        }
    }, [status, session, router]);

    const fetchDashboardData = async () => {
        try {
            const res = await fetch("/api/faculty/me/dashboard");
            if (res.ok) {
                const dashboardData = await res.json();
                setData(dashboardData);
            } else {
                console.error("Failed to load dashboard");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
                <LogoSpinner />
                <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading Dashboard...</p>
            </div>
        );
    }

    if (!data || !data.profile) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <FaUserTie className="mx-auto text-4xl text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">Profile Not Found</h2>
                    <p className="text-sm text-slate-500 mt-2">Could not load your faculty profile. Please contact admin.</p>
                </div>
            </div>
        );
    }

    const { profile, subjects, personalTimetable, sectionTimetables, feedback } = data;

    // Helper for Timetable Grid
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Process unique periods for personal timetable
    const uniquePeriods = Array.from(new Set(personalTimetable.map((t: any) => t.period.id)))
        .map(id => personalTimetable.find((t: any) => t.period.id === id)?.period)
        .filter(Boolean)
        .sort((a: any, b: any) => a.order - b.order) as any[];

    // Process section timetables by grouping by sectionId
    const groupedSectionTimetables: Record<string, { sectionName: string, entries: any[], periods: any[] }> = {};
    sectionTimetables.forEach((t: any) => {
        if (!groupedSectionTimetables[t.sectionId]) {
            groupedSectionTimetables[t.sectionId] = {
                sectionName: t.section.name,
                entries: [],
                periods: []
            };
        }
        groupedSectionTimetables[t.sectionId].entries.push(t);
    });
    
    Object.values(groupedSectionTimetables).forEach(group => {
        group.periods = Array.from(new Set(group.entries.map((t: any) => t.period.id)))
            .map(id => group.entries.find((t: any) => t.period.id === id)?.period)
            .filter(Boolean)
            .sort((a: any, b: any) => a.order - b.order) as any[];
    });

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
                
                {/* Header Profile Card */}
                <div className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                    <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700"></div>
                    <div className="px-6 pb-6 sm:px-8">
                        <div className="relative -mt-16 mb-4 flex items-end justify-between">
                            <div className="flex items-end gap-6">
                                <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                                    {profile.photoUrl ? (
                                        <Image 
                                            src={profile.photoUrl} 
                                            alt={profile.empName} 
                                            fill 
                                            className="object-cover" 
                                            onError={(e) => {
                                                (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.empName)}&background=f1f5f9&color=94a3b8`;
                                            }}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                                            <FaUserTie size={48} />
                                        </div>
                                    )}
                                </div>
                                <div className="pb-2">
                                    <h1 className="text-3xl font-bold text-slate-900">{profile.empName}</h1>
                                    <p className="text-lg font-medium text-blue-600">{profile.empCode}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mt-6 border-t border-slate-100 pt-6">
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <FaIdCard />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Designation</p>
                                    <p className="font-medium text-slate-900">{profile.designation || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <FaBuilding />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Department</p>
                                    <p className="font-medium text-slate-900">{profile.department || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <FaEnvelope />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</p>
                                    <p className="font-medium text-slate-900">{profile.email || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-slate-600">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <FaPhone />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mobile</p>
                                    <p className="font-medium text-slate-900">{profile.mobile || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Navigation */}
                <div className="mb-6 flex gap-2 border-b border-slate-200 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`whitespace-nowrap px-4 py-2 font-semibold text-sm transition-colors ${activeTab === "overview" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Dashboard Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("personal-timetable")}
                        className={`whitespace-nowrap px-4 py-2 font-semibold text-sm transition-colors ${activeTab === "personal-timetable" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        My Timetable
                    </button>
                    <button
                        onClick={() => setActiveTab("section-timetable")}
                        className={`whitespace-nowrap px-4 py-2 font-semibold text-sm transition-colors ${activeTab === "section-timetable" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Section Timetables
                    </button>
                </div>

                {/* Content Area */}
                {activeTab === "overview" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Subjects */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="rounded-lg bg-blue-100 p-2 text-blue-600"><FaBookOpen /></div>
                                    <h2 className="text-xl font-bold text-slate-900">Assigned Subjects</h2>
                                </div>
                                
                                {subjects.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {subjects.map((mapping: any) => (
                                            <div key={mapping.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4 hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                                                {mapping.academicYear?.name}
                                                            </span>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                                                                {mapping.subject?.department?.code || "DEPT"} - Year {mapping.subject?.year} Sem {mapping.subject?.semester}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 text-lg leading-tight">{mapping.subject?.name}</h4>
                                                        <p className="text-sm font-mono text-slate-500 mt-1">{mapping.subject?.code}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                                                    <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                                                        <FaChalkboard className="text-slate-400" />
                                                        Section {mapping.section?.name}
                                                    </span>
                                                </div>

                                                <button 
                                                    onClick={() => toggleMapping(mapping.id)}
                                                    className="mt-4 flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                                                >
                                                    <span>{mapping.students?.length || 0} Students Assigned</span>
                                                    <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                                                        {expandedMappings[mapping.id] ? "Hide ▲" : "View ▼"}
                                                    </span>
                                                </button>

                                                {expandedMappings[mapping.id] && (
                                                    <div className="mt-3 p-3 bg-white border border-slate-100 rounded-lg space-y-3">
                                                        <input 
                                                            type="text"
                                                            placeholder="Search students..."
                                                            value={studentSearch[mapping.id] || ""}
                                                            onChange={(e) => handleSearchChange(mapping.id, e.target.value)}
                                                            className="w-full p-2 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none text-slate-700"
                                                        />
                                                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                                                            {(() => {
                                                                const query = (studentSearch[mapping.id] || "").toLowerCase();
                                                                const filtered = (mapping.students || []).filter((s: any) => 
                                                                    s.name.toLowerCase().includes(query) || 
                                                                    s.rollNumber.toLowerCase().includes(query)
                                                                );
                                                                if (filtered.length === 0) {
                                                                    return <p className="text-slate-400 text-center py-4 italic text-[11px]">No matching students</p>;
                                                                }
                                                                return filtered.map((student: any) => (
                                                                    <div key={student.id} className="flex justify-between items-center py-2 hover:bg-slate-50 px-1 rounded transition-colors">
                                                                        <span className="font-semibold text-slate-700">{student.name}</span>
                                                                        <span className="font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                                                            {student.rollNumber}
                                                                        </span>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                                        <p>No subjects assigned currently.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Feedback */}
                        <div className="space-y-8">
                            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600"><FaStar /></div>
                                    <h2 className="text-xl font-bold text-slate-900">Feedback Overview</h2>
                                </div>

                                <div className="text-center mb-8 border-b border-slate-100 pb-8">
                                    <span className="text-5xl font-black text-slate-800">
                                        {Number(feedback.overallAverage).toFixed(2)}
                                    </span>
                                    <div className="flex items-center justify-center text-yellow-500 mt-2 mb-1">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <FaStar key={s} className={s <= Math.round(Number(feedback.overallAverage)) ? "text-yellow-500" : "text-slate-200"} size={20} />
                                        ))}
                                    </div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Overall Rating ({feedback.totalResponses} Responses)
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Subject-wise Rating</h3>
                                    {feedback.subjectWise.length > 0 ? (
                                        <div className="space-y-4">
                                            {feedback.subjectWise.map((sf: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                                                    <div className="flex-1 pr-4">
                                                        {sf.subjectId ? (
                                                            <Link href={`/faculty/feedback/analysis?subjectId=${sf.subjectId}${sf.sectionId ? `&sectionId=${sf.sectionId}` : ''}`} className="hover:text-fuchsia-600 hover:underline">
                                                                <p className="text-sm font-bold text-slate-800 truncate">{sf.name}</p>
                                                            </Link>
                                                        ) : (
                                                            <p className="text-sm font-bold text-slate-800 truncate">{sf.name}</p>
                                                        )}
                                                        <div className="mt-0.5 space-y-0.5">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded inline-block">
                                                                {sf.departmentCode || "DEPT"}{sf.batchName ? ` (${sf.batchName})` : ''} - Year {sf.year || "N/A"} Sem {sf.semester || "N/A"} - Section {sf.sectionName || "N/A"}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500">{sf.count} responses</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                                        <span className="font-bold text-slate-700">
                                                            {Number(sf.average).toFixed(2)}
                                                        </span>
                                                        <FaStar className="text-yellow-500" size={14} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 text-center italic">No subject-wise feedback available.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === "personal-timetable" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="rounded-lg bg-blue-100 p-2 text-blue-600"><FaClock /></div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">My Assigned Timetable</h2>
                                    <p className="text-sm text-slate-500">Shows periods where you are assigned to teach.</p>
                                </div>
                            </div>

                            {personalTimetable.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="px-4 py-3 font-bold border-b border-r border-slate-200 w-32">Day</th>
                                                {uniquePeriods.map(p => (
                                                    <th key={p.id} className="px-4 py-3 font-semibold text-center border-b border-r border-slate-200 last:border-r-0">
                                                        {p.name}<br />
                                                        <span className="text-[10px] font-normal text-slate-400">{p.startTime} - {p.endTime}</span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {daysOfWeek.map((day, dayIndex) => {
                                                const dayNum = dayIndex + 1;
                                                return (
                                                    <tr key={day} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                                        <td className="px-4 py-4 font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200">{day}</td>
                                                        {uniquePeriods.map(p => {
                                                            const entry = personalTimetable.find((t: any) => t.dayOfWeek === dayNum && t.periodId === p.id);
                                                            return (
                                                                <td key={p.id} className="p-2 border-r border-slate-100 last:border-r-0 text-center align-middle h-20">
                                                                    {entry ? (
                                                                        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-50 border border-indigo-100 shadow-sm h-full w-full min-w-[100px]">
                                                                            <span className="font-bold text-indigo-700 text-xs text-center">{entry.subject?.shortName || entry.subject?.code}</span>
                                                                            <span className="text-[10px] font-semibold text-slate-600 mt-1 bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-100">Sec: {entry.section?.name}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-slate-300 text-xs">-</div>
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
                                <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                                    <FaClock className="mx-auto text-4xl text-slate-300 mb-4" />
                                    <p className="font-medium text-slate-600">No Timetable Available</p>
                                    <p className="text-sm mt-1">Your assigned timetable is empty.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {activeTab === "section-timetable" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                        {Object.keys(groupedSectionTimetables).length > 0 ? (
                            Object.values(groupedSectionTimetables).map((group, idx) => (
                                <div key={idx} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="rounded-lg bg-green-100 p-2 text-green-600"><FaChalkboard /></div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900">Section {group.sectionName} Timetable</h2>
                                            <p className="text-sm text-slate-500">Full class schedule for this section.</p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                                        <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                                            <thead className="bg-slate-50 text-slate-600">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold border-b border-r border-slate-200 w-32">Day</th>
                                                    {group.periods.map(p => (
                                                        <th key={p.id} className="px-4 py-3 font-semibold text-center border-b border-r border-slate-200 last:border-r-0">
                                                            {p.name}<br />
                                                            <span className="text-[10px] font-normal text-slate-400">{p.startTime} - {p.endTime}</span>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {daysOfWeek.map((day, dayIndex) => {
                                                    const dayNum = dayIndex + 1;
                                                    return (
                                                        <tr key={day} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                                                            <td className="px-4 py-4 font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200">{day}</td>
                                                            {group.periods.map(p => {
                                                                const entry = group.entries.find((t: any) => t.dayOfWeek === dayNum && t.periodId === p.id);
                                                                // Highlight if this is the current faculty's subject
                                                                const isMySubject = subjects.some((s: any) => s.subjectId === entry?.subjectId && s.sectionId === entry?.sectionId);
                                                                
                                                                return (
                                                                    <td key={p.id} className={`p-2 border-r border-slate-100 last:border-r-0 text-center align-middle h-20 ${isMySubject ? 'bg-indigo-50/50' : ''}`}>
                                                                        {entry ? (
                                                                            <div className={`flex flex-col items-center justify-center p-2 rounded-lg h-full w-full min-w-[100px] ${isMySubject ? 'bg-indigo-100 border border-indigo-200 shadow-sm' : 'bg-slate-50 border border-slate-100'}`}>
                                                                                <span className={`font-bold text-xs text-center ${isMySubject ? 'text-indigo-800' : 'text-slate-700'}`}>
                                                                                    {entry.subject?.shortName || entry.subject?.code || "Subject"}
                                                                                </span>
                                                                                {isMySubject && <span className="mt-1 bg-indigo-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">You</span>}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-slate-300 text-xs">-</div>
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
                                </div>
                            ))
                        ) : (
                            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center py-16">
                                <FaChalkboard className="mx-auto text-4xl text-slate-300 mb-4" />
                                <p className="font-medium text-slate-600">No Section Timetables Available</p>
                                <p className="text-sm text-slate-500 mt-1">You are not assigned to any sections with timetables yet.</p>
                            </div>
                        )}
                    </motion.div>
                )}

            </div>
        </div>
    );
}
