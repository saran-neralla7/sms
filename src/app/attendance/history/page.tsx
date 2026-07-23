"use client";

import { useEffect, useState } from "react";
import { AttendanceHistory } from "@/types";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import { FaCalendarAlt, FaFileExcel, FaFilter, FaHistory, FaTrash, FaUserCircle, FaEye, FaDownload, FaTimes, FaEdit, FaSms, FaCheckCircle } from "react-icons/fa";

import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import RichTextEditor from "@/components/RichTextEditor";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate, formatISTTime } from "@/lib/dateUtils";

export default function HistoryPage() {
    const [history, setHistory] = useState<AttendanceHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const { data: session } = useSession();

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<AttendanceHistory | null>(null);

    // View Modal State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewRecord, setViewRecord] = useState<AttendanceHistory | null>(null);
    const [viewStats, setViewStats] = useState({ present: 0, absent: 0, total: 0 });
    const [viewAbsentees, setViewAbsentees] = useState<string[]>([]);
    const [viewGroup, setViewGroup] = useState<any | null>(null);
    const [viewAbsenteesPeriodMap, setViewAbsenteesPeriodMap] = useState<{ [roll: string]: string[] }>({});

    // Filters
    const [filterType, setFilterType] = useState<"all" | "today" | "yesterday" | "range">("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // New Filters
    const [departmentsList, setDepartmentsList] = useState<{ id: string, name: string, code: string }[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>("");
    const [selectedSem, setSelectedSem] = useState<string>("");
    const [facultyUsernameFilter, setFacultyUsernameFilter] = useState<string>("");

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    const [viewMode, setViewMode] = useState<"academic" | "sms">("academic");

    // SMS State
    const [sendingSms, setSendingSms] = useState(false);
    const [smsSummary, setSmsSummary] = useState<{ success: number, failed: number, visible: boolean }>({ success: 0, failed: 0, visible: false });

    // SMS Confirmation State
    const [isSmsConfirmModalOpen, setIsSmsConfirmModalOpen] = useState(false);
    const [recordToSms, setRecordToSms] = useState<any>(null);
    const [smsAlreadySentCheck, setSmsAlreadySentCheck] = useState<{ checking: boolean, sent: boolean, count: number }>({ checking: false, sent: false, count: 0 });

    useEffect(() => {
        fetchHistory();
    }, [viewMode]); // Refetch when mode changes

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments");
            if (res.ok) {
                const data = await res.json();
                setDepartmentsList(data);
            }
        } catch (error) {
            console.error("Failed to fetch departments", error);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let url = "/api/attendance/history";
            if (viewMode === "sms") {
                url += "?mode=sms";
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (record: AttendanceHistory) => {
        setRecordToDelete(record);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch(`/api/attendance/history/${id}`, { method: "DELETE" });
            if (res.ok) {
                setHistory(prev => prev.filter(h => h.id !== id));
                setStatus({ type: "success", message: "Record deleted successfully" });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                setStatus({ type: "error", message: "Failed to delete record" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error deleting record" });
        }
    };

    const handleView = (group: any) => {
        if (!group || !group.records || group.records.length === 0) return;
        try {
            const absenteePeriodMap: { [roll: string]: string[] } = {};
            const allStudentMap: { [roll: string]: { name: string, status: string, mobile: string } } = {};
            
            group.records.forEach((r: any) => {
                const periodName = r.period?.name || "N/A";
                try {
                    const data = JSON.parse(r.details || "[]");
                    data.forEach((s: any) => {
                        const roll = s["Roll Number"] || s.rollNumber;
                        const name = s["Name"] || s.name;
                        const status = s["Status"] || s.status;
                        const mobile = s["Mobile"] || s.mobile || "";
                        
                        if (roll) {
                            if (!allStudentMap[roll]) {
                                allStudentMap[roll] = { name, status: "Present", mobile };
                            }
                            if (status === "Absent") {
                                allStudentMap[roll].status = "Absent";
                                if (!absenteePeriodMap[roll]) {
                                    absenteePeriodMap[roll] = [];
                                }
                                if (!absenteePeriodMap[roll].includes(periodName)) {
                                    absenteePeriodMap[roll].push(periodName);
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.error(e);
                }
            });

            const total = Object.keys(allStudentMap).length;
            const absent = Object.keys(absenteePeriodMap).length;
            const present = total - absent;
            const absenteeRolls = Object.keys(absenteePeriodMap).sort();

            setViewStats({ present, absent, total });
            setViewAbsentees(absenteeRolls);
            setViewAbsenteesPeriodMap(absenteePeriodMap);
            setViewGroup(group);
            
            const uniqueCombinedDetails = Object.keys(allStudentMap).sort().map(roll => ({
                "Roll Number": roll,
                "Name": allStudentMap[roll].name,
                "Status": allStudentMap[roll].status,
                "Mobile": allStudentMap[roll].mobile
            }));

            setViewRecord({
                ...group.primaryRecord,
                details: JSON.stringify(uniqueCombinedDetails)
            });
            setIsViewModalOpen(true);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error reading record details." });
        }
    };

    const handleDownloadFull = () => {
        if (!viewRecord || !viewRecord.details) return;
        try {
            const rawData = JSON.parse(viewRecord.details);

            // Map to standard format
            const data = rawData.map((s: any) => ({
                "Roll Number": s["Roll Number"] || s.rollNumber,
                "Name": s["Name"] || s.name,
                "Status": s["Status"] || s.status,
                "Mobile": s["Mobile"] || s.mobile || ""
            }));

            // Create Sheet
            const ws = XLSX.utils.json_to_sheet(data, { header: ["Roll Number", "Name", "Status", "Mobile"] });

            // Auto-width columns (basic approximate)
            const wscols = [
                { wch: 15 }, // Roll No
                { wch: 25 }, // Name
                { wch: 10 }, // Status
                { wch: 15 }  // Mobile
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance");

            // Fix filename
            const deptStr = (viewRecord.department?.code || viewRecord.department?.name || "Dept").replace(/[^a-zA-Z0-9]/g, "_");
            const subjectStr = viewRecord.subject?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "SMS";
            const dateStr = formatISTDate(viewRecord.date);
            const filename = `Attendance_${deptStr}_Yr-${viewRecord.year}_Sem-${viewRecord.semester}_Sec-${viewRecord.section?.name}_${subjectStr}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (e) { console.error("Download Error:", e); }
    };

    const handleDownloadAbsentees = () => {
        if (!viewRecord || !viewRecord.details) return;
        try {
            const rawData = JSON.parse(viewRecord.details);

            // Filter and Map
            const absentees = rawData
                .filter((s: any) => (s["Status"] || s.status) === "Absent")
                .map((s: any) => ({
                    "Roll Number": s["Roll Number"] || s.rollNumber,
                    "Name": s["Name"] || s.name,
                    "Status": "Absent",
                    "Mobile": s["Mobile"] || s.mobile || ""
                }));

            if (absentees.length === 0) {
                alert("No absentees in this record.");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(absentees, { header: ["Roll Number", "Name", "Status", "Mobile"] });

            // Auto-width columns
            const wscols = [{ wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 15 }];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Absentees");

            // Customize filename
            const deptStr = (viewRecord.department?.code || viewRecord.department?.name || "Dept").replace(/[^a-zA-Z0-9]/g, "_");
            const subjectStr = viewRecord.subject?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "SMS";
            const dateStr = formatISTDate(viewRecord.date);
            const filename = `Absentees_${deptStr}_Yr-${viewRecord.year}_Sem-${viewRecord.semester}_Sec-${viewRecord.section?.name}_${subjectStr}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (e) { console.error("Download Error:", e); }
    };

    const initSendSms = async (record: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setRecordToSms(record);
        setIsSmsConfirmModalOpen(true);
        setSmsAlreadySentCheck({ checking: true, sent: false, count: 0 });
        setIsViewModalOpen(false); // Close view modal if it was open

        try {
            const res = await fetch(`/api/sms/check-sent?historyId=${record.id}`);
            const data = await res.json();
            setSmsAlreadySentCheck({ checking: false, sent: data.alreadySent, count: data.count });
        } catch (err) {
            setSmsAlreadySentCheck({ checking: false, sent: false, count: 0 });
        }
    };

    const confirmAndSendSms = async () => {
        if (!recordToSms) return;
        setIsSmsConfirmModalOpen(false);
        setSendingSms(true);

        try {
            const res = await fetch("/api/sms/send-absentees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ historyId: recordToSms.id })
            });
            const data = await res.json();

            if (res.ok) {
                setSmsSummary({ success: data.successCount, failed: data.failureCount, visible: true });
            } else {
                setStatus({ type: "error", message: data.error || "Failed to send SMS" });
            }
        } catch (error) {
            console.error("SMS Error:", error);
            setStatus({ type: "error", message: "Network error sending SMS" });
        } finally {
            setSendingSms(false);
            setRecordToSms(null);
        }
    };

    const getFilteredHistory = () => {
        let filtered = history;

        if (filterType !== "all") {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filtered = filtered.filter(record => {
                const recordDate = new Date(record.date);

                if (filterType === "today") {
                    return recordDate >= startOfDay;
                }

                if (filterType === "yesterday") {
                    const startOfYesterday = new Date(startOfDay);
                    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
                    return recordDate >= startOfYesterday && recordDate < startOfDay;
                }

                if (filterType === "range") {
                    if (!startDate) return true;
                    const start = new Date(startDate);
                    const end = endDate ? new Date(endDate) : new Date();
                    end.setHours(23, 59, 59); // End of day
                    return recordDate >= start && recordDate <= end;
                }

                return true;
            });
        }

        // Apply new department filter
        if (selectedDeptId) {
            filtered = filtered.filter(record => record.departmentId === selectedDeptId);
        }

        // Apply new year filter
        if (selectedYear) {
            filtered = filtered.filter(record => record.year === selectedYear);
        }

        // Apply new semester filter
        if (selectedSem) {
            filtered = filtered.filter(record => record.semester === selectedSem);
        }

        // Apply new faculty username filter
        if (facultyUsernameFilter) {
            const search = facultyUsernameFilter.toLowerCase().trim();
            filtered = filtered.filter(record => 
                record.user?.username?.toLowerCase().includes(search)
            );
        }

        return filtered;
    };

    const filteredHistory = getFilteredHistory();

    // Group records:
    // - Electives: same date + subject (groups all periods & departments/sections)
    // - Regulars: same date + subject + section + department (groups multiple periods/hours)
    // - SMS/Bulk: same date + section + department
    const displayRows = (() => {
        const groups: Map<string, any[]> = new Map();
        
        for (const record of filteredHistory) {
            let key = "";
            const dateStr = new Date(record.date).toISOString().split('T')[0];
            if (record.subject) {
                if (record.subject.isElective) {
                    key = `elective_${dateStr}_${record.subject.id}`;
                } else {
                    key = `regular_${dateStr}_${record.subject.id}_${record.sectionId}_${record.departmentId}`;
                }
            } else {
                key = `sms_${dateStr}_${record.sectionId}_${record.departmentId}`;
            }

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(record);
        }

        const result: any[] = [];
        const seenKeys = new Set<string>();

        // Maintain the original order of the history records
        for (const record of filteredHistory) {
            let key = "";
            const dateStr = new Date(record.date).toISOString().split('T')[0];
            if (record.subject) {
                if (record.subject.isElective) {
                    key = `elective_${dateStr}_${record.subject.id}`;
                } else {
                    key = `regular_${dateStr}_${record.subject.id}_${record.sectionId}_${record.departmentId}`;
                }
            } else {
                key = `sms_${dateStr}_${record.sectionId}_${record.departmentId}`;
            }

            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                const records = groups.get(key) || [];
                
                // Helper to get unique periods sorted
                const periodsMap = new Map();
                records.forEach(r => {
                    if (r.period) {
                        periodsMap.set(r.period.id, r.period);
                    }
                });
                const periods = Array.from(periodsMap.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));

                // Unique departments
                const departments = Array.from(
                    new Set([
                        ...records.flatMap((r: any) => r.resolvedDepts || []),
                        ...records.map(r => r.department?.code || r.department?.name)
                    ].filter(Boolean))
                ).sort();
                // Unique sections
                const sections = Array.from(new Set(records.map(r => r.section?.name).filter(Boolean)));

                // Merge student details across all records in the group
                const allDetails = records.flatMap(r => {
                    try { return JSON.parse(r.details || '[]'); } catch { return []; }
                });
                const seenRolls = new Set();
                const uniqueDetails = [];
                for (const student of allDetails) {
                    const roll = student["Roll Number"] || student.rollNumber;
                    if (roll && !seenRolls.has(roll)) {
                        seenRolls.add(roll);
                        uniqueDetails.push(student);
                    }
                }
                const combinedDetails = JSON.stringify(uniqueDetails);

                result.push({
                    key,
                    records,
                    isElective: records[0].subject?.isElective || false,
                    subject: records[0].subject,
                    date: records[0].date,
                    year: records[0].year,
                    semester: records[0].semester,
                    periods,
                    departments,
                    sections,
                    primaryRecord: records[0],
                    combinedDetails
                });
            }
        }
        return result;
    })();



    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editRecord, setEditRecord] = useState<any>(null); // Details parsed
    const [editRecordId, setEditRecordId] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [editTopicsTaught, setEditTopicsTaught] = useState("");

    const handleEdit = (record: AttendanceHistory) => {
        if (!record.details || record.details === "[]") {
            setStatus({ type: "error", message: "No details available to edit." });
            return;
        }
        try {
            const data = JSON.parse(record.details);
            // Add internal ID for tracking if not present, though status toggle relies on RollNo/Id usually
            // Map to standard format if needed, but we keep original structure to save back
            setEditRecord(data);
            setEditRecordId(record.id);
            setEditTopicsTaught(record.topicsTaught || "");
            setIsEditModalOpen(true);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error reading record details." });
        }
    };

    const toggleEditStatus = (index: number) => {
        if (!editRecord) return;
        const updated = [...editRecord];
        const current = updated[index];
        // Toggle Status
        const newStatus = (current["Status"] || current.status) === "Present" ? "Absent" : "Present";

        // Handle both casing conventions effectively
        if (current["Status"]) current["Status"] = newStatus;
        else current.status = newStatus;

        setEditRecord(updated);
    };

    const saveEdit = async () => {
        if (!editRecordId || !editRecord) return;
        setSaving(true);
        try {
            // Recalculate summary status potentially? 
            // The record 'status' field (Completed) usually stays same. 
            // But 'details' definitely updates.

            const res = await fetch(`/api/attendance/history/${editRecordId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    details: editRecord,
                    topicsTaught: editTopicsTaught
                })
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Attendance updated successfully" });
                setIsEditModalOpen(false);
                fetchHistory(); // Refresh list
            } else {
                setStatus({ type: "error", message: "Failed to update attendance" });
            }
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error saving changes" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            {status.message && !isDeleteModalOpen && !isViewModalOpen && !isEditModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                    {status.message}
                </div>
            )}

            {/* ... Existing Headers & Filters ... */}

            {/* Header Area */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <FaHistory size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Attendance History</h1>
                        <p className="text-sm text-slate-500">View and manage past reports.</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-slate-500">
                        <FaFilter />
                        <span className="text-sm font-semibold">Date Filter:</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {["all", "today", "yesterday", "range"].map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type as any)}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${filterType === type
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>

                    {filterType === "range" && (
                        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                                <FaCalendarAlt className="text-slate-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent text-sm outline-none"
                                />
                            </div>
                            <span className="text-slate-400">-</span>
                            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                                <FaCalendarAlt className="text-slate-400" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent text-sm outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center gap-4">
                    {/* Department Dropdown */}
                    <div className="flex flex-col gap-1 min-w-[160px]">
                        <label className="text-xs font-semibold text-slate-500">Department</label>
                        <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                        >
                            <option value="">All Departments</option>
                            {departmentsList.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.code || dept.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Year Dropdown */}
                    <div className="flex flex-col gap-1 min-w-[120px]">
                        <label className="text-xs font-semibold text-slate-500">Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                        >
                            <option value="">All Years</option>
                            {["1", "2", "3", "4"].map((y) => (
                                <option key={y} value={y}>
                                    Year {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Semester Dropdown */}
                    <div className="flex flex-col gap-1 min-w-[120px]">
                        <label className="text-xs font-semibold text-slate-500">Semester</label>
                        <select
                            value={selectedSem}
                            onChange={(e) => setSelectedSem(e.target.value)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                        >
                            <option value="">All Semesters</option>
                            {["1", "2"].map((s) => (
                                <option key={s} value={s}>
                                    Semester {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Faculty Username Filter */}
                    <div className="flex flex-col gap-1 min-w-[200px] flex-1">
                        <label className="text-xs font-semibold text-slate-500">Faculty Username</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={facultyUsernameFilter}
                                onChange={(e) => setFacultyUsernameFilter(e.target.value)}
                                placeholder="Search by faculty username..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                            />
                            {facultyUsernameFilter && (
                                <button
                                    onClick={() => setFacultyUsernameFilter("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <FaTimes size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(selectedDeptId || selectedYear || selectedSem || facultyUsernameFilter) && (
                        <div className="flex items-end self-end h-[38px]">
                            <button
                                onClick={() => {
                                    setSelectedDeptId("");
                                    setSelectedYear("");
                                    setSelectedSem("");
                                    setFacultyUsernameFilter("");
                                }}
                                className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
                <div className="mb-4 flex items-center justify-end">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode("academic")}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === "academic"
                                ? "bg-blue-50 text-blue-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Academic Records
                        </button>
                        <button
                            onClick={() => setViewMode("sms")}
                            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${viewMode === "sms"
                                ? "bg-purple-50 text-purple-700 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            SMS / Bulk Logs
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Class Details</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">View</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Downloaded By</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading records...</td></tr>
                            ) : displayRows.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No records found matching filters</td></tr>
                            ) : (
                                displayRows.map((group) => {
                                    const recordDate = new Date(group.date);
                                    const deptNames = group.departments.join(', ') || "Unknown Dept";
                                    const secNames = group.sections.join(', ') || "N/A";
                                    
                                    return (
                                        <tr key={group.key} className={`group hover:bg-slate-50/80 transition-colors ${group.records.length > 1 ? "bg-indigo-50/10" : ""}`}>
                                            <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900">{formatISTDate(group.date)}</span>
                                                    {group.primaryRecord.createdAt && (
                                                        <span className="text-[11px] text-slate-400 mt-0.5 animate-pulse-subtle">
                                                             {formatISTTime(group.primaryRecord.createdAt)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-900 max-w-[280px]" title={deptNames}>
                                                        {deptNames}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        Yr {group.year} - Sem {group.semester} - Sec {secNames}
                                                    </span>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {group.subject ? (
                                                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                                {group.subject.name}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 italic">
                                                                SMS / Bulk Log
                                                            </span>
                                                        )}
                                                        {group.isElective && (
                                                            <span className="inline-flex items-center rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
                                                                Open Elective
                                                            </span>
                                                        )}
                                                        {group.periods.map((p: any) => (
                                                            <span key={p.id} className="inline-flex items-center rounded bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                                                {p.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                    group.primaryRecord.status === "Marked Absent"
                                                        ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10"
                                                        : "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10"
                                                }`}>
                                                    {group.primaryRecord.status}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <button
                                                    onClick={() => handleView(group)}
                                                    className="group/btn flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                    title={group.records.length > 1 ? "View Combined Details" : "View Details"}
                                                >
                                                    <FaEye className="text-blue-600" />
                                                    <span className="font-mono text-xs">{group.records.length > 1 ? "View All" : "View"}</span>
                                                </button>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                    <FaUserCircle className="text-slate-400" />
                                                    <span>{group.primaryRecord.user?.username || "Unknown"}</span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-6 py-4 text-right">
                                                {(() => {
                                                    const role = ((session?.user as any)?.role || "").toUpperCase();
                                                    const canSms = ["SMS_USER", "ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
                                                    const canEdit = ["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes(role);
                                                    const canDelete = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
                                                    
                                                    if (!canSms && !canEdit && !canDelete) {
                                                        return <span className="text-slate-400">—</span>;
                                                    }

                                                    return (
                                                        <div className="flex flex-col gap-1.5 items-end">
                                                            {group.records.map((r: any) => {
                                                                const rDate = new Date(r.date);
                                                                const now = new Date();
                                                                const isToday = rDate.getDate() === now.getDate() && 
                                                                                rDate.getMonth() === now.getMonth() && 
                                                                                rDate.getFullYear() === now.getFullYear();
                                                                
                                                                return (
                                                                    <div key={r.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-lg p-1.5 transition-colors">
                                                                        {group.records.length > 1 && (
                                                                            <span className="font-mono font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded text-[10px] uppercase">
                                                                                {r.period?.name || r.department?.code || r.department?.name || "Hour"}
                                                                            </span>
                                                                        )}
                                                                        <div className="flex items-center gap-1">
                                                                            {/* Send SMS */}
                                                                            {canSms && (
                                                                                <button
                                                                                    onClick={(e) => initSendSms(r, e)}
                                                                                    disabled={!isToday}
                                                                                    className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-semibold transition-colors ${
                                                                                        isToday 
                                                                                            ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" 
                                                                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                                                    }`}
                                                                                    title={isToday ? `Send SMS for ${r.period?.name || "this period"}` : "SMS can only be sent on the day of attendance"}
                                                                                >
                                                                                    <FaSms size={12} /> SMS
                                                                                </button>
                                                                            )}

                                                                            {/* Edit */}
                                                                            {canEdit && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                                                                                    className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                                                    title={`Edit attendance for ${r.period?.name || "this period"}`}
                                                                                >
                                                                                    <FaHistory size={12} />
                                                                                </button>
                                                                            )}

                                                                            {/* Delete */}
                                                                            {canDelete && (
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); confirmDelete(r); }}
                                                                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                                                    title={`Delete record for ${r.period?.name || "this period"}`}
                                                                                >
                                                                                    <FaTrash size={12} />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    if (recordToDelete) {
                        handleDelete(recordToDelete.id);
                        setIsDeleteModalOpen(false);
                    }
                }}
                title="Delete Record"
                message={`Are you sure you want to delete the attendance report for ${recordToDelete ? new Date(recordToDelete.date).toLocaleDateString() : 'this record'}?`}
                confirmText="Delete"
                isDangerous={true}
            />

            {/* SMS Confirmation Modal */}
            <Modal isOpen={isSmsConfirmModalOpen} onClose={() => setIsSmsConfirmModalOpen(false)} title="Confirm SMS Delivery">
                <div className="p-6">
                    <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
                            <FaSms size={32} />
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-slate-900">Send Delivery Alerts</h3>
                        <p className="mb-6 text-sm text-slate-500 max-w-sm">
                            You are about to send SMS alerts to the parents of all absent students for this class record.
                        </p>

                        {smsAlreadySentCheck.checking ? (
                            <div className="mb-6 rounded-lg bg-slate-50 p-4 w-full flex items-center justify-center gap-2 text-sm text-slate-500">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"></div>
                                Checking previous deliveries...
                            </div>
                        ) : smsAlreadySentCheck.sent ? (
                            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 w-full text-left">
                                <div className="flex items-start gap-3">
                                    <div className="text-amber-500 text-xl font-bold mt-0.5">⚠️</div>
                                    <div>
                                        <p className="font-semibold text-amber-800">SMS Already Sent</p>
                                        <p className="text-sm text-amber-700 mt-1">
                                            It looks like {smsAlreadySentCheck.count} delivery alerts have already been processed for this class on this date.
                                            Are you sure you want to resend them?
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50 p-4 w-full">
                                <p className="text-sm text-slate-600 font-medium tracking-wide">Ready to process delivery queue.</p>
                            </div>
                        )}

                        <div className="flex w-full gap-3 mt-2">
                            <button
                                onClick={() => setIsSmsConfirmModalOpen(false)}
                                className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAndSendSms}
                                disabled={smsAlreadySentCheck.checking}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition-all ${smsAlreadySentCheck.sent
                                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <FaSms />
                                {smsAlreadySentCheck.sent ? "Resend" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* View Modal */}
            {viewRecord && (
                <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Attendance Report">
                    <div className="p-4">
                        <div className="space-y-4">
                            <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Date</span>
                                        <span className="font-medium text-slate-900">
                                            {formatISTDate(viewRecord.date)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Class</span>
                                        <span className="font-medium text-slate-900">
                                            {viewGroup 
                                                ? viewGroup.departments.join(', ') 
                                                : ((viewRecord as any).resolvedDepts && (viewRecord as any).resolvedDepts.length > 0
                                                    ? (viewRecord as any).resolvedDepts.sort().join(', ')
                                                    : (viewRecord.department?.code || viewRecord.department?.name || 'Unknown Dept'))}
                                        </span>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Yr {viewRecord.year} - Sem {viewRecord.semester} - Sec {viewGroup ? viewGroup.sections.join(', ') : (viewRecord.section?.name || 'N/A')}
                                        </div>
                                    </div>
                                    <div className="col-span-2 my-1 border-t border-slate-200"></div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Subject / Periods</span>
                                        <span className="font-medium text-slate-900 block truncate max-w-[200px]" title={viewRecord.subject?.name || 'No Subject'}>
                                            {viewRecord.subject?.name || 'N/A'}
                                        </span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {viewGroup?.periods.map((p: any) => (
                                                <span key={p.id} className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Total Students</span>
                                        <span className="font-medium text-slate-900">{viewStats.total}</span>
                                    </div>
                                    <div className="col-span-2 my-1 border-t border-slate-200"></div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Present</span>
                                        <span className="font-bold text-green-600">{viewStats.present}</span>
                                    </div>
                                    <div>
                                        <span className="block text-slate-500 text-xs uppercase font-bold">Absent</span>
                                        <span className="font-bold text-red-600">{viewStats.absent}</span>
                                    </div>
                                    {viewGroup && viewGroup.records && viewGroup.records.some((r: any) => r.topicsTaught) && (
                                        <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
                                            <span className="block text-slate-500 text-xs uppercase font-bold mb-1.5">Topics Taught</span>
                                            <div className="space-y-2 max-h-[160px] overflow-y-auto">
                                                {viewGroup.records.map((r: any, idx: number) => {
                                                    if (!r.topicsTaught) return null;
                                                    return (
                                                        <div key={r.id || idx} className="bg-white border border-slate-100 rounded-lg p-2.5">
                                                            {viewGroup.records.length > 1 && (
                                                                <span className="inline-block font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] uppercase mb-1">
                                                                    {r.period?.name || r.department?.code || r.department?.name || `Record ${idx + 1}`}
                                                                </span>
                                                            )}
                                                            <div 
                                                                className="text-xs text-slate-700 prose prose-sm max-h-[80px] overflow-y-auto"
                                                                dangerouslySetInnerHTML={{ __html: r.topicsTaught }}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {viewAbsentees.length > 0 && (
                                        <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
                                            <span className="block text-slate-500 text-xs uppercase font-bold mb-2">
                                                Absent Roll Numbers ({viewAbsentees.length})
                                            </span>
                                            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                                                {viewAbsentees.map((roll, i) => {
                                                    const periodsMissed = viewAbsenteesPeriodMap[roll] || [];
                                                    return (
                                                        <span 
                                                            key={i} 
                                                            className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-mono font-medium text-red-700 ring-1 ring-inset ring-red-600/20"
                                                            title={periodsMissed.length > 0 ? `Absent for periods: ${periodsMissed.join(', ')}` : undefined}
                                                        >
                                                            {roll}
                                                            {periodsMissed.length > 0 && (
                                                                <span className="text-[9px] font-sans font-semibold px-1 py-0.2 bg-red-200/50 rounded-full text-red-800">
                                                                    {periodsMissed.join(',')}
                                                                </span>
                                                            )}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {viewAbsentees.length === 0 && viewStats.total > 0 && (
                                        <div className="col-span-2 border-t border-slate-200 pt-3 mt-1">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                                                ✓ No absentees — Full attendance!
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <button
                                    onClick={handleDownloadFull}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                >
                                    <FaDownload /> Download Full Report
                                </button>
                                <button
                                    onClick={handleDownloadAbsentees}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                                >
                                    <FaFileExcel /> Download Absentees (Excel)
                                </button>
                                {["SMS_USER", "ADMIN", "DIRECTOR", "PRINCIPAL"].includes(((session?.user as any)?.role || "").toUpperCase()) && (
                                    <button
                                        onClick={() => initSendSms(viewRecord)}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors"
                                    >
                                        <FaSms size={16} /> Send SMS to Absentees
                                    </button>
                                )}
                            </div>

                            <button onClick={() => setIsViewModalOpen(false)} className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600 underline">
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Attendance">
                <div className="p-4 h-[80vh] flex flex-col">
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-1">
                        {/* Rich text editor for topics taught */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Session Topics Taught</label>
                            <RichTextEditor
                                value={editTopicsTaught}
                                onChange={setEditTopicsTaught}
                            />
                        </div>

                        {/* Student list table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold text-slate-500">Roll No</th>
                                        <th className="px-4 py-2 font-semibold text-slate-500">Name</th>
                                        <th className="px-4 py-2 font-semibold text-slate-500 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {editRecord && editRecord.map((s: any, idx: number) => {
                                        const status = s["Status"] || s.status;
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => toggleEditStatus(idx)}
                                                className={`cursor-pointer transition-colors ${status === "Absent" ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}`}
                                            >
                                                <td className="px-4 py-3 font-medium text-slate-700">{s["Roll Number"] || s.rollNumber}</td>
                                                <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">{s["Name"] || s.name}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${status === "Absent"
                                                        ? "bg-red-200 text-red-800"
                                                        : "bg-green-100 text-green-700"}`}>
                                                        {status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            disabled={saving}
                            className="flex-1 px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md disabled:opacity-70"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* SMS Loading Modal */}
            <Modal isOpen={sendingSms} onClose={() => { }} title="Sending SMS">
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                    <LogoSpinner fullScreen={false} />
                    <p className="text-lg font-bold text-slate-800 text-center mt-4">Sending messages to parents...</p>
                    <p className="text-sm text-slate-500 text-center">Please wait, do not close this window.</p>
                </div>
            </Modal>

            {/* SMS Summary Modal */}
            <Modal isOpen={smsSummary.visible} onClose={() => setSmsSummary({ ...smsSummary, visible: false })} title="SMS Delivery Report">
                <div className="p-6">
                    <div className="flex flex-col items-center space-y-4 mb-6">
                        <div className="rounded-full bg-green-100 p-4 text-green-600 shadow-sm border border-green-200">
                            <FaCheckCircle size={36} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800">Messages Processed</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-green-50/80 rounded-2xl p-6 border border-green-200/60 shadow-sm">
                            <div className="text-4xl font-black text-green-600 tracking-tight">{smsSummary.success}</div>
                            <div className="text-sm font-bold text-green-800 mt-2">Successfully Sent</div>
                        </div>
                        <div className="bg-red-50/80 rounded-2xl p-6 border border-red-200/60 shadow-sm">
                            <div className="text-4xl font-black text-red-600 tracking-tight">{smsSummary.failed}</div>
                            <div className="text-sm font-bold text-red-800 mt-2">Failed to Send</div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setSmsSummary({ ...smsSummary, visible: false });
                            fetchHistory(); // Refresh to see logs easily
                        }}
                        className="mt-8 w-full rounded-xl bg-slate-900 px-4 py-4 text-sm font-bold text-white shadow hover:bg-slate-800 transition-colors"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </Modal>
        </div>
    );
}
