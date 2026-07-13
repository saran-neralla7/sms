"use client";

import { useState, useEffect } from "react";
import { FaCalendarAlt, FaPlus, FaTrash, FaSpinner, FaGraduationCap, FaCalendarCheck, FaClock } from "react-icons/fa";
import { formatISTDate } from "@/lib/dateUtils";

interface AcademicYear {
    id: string;
    name: string;
    isCurrent: boolean;
}

interface Holiday {
    id: string;
    date: string;
    endDate?: string | null;
    name: string;
}

interface SemesterTimeline {
    id: string;
    year: string;
    semester: string;
    classworkStart: string;
    classworkEnd: string;
    mid1Start: string;
    mid1End: string;
    mid2Start: string;
    mid2End: string;
    semExamStart: string;
    semExamEnd: string;
}

export default function AcademicCalendarPage() {
    const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
    const [selectedAY, setSelectedAY] = useState<string>("");
    
    // Page states
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [timelines, setTimelines] = useState<SemesterTimeline[]>([]);
    const [activeTab, setActiveTab] = useState<"holidays" | "timelines">("holidays");
    
    const [loading, setLoading] = useState(false);
    const [submittingHoliday, setSubmittingHoliday] = useState(false);
    const [submittingTimeline, setSubmittingTimeline] = useState(false);
    
    // Notifications
    const [status, setStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

    // Holiday Form
    const [holidayForm, setHolidayForm] = useState({
        date: "",
        endDate: "",
        name: ""
    });
    const [hasEndDate, setHasEndDate] = useState(false);

    // Timeline Form
    const [timelineForm, setTimelineForm] = useState({
        year: "1",
        semester: "1",
        classworkStart: "",
        classworkEnd: "",
        mid1Start: "",
        mid1End: "",
        mid2Start: "",
        mid2End: "",
        semExamStart: "",
        semExamEnd: ""
    });

    useEffect(() => {
        fetchAcademicYears();
    }, []);

    useEffect(() => {
        if (selectedAY) {
            fetchCalendarData();
        }
    }, [selectedAY]);

    const fetchAcademicYears = async () => {
        try {
            const res = await fetch("/api/academic-years");
            if (res.ok) {
                const data = await res.json();
                setAcademicYears(data);
                const current = data.find((y: AcademicYear) => y.isCurrent);
                if (current) {
                    setSelectedAY(current.id);
                } else if (data.length > 0) {
                    setSelectedAY(data[0].id);
                }
            }
        } catch (err) {
            console.error("Failed to load academic years:", err);
        }
    };

    const fetchCalendarData = async () => {
        setLoading(true);
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch(`/api/admin/academic-calendar?academicYearId=${selectedAY}`);
            if (res.ok) {
                const data = await res.json();
                setHolidays(data.holidays || []);
                setTimelines(data.timelines || []);
            } else {
                const data = await res.json();
                showNotification("error", data.error || "Failed to fetch calendar data.");
            }
        } catch (err) {
            showNotification("error", "An error occurred fetching calendar data.");
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (type: "success" | "error", message: string) => {
        setStatus({ type, message });
        setTimeout(() => {
            setStatus({ type: null, message: "" });
        }, 4000);
    };

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!holidayForm.date || !holidayForm.name.trim()) {
            showNotification("error", "All holiday fields are required.");
            return;
        }

        if (hasEndDate && holidayForm.endDate && holidayForm.endDate <= holidayForm.date) {
            showNotification("error", "End date must be after start date.");
            return;
        }

        setSubmittingHoliday(true);
        try {
            const res = await fetch("/api/admin/academic-calendar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "holiday",
                    academicYearId: selectedAY,
                    date: holidayForm.date,
                    endDate: hasEndDate && holidayForm.endDate ? holidayForm.endDate : null,
                    name: holidayForm.name.trim()
                })
            });

            if (res.ok) {
                showNotification("success", "Holiday added successfully!");
                setHolidayForm({ date: "", endDate: "", name: "" });
                setHasEndDate(false);
                fetchCalendarData();
            } else {
                const data = await res.json();
                showNotification("error", data.error || "Failed to add holiday.");
            }
        } catch (err) {
            showNotification("error", "An error occurred adding holiday.");
        } finally {
            setSubmittingHoliday(false);
        }
    };

    const handleDeleteHoliday = async (id: string) => {
        if (!confirm("Are you sure you want to delete this holiday?")) return;

        try {
            const res = await fetch(`/api/admin/academic-calendar?type=holiday&id=${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                showNotification("success", "Holiday deleted successfully.");
                fetchCalendarData();
            } else {
                const data = await res.json();
                showNotification("error", data.error || "Failed to delete holiday.");
            }
        } catch (err) {
            showNotification("error", "An error occurred deleting holiday.");
        }
    };

    const handleSaveTimeline = async (e: React.FormEvent) => {
        e.preventDefault();
        const f = timelineForm;
        if (!f.classworkStart || !f.classworkEnd || !f.mid1Start || !f.mid1End || !f.mid2Start || !f.mid2End || !f.semExamStart || !f.semExamEnd) {
            showNotification("error", "All timeline dates are required.");
            return;
        }

        setSubmittingTimeline(true);
        try {
            const res = await fetch("/api/admin/academic-calendar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "timeline",
                    academicYearId: selectedAY,
                    ...f
                })
            });

            if (res.ok) {
                showNotification("success", `Timeline for B.Tech Year ${f.year} Sem ${f.semester} saved successfully!`);
                // Keep the selection but clear dates if desired, or keep dates for easy copy-pasting
                fetchCalendarData();
            } else {
                const data = await res.json();
                showNotification("error", data.error || "Failed to save semester timeline.");
            }
        } catch (err) {
            showNotification("error", "An error occurred saving semester timeline.");
        } finally {
            setSubmittingTimeline(false);
        }
    };

    const handleDeleteTimeline = async (id: string) => {
        if (!confirm("Are you sure you want to delete this semester timeline?")) return;

        try {
            const res = await fetch(`/api/admin/academic-calendar?type=timeline&id=${id}`, {
                method: "DELETE"
            });

            if (res.ok) {
                showNotification("success", "Timeline deleted successfully.");
                fetchCalendarData();
            } else {
                const data = await res.json();
                showNotification("error", data.error || "Failed to delete timeline.");
            }
        } catch (err) {
            showNotification("error", "An error occurred deleting timeline.");
        }
    };

    const loadTimelineIntoForm = (t: SemesterTimeline) => {
        setTimelineForm({
            year: t.year,
            semester: t.semester,
            classworkStart: t.classworkStart ? new Date(t.classworkStart).toISOString().split('T')[0] : "",
            classworkEnd: t.classworkEnd ? new Date(t.classworkEnd).toISOString().split('T')[0] : "",
            mid1Start: t.mid1Start ? new Date(t.mid1Start).toISOString().split('T')[0] : "",
            mid1End: t.mid1End ? new Date(t.mid1End).toISOString().split('T')[0] : "",
            mid2Start: t.mid2Start ? new Date(t.mid2Start).toISOString().split('T')[0] : "",
            mid2End: t.mid2End ? new Date(t.mid2End).toISOString().split('T')[0] : "",
            semExamStart: t.semExamStart ? new Date(t.semExamStart).toISOString().split('T')[0] : "",
            semExamEnd: t.semExamEnd ? new Date(t.semExamEnd).toISOString().split('T')[0] : ""
        });
        showNotification("success", `Timeline dates for Year ${t.year} Sem ${t.semester} loaded into form for editing.`);
    };

    return (
        <div className="mx-auto max-w-7xl">
            {/* Header Notification */}
            {status.message && (
                <div className={`mb-6 rounded-xl p-4 text-sm font-semibold border ${status.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-sm border border-rose-200">
                        <FaCalendarAlt size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Academic Calendar & Holidays</h1>
                        <p className="text-sm text-slate-500">Configure college holidays and academic semester timelines manually.</p>
                    </div>
                </div>
                
                {/* Academic Year Selection */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-slate-700">Academic Year:</label>
                    <select
                        value={selectedAY}
                        onChange={e => setSelectedAY(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                    >
                        <option value="">Select Academic Year</option>
                        {academicYears.map((ay) => (
                            <option key={ay.id} value={ay.id}>
                                {ay.name} {ay.isCurrent ? "(Current)" : ""}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-slate-200 mb-6 bg-slate-50 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab("holidays")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "holidays" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                    <FaCalendarCheck size={16} /> Holidays List
                </button>
                <button
                    onClick={() => setActiveTab("timelines")}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "timelines" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                    <FaClock size={16} /> Semester Milestones
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <FaSpinner className="h-8 w-8 animate-spin text-rose-600" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Add / Edit forms (Left side) */}
                    <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-fit">
                        {activeTab === "holidays" ? (
                            <form onSubmit={handleAddHoliday} className="space-y-4">
                                <h3 className="font-bold text-slate-800 text-lg border-b pb-2 mb-4 flex items-center gap-2">
                                    <FaPlus className="text-rose-600 h-4 w-4" /> Add New Holiday
                                </h3>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={holidayForm.date}
                                        onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                        required
                                    />
                                </div>

                                {/* Optional End Date toggle */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="hasEndDate"
                                        checked={hasEndDate}
                                        onChange={e => {
                                            setHasEndDate(e.target.checked);
                                            if (!e.target.checked) setHolidayForm(f => ({ ...f, endDate: "" }));
                                        }}
                                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                    />
                                    <label htmlFor="hasEndDate" className="text-sm font-medium text-slate-600 cursor-pointer select-none">
                                        Multi-day holiday (add End Date)
                                    </label>
                                </div>

                                {hasEndDate && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">End Date <span className="text-rose-500">*</span></label>
                                        <input
                                            type="date"
                                            value={holidayForm.endDate}
                                            min={holidayForm.date || undefined}
                                            onChange={e => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                            required={hasEndDate}
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1">The holiday will apply to all days from Start Date to End Date (inclusive).</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Holiday Name / Description</label>
                                    <input
                                        type="text"
                                        value={holidayForm.name}
                                        onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                                        placeholder="e.g. Independence Day"
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={submittingHoliday || !selectedAY}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 transition-colors mt-6"
                                >
                                    {submittingHoliday ? <FaSpinner className="animate-spin h-4 w-4" /> : <FaPlus />} Add Holiday
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSaveTimeline} className="space-y-4">
                                <h3 className="font-bold text-slate-800 text-lg border-b pb-2 mb-4 flex items-center gap-2">
                                    <FaClock className="text-rose-600 h-4 w-4" /> Configure Semester Timeline
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">B.Tech Year</label>
                                        <select
                                            value={timelineForm.year}
                                            onChange={e => setTimelineForm({ ...timelineForm, year: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                        >
                                            <option value="1">1st Year</option>
                                            <option value="2">2nd Year</option>
                                            <option value="3">3rd Year</option>
                                            <option value="4">4th Year</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Semester</label>
                                        <select
                                            value={timelineForm.semester}
                                            onChange={e => setTimelineForm({ ...timelineForm, semester: e.target.value })}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                        >
                                            <option value="1">1st Semester</option>
                                            <option value="2">2nd Semester</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                    <h4 className="font-bold text-xs text-rose-600 uppercase tracking-wider">Classwork Schedule</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">Start Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.classworkStart}
                                                onChange={e => setTimelineForm({ ...timelineForm, classworkStart: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">End Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.classworkEnd}
                                                onChange={e => setTimelineForm({ ...timelineForm, classworkEnd: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                    <h4 className="font-bold text-xs text-rose-600 uppercase tracking-wider">MID-I Examination</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">Start Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.mid1Start}
                                                onChange={e => setTimelineForm({ ...timelineForm, mid1Start: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">End Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.mid1End}
                                                onChange={e => setTimelineForm({ ...timelineForm, mid1End: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                    <h4 className="font-bold text-xs text-rose-600 uppercase tracking-wider">MID-II Examination</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">Start Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.mid2Start}
                                                onChange={e => setTimelineForm({ ...timelineForm, mid2Start: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">End Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.mid2End}
                                                onChange={e => setTimelineForm({ ...timelineForm, mid2End: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                    <h4 className="font-bold text-xs text-rose-600 uppercase tracking-wider">Semester Exams</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">Start Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.semExamStart}
                                                onChange={e => setTimelineForm({ ...timelineForm, semExamStart: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-slate-500">End Date</label>
                                            <input
                                                type="date"
                                                value={timelineForm.semExamEnd}
                                                onChange={e => setTimelineForm({ ...timelineForm, semExamEnd: e.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingTimeline || !selectedAY}
                                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 transition-colors mt-6"
                                >
                                    {submittingTimeline ? <FaSpinner className="animate-spin h-4 w-4" /> : <FaCalendarCheck />} Save Timeline Configuration
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Data Display Lists (Right side, spans 2 columns) */}
                    <div className="lg:col-span-2 space-y-6">
                        {activeTab === "holidays" ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="font-bold text-slate-800 text-lg border-b pb-3 mb-4 flex items-center justify-between">
                                    <span>Declared Holidays ({holidays.length})</span>
                                    <span className="text-xs font-normal text-slate-500">For active session</span>
                                </h3>

                                {holidays.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500 italic">No holidays defined for this academic year yet.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm text-slate-600">
                                             <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3">Holiday Date</th>
                                                    <th className="px-4 py-3">Holiday Description</th>
                                                    <th className="px-4 py-3 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {holidays.map((h) => (
                                                    <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-slate-900">
                                                            {formatISTDate(h.date)}
                                                            {h.endDate && (
                                                                <span className="text-slate-500 font-normal">
                                                                    {" "}&rarr;{" "}{formatISTDate(h.endDate)}
                                                                </span>
                                                            )}
                                                            {h.endDate && (
                                                                <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Multi-day</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 font-medium">
                                                            {h.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => handleDeleteHoliday(h.id)}
                                                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                                title="Delete Holiday"
                                                            >
                                                                <FaTrash size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="font-bold text-slate-800 text-lg border-b pb-3 mb-4">
                                    Semester Timelines ({timelines.length})
                                </h3>

                                {timelines.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500 italic">No semester milestones configured yet.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {timelines.map((t) => (
                                            <div key={t.id} className="border border-slate-200 rounded-xl p-4 hover:border-rose-200 transition-colors bg-slate-50/20">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-rose-600 font-bold text-sm">
                                                            {t.year}
                                                        </span>
                                                        <span className="font-bold text-slate-800 text-sm">
                                                            B.Tech Year {t.year} — Semester {t.semester}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => loadTimelineIntoForm(t)}
                                                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded transition-colors"
                                                        >
                                                            Load/Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteTimeline(t.id)}
                                                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                            title="Delete Timeline"
                                                        >
                                                            <FaTrash size={12} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                                    <div>
                                                        <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-1">Classwork</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.classworkStart)}</span>
                                                        <span className="text-slate-400 mx-1">to</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.classworkEnd)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-1">MID-I Exams</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.mid1Start)}</span>
                                                        <span className="text-slate-400 mx-1">to</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.mid1End)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-1">MID-II Exams</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.mid2Start)}</span>
                                                        <span className="text-slate-400 mx-1">to</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.mid2End)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px] mb-1">Semester Exams</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.semExamStart)}</span>
                                                        <span className="text-slate-400 mx-1">to</span>
                                                        <span className="font-medium text-slate-800">{formatISTDate(t.semExamEnd)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
