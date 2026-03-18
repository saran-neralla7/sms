"use client";

import { useState, useEffect } from "react";
import { formatISTDate } from "@/lib/dateUtils";
import { FaSms, FaFilter, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaUserTag } from "react-icons/fa";
import { useSession } from "next-auth/react";

export default function SMSLogsPage() {
    const { data: session } = useSession();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);

    // Filters
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [limit, setLimit] = useState("500");

    useEffect(() => {
        fetchDepartments();
        // If HOD, force their department
        const role = (session?.user as any)?.role;
        const userDeptId = (session?.user as any)?.departmentId;
        if (role === "HOD" && userDeptId) {
            setDepartmentId(userDeptId);
        }
    }, [session]);

    useEffect(() => {
        fetchSections();
    }, [departmentId]);

    useEffect(() => {
        fetchSections();
    }, [departmentId]);

    // Removed the auto-fetching useEffect for fetchLogs()

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments");
            if (res.ok) setDepartments(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchSections = async () => {
        let url = "/api/sections";
        if (departmentId) url += `?departmentId=${departmentId}`;
        try {
            const res = await fetch(url);
            if (res.ok) setSections(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (departmentId) query.set("departmentId", departmentId);
            if (year) query.set("year", year);
            if (semester) query.set("semester", semester);
            if (sectionId) query.set("sectionId", sectionId);
            if (startDate) query.set("startDate", startDate);
            if (endDate) query.set("endDate", endDate);
            if (limit) query.set("limit", limit);

            const res = await fetch(`/api/sms/logs?${query.toString()}`);
            if (res.ok) {
                setLogs(await res.json());
                setHasLoaded(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const role = (session?.user as any)?.role;
    const isRestrictedDept = role === "HOD";

    return (
        <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                        <FaSms size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Global SMS Logs</h1>
                        <p className="text-sm text-slate-500">View and audit all SMS messages sent to parents.</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                        <FaFilter />
                        <span className="text-sm font-semibold">Filter Logs</span>
                    </div>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <FaFilter className="animate-spin" /> : <FaFilter />}
                        {loading ? "Loading..." : "Load Logs"}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-7">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Department</label>
                        <select
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            disabled={isRestrictedDept}
                            className="rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:bg-slate-50"
                        >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className="rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        >
                            <option value="">All Years</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Semester</label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        >
                            <option value="">All Sems</option>
                            <option value="1">1st Sem</option>
                            <option value="2">2nd Sem</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Section</label>
                        <select
                            value={sectionId}
                            onChange={(e) => setSectionId(e.target.value)}
                            className="rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        >
                            <option value="">All Sections</option>
                            {sections.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Date Range Start</label>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                            <FaCalendarAlt className="text-slate-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Date Range End</label>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500">
                            <FaCalendarAlt className="text-slate-400" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full bg-transparent text-sm text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-slate-500">Limit</label>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(e.target.value)}
                            className="rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        >
                            <option value="100">100</option>
                            <option value="500">500</option>
                            <option value="1000">1000</option>
                            <option value="5000">5000</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Sent Time</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Student & Class</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Mobile</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Sender</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : !hasLoaded ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        Select your filters and click &quot;Load Logs&quot; to view data.
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No SMS logs found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900">{formatISTDate(log.dateSent)}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">Target: {new Date(log.targetDate).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">{log.student.rollNumber}</span>
                                                <span className="text-sm text-slate-600 truncate max-w-[200px]">{log.student.name}</span>
                                                <span className="inline-flex mt-1 items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 max-w-max">
                                                    {log.student.department} | {log.student.year}-{log.student.semester} {log.student.section}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className="font-mono text-sm text-slate-700">{log.mobileNumber}</span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            {log.status === "SUCCESS" ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                                    <FaCheckCircle /> Success
                                                </span>
                                            ) : (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                                                        <FaTimesCircle /> Failed
                                                    </span>
                                                    {log.gatewayResponse && (
                                                        <span className="text-[10px] text-red-500 max-w-[150px] truncate" title={log.gatewayResponse}>
                                                            {log.gatewayResponse}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className="inline-flex rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/10">
                                                {log.messageType}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <FaUserTag className="text-slate-400" />
                                                <span className="font-medium">{log.sentBy}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && logs.length > 0 && (
                    <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500">
                        Showing up to {limit} recent records based on selected filters.
                    </div>
                )}
            </div>
        </div>
    );
}
