"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaCalendarAlt, FaClock, FaChalkboardTeacher, FaExclamationTriangle } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

const DAYS = [
    { id: 1, name: "Monday" },
    { id: 2, name: "Tuesday" },
    { id: 3, name: "Wednesday" },
    { id: 4, name: "Thursday" },
    { id: 5, name: "Friday" },
    { id: 6, name: "Saturday" },
];

export default function StudentTimetablePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState<any>(null);
    const [periods, setPeriods] = useState<any[]>([]);
    const [timetableEntries, setTimetableEntries] = useState<any[]>([]);
    const [subjectsWithFaculty, setSubjectsWithFaculty] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && session?.user?.role === "STUDENT") {
            loadTimetableData();
        } else if (status === "authenticated" && session?.user?.role !== "STUDENT") {
            router.push("/");
        }
    }, [status, session, router]);

    const loadTimetableData = async () => {
        try {
            setLoading(true);
            setError(null);

            // 1. Fetch student details
            const profileRes = await fetch("/api/students/me");
            if (!profileRes.ok) {
                throw new Error("Failed to load student profile");
            }
            const student = await profileRes.json();
            setStudentData(student);

            if (!student.sectionId) {
                setLoading(false);
                return; // Student not assigned to a section
            }

            // 2. Fetch periods, timetable entries, and subjects in parallel
            const [periodsRes, timetableRes, subjectsRes] = await Promise.all([
                fetch("/api/periods"),
                fetch(`/api/timetables?sectionId=${student.sectionId}&year=${student.year}&semester=${student.semester}`),
                fetch(`/api/students/me/subjects?year=${student.year}&semester=${student.semester}`)
            ]);

            if (periodsRes.ok && timetableRes.ok && subjectsRes.ok) {
                const fetchedPeriods = await periodsRes.json();
                const fetchedTimetable = await timetableRes.json();
                const fetchedSubjects = await subjectsRes.json();

                // Sort periods by order
                fetchedPeriods.sort((a: any, b: any) => a.order - b.order);

                setPeriods(fetchedPeriods);
                setTimetableEntries(fetchedTimetable);
                setSubjectsWithFaculty(fetchedSubjects);
            } else {
                throw new Error("Failed to load timetable or subjects data");
            }

        } catch (err: any) {
            console.error("Load timetable data error:", err);
            setError(err.message || "An error occurred while fetching timetable data.");
        } finally {
            setLoading(false);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <LogoSpinner />
                <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading Class Timetable...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mx-auto max-w-4xl py-12 px-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
                    <FaExclamationTriangle className="mx-auto text-4xl text-red-500 mb-4 animate-bounce" />
                    <h3 className="text-lg font-bold text-red-800">Error Loading Timetable</h3>
                    <p className="text-sm text-red-600 mt-2">{error}</p>
                    <button 
                        onClick={loadTimetableData}
                        className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm shadow-md"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    if (!studentData?.sectionId) {
        return (
            <div className="mx-auto max-w-4xl py-12 px-4">
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <FaCalendarAlt className="mx-auto text-5xl text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800">Section Not Assigned</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        You have not been assigned to a class section yet. Please contact your administrator or HOD to update your details.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-full pb-10">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3 border-b border-slate-200 pb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-inner">
                    <FaCalendarAlt size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Class Timetable</h1>
                    <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-wide">
                        {studentData.department?.name} &nbsp;•&nbsp; Year {studentData.year} Semester {studentData.semester} &nbsp;•&nbsp; Section {studentData.section?.name}
                    </p>
                </div>
            </div>

            {/* Grid timetable */}
            {timetableEntries.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center shadow-sm">
                    <FaClock className="mx-auto text-5xl text-slate-300 mb-4 animate-pulse" />
                    <h3 className="text-xl font-bold text-slate-800">Timetable Empty</h3>
                    <p className="text-sm text-slate-500 mt-2">
                        No timetable has been published for your class section yet.
                    </p>
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-slate-200 min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="bg-slate-100 p-4 border-b border-r border-slate-200 text-left w-36 font-bold text-slate-700 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                                        Day / Period
                                    </th>
                                    {periods.map((p) => (
                                        <th key={p.id} className="p-4 border-b border-r border-slate-200 text-center font-bold text-slate-700 w-52 last:border-r-0">
                                            <div className="text-sm text-rose-600 font-extrabold uppercase tracking-wide">{p.name}</div>
                                            <div className="text-xs text-slate-400 font-medium mt-1">{p.startTime} - {p.endTime}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map((day) => (
                                    <tr key={day.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-b-0">
                                        <td className="p-4 border-r border-slate-200 font-extrabold text-slate-800 bg-slate-50/80 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] text-sm uppercase tracking-wider">
                                            {day.name}
                                        </td>
                                        {periods.map((period) => {
                                            // Find all matching blocks for this day and period
                                            const entries = timetableEntries.filter(
                                                (e) => e.dayOfWeek === day.id && e.periodId === period.id
                                            );

                                            // Helper function to resolve elective subject for student
                                            const findStudentElective = (entry: any) => {
                                                if (entry.electiveSlotId) {
                                                    const sub = subjectsWithFaculty.find((s) => s.electiveSlotId === entry.electiveSlotId);
                                                    if (sub) return sub;
                                                }
                                                // Fallback matching by subject name (e.g. "Elective - III", "Elective - IV")
                                                if (entry.subject?.name) {
                                                    const nameUpper = entry.subject.name.toUpperCase();
                                                    let slotKeys: string[] = [];
                                                    if (nameUpper.includes("III") || nameUpper.includes("-3") || nameUpper.includes(" 3")) slotKeys = ["OE-3", "PE-3"];
                                                    else if (nameUpper.includes("IV") || nameUpper.includes("-4") || nameUpper.includes(" 4")) slotKeys = ["OE-4", "PE-4"];
                                                    else if (nameUpper.includes("V") || nameUpper.includes("-5") || nameUpper.includes(" 5")) slotKeys = ["PE-5", "OE-5"];

                                                    if (slotKeys.length > 0) {
                                                        const matched = subjectsWithFaculty.find((s) =>
                                                            slotKeys.includes(s.electiveSlotRelation?.name) || slotKeys.includes(s.electiveSlotId)
                                                        );
                                                        if (matched) return matched;
                                                    }
                                                }
                                                return null;
                                            };

                                            // Determine which entry block to display for this student
                                            const activeEntry = entries.find((entry) => {
                                                // 1. If lunch break, show it
                                                if (entry.isLunch) return true;

                                                // 2. If it is lab class, filter by lab batch assignment
                                                if (entry.isLab || entry.labBatchId) {
                                                    if (entry.labBatchId) {
                                                        return studentData.labBatchId === entry.labBatchId;
                                                    }
                                                    return true;
                                                }

                                                // 3. If it is an elective slot or elective placeholder
                                                if (entry.electiveSlotId || (entry.subject?.name && entry.subject.name.toUpperCase().includes("ELECTIVE"))) {
                                                    const subject = findStudentElective(entry);
                                                    return !!subject || true;
                                                }

                                                // 4. Default: core subject
                                                return true;
                                            });

                                            if (!activeEntry) {
                                                return (
                                                    <td key={period.id} className="p-3 border-r border-slate-100 last:border-r-0 text-center align-middle h-28">
                                                        <span className="text-slate-300 text-xs italic">-</span>
                                                    </td>
                                                );
                                            }

                                            // Resolve subject data
                                            let subjectInfo: any = null;
                                            if (activeEntry.subjectId) {
                                                subjectInfo = subjectsWithFaculty.find((s) => s.id === activeEntry.subjectId);
                                            }
                                            if (!subjectInfo && (activeEntry.electiveSlotId || activeEntry.subject?.name?.toUpperCase().includes("ELECTIVE"))) {
                                                subjectInfo = findStudentElective(activeEntry);
                                            }

                                            const isLunch = activeEntry.isLunch;
                                            const isOE = subjectInfo?.isElective || activeEntry.electiveSlotId !== null || activeEntry.subject?.name?.toUpperCase().includes("ELECTIVE");
                                            const isLab = activeEntry.isLab || subjectInfo?.type === "LAB";

                                            return (
                                                <td key={period.id} className="p-2 border-r border-slate-100 last:border-r-0 text-center align-middle h-28">
                                                    {isLunch ? (
                                                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-orange-50/70 border border-orange-200 shadow-sm h-full">
                                                            <span className="text-sm font-extrabold text-orange-600 tracking-wider uppercase">🍕 Lunch Break</span>
                                                        </div>
                                                    ) : (
                                                        <div className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-sm h-full transition-all border ${
                                                            isOE 
                                                                ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-400/30 hover:bg-emerald-100/80' 
                                                                : isLab 
                                                                    ? 'bg-purple-50/60 border-purple-200 hover:bg-purple-50'
                                                                    : 'bg-indigo-50/60 border-indigo-100 hover:bg-indigo-50'
                                                        }`}>
                                                            {subjectInfo ? (
                                                                <>
                                                                    {isOE && (
                                                                        <span className="mb-1 text-[9px] font-extrabold text-emerald-800 uppercase bg-emerald-200/80 px-2 py-0.5 rounded-full border border-emerald-300 tracking-wider">
                                                                            🌿 OPEN ELECTIVE
                                                                        </span>
                                                                    )}
                                                                    <span className={`font-black text-sm text-center leading-tight tracking-tight ${
                                                                        isOE ? 'text-emerald-950' : isLab ? 'text-purple-800' : 'text-indigo-800'
                                                                    }`}>
                                                                        {subjectInfo.shortName || subjectInfo.name}
                                                                    </span>
                                                                    <span className="text-[10px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wider">
                                                                        {subjectInfo.code}
                                                                    </span>
                                                                    {isLab && (
                                                                        <span className="mt-1 text-[9px] font-bold text-purple-600 uppercase bg-purple-100/60 px-1.5 py-0.5 rounded-md">
                                                                            Lab Session
                                                                        </span>
                                                                    )}
                                                                    {subjectInfo.faculty ? (
                                                                        <span className="text-[10px] font-medium text-slate-700 mt-1.5 flex items-center gap-1 bg-white/90 px-2 py-0.5 rounded-full border border-slate-200 shadow-sm">
                                                                            <FaChalkboardTeacher size={10} className="text-emerald-600" />
                                                                            {subjectInfo.faculty.empName}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] text-slate-400 mt-1 italic">Faculty Unassigned</span>
                                                                    )}
                                                                </>
                                                            ) : isOE ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="text-[9px] font-extrabold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                                                                        🌿 OPEN ELECTIVE
                                                                    </span>
                                                                    <span className="text-slate-600 text-xs font-bold">
                                                                        {activeEntry.subject?.name || "Elective Slot"}
                                                                    </span>
                                                                    <span className="text-[9px] text-slate-400 italic">Not Enrolled</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs font-semibold italic">Unconfigured</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
