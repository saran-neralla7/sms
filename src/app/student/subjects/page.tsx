"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
    FaBook, FaCalendarAlt, FaChalkboardTeacher, FaClipboardCheck, 
    FaTimes, FaBookOpen, FaCalendarDay, FaInfoCircle, FaFileInvoice,
    FaArrowRight, FaHourglassHalf, FaRegCalendarTimes, FaPercentage
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function StudentAcademicsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [studentProfile, setStudentProfile] = useState<any>(null);
    
    // Page tabs: "subjects" | "calendar"
    const [activeConsoleTab, setActiveConsoleTab] = useState<"subjects" | "calendar">("subjects");
    
    // Filters for subjects
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [selectedSem, setSelectedSem] = useState<string>("");
    const [subjects, setSubjects] = useState<any[]>([]);
    const [subjectsLoading, setSubjectsLoading] = useState(false);

    // Subject modal state
    const [selectedSubject, setSelectedSubject] = useState<any>(null);
    const [modalActiveTab, setModalActiveTab] = useState<"diary" | "lecturePlan">("diary");
    const [diaryRecords, setDiaryRecords] = useState<any[]>([]);
    const [lecturePlan, setLecturePlan] = useState<any[]>([]);
    const [modalDataLoading, setModalDataLoading] = useState(false);

    // Calendar data state
    const [calendarData, setCalendarData] = useState<any>(null);
    const [calendarLoading, setCalendarLoading] = useState(false);

    const getAvailableYears = () => {
        if (!studentProfile) return [1, 2, 3, 4];
        const currentYear = parseInt(studentProfile.year) || 1;
        const years = [];
        for (let y = 1; y <= currentYear; y++) {
            years.push(y);
        }
        return years;
    };

    const getAvailableSemesters = (yearStr: string) => {
        if (!studentProfile) return [1, 2];
        const currentYear = parseInt(studentProfile.year) || 1;
        const currentSem = parseInt(studentProfile.semester) || 1;
        const selectedY = parseInt(yearStr) || 1;

        if (selectedY < currentYear) {
            return [1, 2];
        } else {
            const sems = [];
            for (let s = 1; s <= currentSem; s++) {
                sems.push(s);
            }
            return sems;
        }
    };

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && session?.user?.role === "STUDENT") {
            fetchInitialData();
        } else if (status === "authenticated" && session?.user?.role !== "STUDENT") {
            router.push("/");
        }
    }, [status, session, router]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/students/me");
            if (res.ok) {
                const profile = await res.json();
                setStudentProfile(profile);
                setSelectedYear(profile.year);
                setSelectedSem(profile.semester);
                // Load subjects for student's current year/semester
                fetchSubjects(profile.year, profile.semester);
            }
        } catch (e) {
            console.error("Error fetching student profile:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubjects = async (yr: string, sem: string) => {
        try {
            setSubjectsLoading(true);
            const res = await fetch(`/api/students/me/subjects?year=${yr}&semester=${sem}`);
            if (res.ok) {
                setSubjects(await res.json());
            } else {
                setSubjects([]);
            }
        } catch (e) {
            console.error("Error loading subjects:", e);
            setSubjects([]);
        } finally {
            setSubjectsLoading(false);
        }
    };

    const fetchCalendar = async () => {
        try {
            setCalendarLoading(true);
            const res = await fetch("/api/students/me/academic-calendar");
            if (res.ok) {
                setCalendarData(await res.json());
            }
        } catch (e) {
            console.error("Error loading calendar:", e);
        } finally {
            setCalendarLoading(false);
        }
    };

    // Load subjects when filters change
    useEffect(() => {
        if (selectedYear && selectedSem && studentProfile) {
            fetchSubjects(selectedYear, selectedSem);
        }
    }, [selectedYear, selectedSem]);

    // Fetch calendar if calendar tab is selected
    useEffect(() => {
        if (activeConsoleTab === "calendar" && !calendarData) {
            fetchCalendar();
        }
    }, [activeConsoleTab]);

    const handleOpenSubjectModal = async (subject: any) => {
        setSelectedSubject(subject);
        setModalActiveTab("diary");
        setModalDataLoading(true);

        try {
            const [diaryRes, lectureRes] = await Promise.all([
                fetch(`/api/students/me/subject-diary?subjectId=${subject.id}&year=${selectedYear}&semester=${selectedSem}`),
                fetch(`/api/students/me/subject-lecture-plan?subjectId=${subject.id}&year=${selectedYear}&semester=${selectedSem}`)
            ]);

            if (diaryRes.ok) {
                setDiaryRecords(await diaryRes.json());
            } else {
                setDiaryRecords([]);
            }

            if (lectureRes.ok) {
                const lpData = await lectureRes.json();
                setLecturePlan(lpData.lecturePlan || []);
            } else {
                setLecturePlan([]);
            }

        } catch (e) {
            console.error("Error fetching modal details:", e);
            setDiaryRecords([]);
            setLecturePlan([]);
        } finally {
            setModalDataLoading(false);
        }
    };

    // Calculate quick attendance statistics for the selected subject
    const getAttendanceStats = () => {
        if (diaryRecords.length === 0) return { total: 0, present: 0, absent: 0, percentage: 0 };
        const total = diaryRecords.length;
        const present = diaryRecords.filter(r => r.status === "Present").length;
        const absent = total - present;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        return { total, present, absent, percentage };
    };

    const stats = getAttendanceStats();

    if (loading || status === "loading") {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <LogoSpinner />
                <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading Academics...</p>
            </div>
        );
    }

    const regularSubjects = subjects.filter(sub => {
        const isOpenElective = sub.departmentId !== studentProfile?.departmentId || 
                              sub.electiveSlotRelation?.name?.toUpperCase().includes("OE") ||
                              sub.electiveSlotRelation?.name?.toUpperCase().includes("OPEN") ||
                              sub.name?.toUpperCase().includes("OPEN ELECTIVE");
        return !isOpenElective;
    });

    const openElectiveSubjects = subjects.filter(sub => {
        const isOpenElective = sub.departmentId !== studentProfile?.departmentId || 
                              sub.electiveSlotRelation?.name?.toUpperCase().includes("OE") ||
                              sub.electiveSlotRelation?.name?.toUpperCase().includes("OPEN") ||
                              sub.name?.toUpperCase().includes("OPEN ELECTIVE");
        return isOpenElective;
    });

    return (
        <div className="mx-auto max-w-full pb-10">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-inner">
                        <FaBookOpen size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Academics & Calendar</h1>
                        <p className="text-sm text-slate-500 font-semibold mt-1">
                            Access subject history, teaching logs, lecture plans, and calendar.
                        </p>
                    </div>
                </div>

                {/* Console tabs switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto border border-slate-200">
                    <button
                        onClick={() => setActiveConsoleTab("subjects")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeConsoleTab === "subjects"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <FaBook size={14} /> Subjects & Diaries
                    </button>
                    <button
                        onClick={() => setActiveConsoleTab("calendar")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeConsoleTab === "calendar"
                                ? "bg-white text-indigo-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <FaCalendarAlt size={14} /> Academic Calendar
                    </button>
                </div>
            </div>

            {/* Console Content */}
            {activeConsoleTab === "subjects" ? (
                <div>
                    {/* Filters Row */}
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Filter Semester</span>
                        </div>
                        <div className="flex gap-4">
                            <div>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => {
                                        const newYear = e.target.value;
                                        setSelectedYear(newYear);
                                        const allowedSems = getAvailableSemesters(newYear);
                                        if (!allowedSems.map(String).includes(selectedSem)) {
                                            setSelectedSem(String(allowedSems[0]));
                                        }
                                    }}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                                >
                                    {getAvailableYears().map((y) => (
                                        <option key={y} value={String(y)}>
                                            {y === 1 ? "1st Year" : y === 2 ? "2nd Year" : y === 3 ? "3rd Year" : `${y}th Year`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <select
                                    value={selectedSem}
                                    onChange={(e) => setSelectedSem(e.target.value)}
                                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                                >
                                    {getAvailableSemesters(selectedYear).map((s) => (
                                        <option key={s} value={String(s)}>
                                            {s === 1 ? "1st Sem" : "2nd Sem"}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Subjects Grid */}
                    {subjectsLoading ? (
                        <div className="flex justify-center py-20">
                            <LogoSpinner />
                        </div>
                    ) : subjects.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
                            <FaBook className="mx-auto text-5xl text-slate-300 mb-4 animate-pulse" />
                            <h3 className="text-xl font-bold text-slate-800">No Subjects Found</h3>
                            <p className="text-sm text-slate-500 mt-2">
                                There are no core or elective subjects configured for you in Year {selectedYear} Sem {selectedSem}.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Regular Subjects Section */}
                            {regularSubjects.length > 0 && (
                                <div>
                                    <div className="mb-4 flex items-center gap-3">
                                        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Core & Professional Electives</h4>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {regularSubjects.map((sub) => {
                                            const isElective = sub.isElective || (sub.type && sub.type.toUpperCase().includes("ELECTIVE"));
                                            return (
                                                <div 
                                                    key={sub.id}
                                                    onClick={() => handleOpenSubjectModal(sub)}
                                                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-xl hover:border-indigo-300 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                                                >
                                                    {/* Colored card top band */}
                                                    <div className={`absolute top-0 left-0 right-0 h-2 ${
                                                        isElective ? "bg-emerald-500" : sub.type === "LAB" ? "bg-purple-500" : "bg-indigo-600"
                                                    }`}></div>

                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                                                isElective 
                                                                    ? "text-emerald-700 bg-emerald-100/60" 
                                                                    : sub.type === "LAB"
                                                                        ? "text-purple-700 bg-purple-100/60"
                                                                        : "text-indigo-700 bg-indigo-100/60"
                                                            }`}>
                                                                {isElective ? "Elective" : sub.type || "Theory"}
                                                            </span>
                                                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                                {sub.code}
                                                            </span>
                                                        </div>

                                                        <h3 className="font-extrabold text-slate-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">
                                                            {sub.name}
                                                        </h3>
                                                    </div>

                                                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 min-w-0 pr-4">
                                                            {sub.faculty ? (
                                                                <>
                                                                    <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500 font-bold text-xs uppercase shadow-inner">
                                                                        {sub.faculty.empName[0]}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Instructor</p>
                                                                        <p className="text-xs font-semibold text-slate-700 truncate">{sub.faculty.empName}</p>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">Faculty Unassigned</span>
                                                            )}
                                                        </div>

                                                        <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                                                            View Diary <FaArrowRight size={10} />
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Open Electives Section */}
                            {openElectiveSubjects.length > 0 && (
                                <div className="pt-4">
                                    <div className="mb-4 flex items-center gap-3">
                                        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Open Electives</h4>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {openElectiveSubjects.map((sub) => {
                                            return (
                                                <div 
                                                    key={sub.id}
                                                    onClick={() => handleOpenSubjectModal(sub)}
                                                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                                                >
                                                    {/* Colored card top band */}
                                                    <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-emerald-700 bg-emerald-100/60">
                                                                Open Elective
                                                            </span>
                                                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                                {sub.code}
                                                            </span>
                                                        </div>

                                                        <h3 className="font-extrabold text-slate-900 text-lg leading-tight group-hover:text-emerald-600 transition-colors">
                                                            {sub.name}
                                                        </h3>
                                                    </div>

                                                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 min-w-0 pr-4">
                                                            {sub.faculty ? (
                                                                <>
                                                                    <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500 font-bold text-xs uppercase shadow-inner">
                                                                        {sub.faculty.empName[0]}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Instructor</p>
                                                                        <p className="text-xs font-semibold text-slate-700 truncate">{sub.faculty.empName}</p>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">Faculty Unassigned</span>
                                                            )}
                                                        </div>

                                                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                                                            View Diary <FaArrowRight size={10} />
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Academic Calendar tab view */
                <div>
                    {calendarLoading ? (
                        <div className="flex justify-center py-20">
                            <LogoSpinner />
                        </div>
                    ) : !calendarData ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
                            <FaCalendarDay className="mx-auto text-5xl text-slate-300 mb-4 animate-pulse" />
                            <h3 className="text-xl font-bold text-slate-800">Calendar Data Unavailable</h3>
                            <p className="text-sm text-slate-500 mt-2">
                                The academic calendar information is not available for the active academic year.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Semester Timelines */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                                    <FaFileInvoice className="text-indigo-600" size={18} />
                                    <h3 className="font-extrabold text-slate-800 text-lg">Academic Year Semester Timelines ({calendarData.academicYear})</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-sm">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                                                <th className="p-4">Year & Sem</th>
                                                <th className="p-4">Classwork Period</th>
                                                <th className="p-4">Mid Exams 1</th>
                                                <th className="p-4">Mid Exams 2</th>
                                                <th className="p-4">End Semester Exams</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calendarData.timelines.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">No semester timelines configured.</td>
                                                </tr>
                                            ) : (
                                                calendarData.timelines.map((t: any) => (
                                                    <tr key={t.id} className="hover:bg-slate-50/50 font-medium">
                                                        <td className="p-4 text-slate-900 font-bold">
                                                            Year {t.year} Sem {t.semester}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {t.classworkStart} <span className="text-slate-400 font-normal mx-1">to</span> {t.classworkEnd}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {t.mid1Start} <span className="text-slate-400 font-normal mx-1">to</span> {t.mid1End}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {t.mid2Start} <span className="text-slate-400 font-normal mx-1">to</span> {t.mid2End}
                                                        </td>
                                                        <td className="p-4 text-slate-600">
                                                            {t.semExamStart} <span className="text-slate-400 font-normal mx-1">to</span> {t.semExamEnd}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Holidays List */}
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                                    <FaCalendarDay className="text-rose-500" size={18} />
                                    <h3 className="font-extrabold text-slate-800 text-lg">List of College Holidays</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-left text-sm">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                                                <th className="p-4 w-48">Date</th>
                                                <th className="p-4">Holiday Occasion</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calendarData.holidays.length === 0 ? (
                                                <tr>
                                                    <td colSpan={2} className="p-8 text-center text-slate-400 italic">No college holidays configured for this year.</td>
                                                </tr>
                                            ) : (
                                                calendarData.holidays.map((h: any) => (
                                                    <tr key={h.id} className="hover:bg-slate-50/50 font-medium">
                                                        <td className="p-4 text-rose-600 font-bold font-mono">
                                                            {h.date} {h.endDate ? `to ${h.endDate}` : ""}
                                                        </td>
                                                        <td className="p-4 text-slate-800 font-semibold">{h.name}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Subject details MODAL */}
            {selectedSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all duration-300">
                    <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-100 transform scale-100">
                        {/* Modal Header */}
                        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between text-white">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase bg-white/20 px-2 py-0.5 rounded tracking-wider">
                                        {selectedSubject.code}
                                    </span>
                                    <span className="text-[10px] font-black uppercase bg-indigo-500/80 px-2 py-0.5 rounded tracking-wider">
                                        {selectedSubject.type}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-white leading-tight">
                                    {selectedSubject.name}
                                </h2>
                            </div>
                            <button
                                onClick={() => setSelectedSubject(null)}
                                className="p-2 text-slate-400 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                            >
                                <FaTimes size={18} />
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="border-b border-slate-200 bg-slate-50 px-6 flex items-center justify-between">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setModalActiveTab("diary")}
                                    className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                                        modalActiveTab === "diary"
                                            ? "border-indigo-600 text-indigo-600"
                                            : "border-transparent text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    <FaClipboardCheck size={14} /> Teaching Diary & Attendance
                                </button>
                                <button
                                    onClick={() => setModalActiveTab("lecturePlan")}
                                    className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                                        modalActiveTab === "lecturePlan"
                                            ? "border-indigo-600 text-indigo-600"
                                            : "border-transparent text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    <FaBook size={14} /> Lecture Plan
                                </button>
                            </div>

                            {/* Mapped Instructor label */}
                            {selectedSubject.faculty && (
                                <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                                    <FaChalkboardTeacher className="text-slate-400" />
                                    {selectedSubject.faculty.empName}
                                </span>
                            )}
                        </div>

                        {/* Modal Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                            {modalDataLoading ? (
                                <div className="flex justify-center py-20">
                                    <LogoSpinner />
                                </div>
                            ) : modalActiveTab === "diary" ? (
                                /* Teaching Diary Content */
                                <div className="space-y-6">
                                    {/* Stats panel */}
                                    {diaryRecords.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-inner">
                                            <div className="text-center p-2 border-r border-slate-100 last:border-r-0">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Conducted Periods</p>
                                                <p className="text-2xl font-black text-slate-850 mt-1">{stats.total}</p>
                                            </div>
                                            <div className="text-center p-2 border-r border-slate-100 last:border-r-0">
                                                <p className="text-[10px] font-black uppercase text-green-500 tracking-wider">Periods Present</p>
                                                <p className="text-2xl font-black text-green-600 mt-1">{stats.present}</p>
                                            </div>
                                            <div className="text-center p-2 border-r border-slate-100 last:border-r-0">
                                                <p className="text-[10px] font-black uppercase text-rose-500 tracking-wider">Periods Absent</p>
                                                <p className="text-2xl font-black text-rose-600 mt-1">{stats.absent}</p>
                                            </div>
                                            <div className="text-center p-2 last:border-r-0">
                                                <p className="text-[10px] font-black uppercase text-indigo-500 tracking-wider flex items-center justify-center gap-1">
                                                    <FaPercentage size={9} /> Attendance Pct
                                                </p>
                                                <p className={`text-2xl font-black mt-1 ${
                                                    stats.percentage >= 75 ? 'text-indigo-600' : 'text-amber-600'
                                                }`}>
                                                    {stats.percentage}%
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {diaryRecords.length === 0 ? (
                                        <div className="text-center py-12 rounded-xl bg-white border border-slate-200 p-8 text-slate-400">
                                            <FaRegCalendarTimes className="mx-auto text-4xl text-slate-350 mb-3" />
                                            <p className="font-semibold text-slate-500">No sessions recorded yet</p>
                                            <p className="text-xs text-slate-400 mt-1">No attendance or teaching diary entry exists for this subject.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                                            <th className="p-4 w-32">Date</th>
                                                            <th className="p-4 w-36">Period</th>
                                                            <th className="p-4">Topics Taught (Teaching Diary)</th>
                                                            <th className="p-4 w-28 text-center">Your Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {diaryRecords.map((record) => (
                                                            <tr key={record.id} className="hover:bg-slate-50/50">
                                                                <td className="p-4 font-bold text-slate-800 font-mono text-xs">
                                                                    {record.date}
                                                                </td>
                                                                <td className="p-4 text-slate-600 font-medium text-xs">
                                                                    {record.period ? (
                                                                        <div>
                                                                            <span className="font-extrabold text-indigo-600">{record.period.name}</span>
                                                                            <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                                                                                {record.period.startTime} - {record.period.endTime}
                                                                            </span>
                                                                        </div>
                                                                    ) : "-"}
                                                                </td>
                                                                <td className="p-4">
                                                                    {record.facultyAddedDiary ? (
                                                                        <div className="text-slate-800 text-xs font-semibold leading-relaxed">
                                                                            {record.topicsTaught}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[11px] font-medium text-slate-400 italic flex items-center gap-1">
                                                                            <FaHourglassHalf className="text-slate-350" size={10} />
                                                                            Pending entry by faculty member
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${
                                                                        record.status === "Present" 
                                                                            ? "bg-green-100 text-green-800 border border-green-200" 
                                                                            : record.status === "Absent"
                                                                                ? "bg-red-100 text-red-800 border border-red-200"
                                                                                : "bg-slate-100 text-slate-800 border border-slate-200"
                                                                    }`}>
                                                                        {record.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Lecture Plan Content */
                                <div className="space-y-4">
                                    {lecturePlan.length === 0 ? (
                                        <div className="text-center py-12 rounded-xl bg-white border border-slate-200 p-8 text-slate-400">
                                            <FaInfoCircle className="mx-auto text-4xl text-slate-350 mb-3" />
                                            <p className="font-semibold text-slate-500">No lecture plan available</p>
                                            <p className="text-xs text-slate-400 mt-1">Syllabus unit and period timeline has not been uploaded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                                            <th className="p-4 w-28">Unit</th>
                                                            <th className="p-4">Topic / Syllabus Content</th>
                                                            <th className="p-4 w-32 text-center">Planned Periods</th>
                                                            <th className="p-4 w-40 text-center">Actual Completion Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-medium">
                                                        {lecturePlan.map((item: any, idx: number) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 text-xs">
                                                                <td className="p-4 font-bold text-slate-800 uppercase tracking-wider">
                                                                    {item.unit || `Unit ${idx + 1}`}
                                                                </td>
                                                                <td className="p-4 text-slate-700 font-semibold leading-relaxed">
                                                                    {item.topic}
                                                                </td>
                                                                <td className="p-4 text-center font-bold text-slate-600">
                                                                    {item.plannedPeriods || "-"}
                                                                </td>
                                                                <td className="p-4 text-center font-mono font-bold text-slate-500">
                                                                    {item.actualDate || (
                                                                        <span className="text-[10px] text-slate-400 font-sans font-medium italic">Not completed yet</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex justify-end">
                            <button
                                onClick={() => setSelectedSubject(null)}
                                className="px-5 py-2.5 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 transition-colors shadow-sm"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
