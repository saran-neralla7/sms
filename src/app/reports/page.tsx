"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaCalendarAlt, FaFileExcel, FaFilter, FaTrash, FaEdit, FaUserCircle, FaSave, FaTimes, FaEye, FaDownload, FaFilePdf, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import { motion } from "framer-motion";
import StudentHoverCard from "@/components/StudentHoverCard";
import LogoSpinner from "@/components/LogoSpinner";
import { formatISTDate, formatISTDateTime } from "@/lib/dateUtils";

const getAcademicYear = (dStr?: string) => {
    const d = dStr ? new Date(dStr) : new Date();
    const yr = d.getFullYear();
    const m = d.getMonth() + 1;
    return m >= 6 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
};

const getBatchNameString = (yrNum?: string, dStr?: string) => {
    const ay = getAcademicYear(dStr);
    const startYr = parseInt(ay.split("-")[0]);
    const yearVal = parseInt(yrNum || "1") || 1;
    const joinYear = startYr - (yearVal - 1);
    const endYear = joinYear + 4;
    return `${joinYear}-${endYear} Batch`;
};

export default function ReportsPage() {
    const { data: session } = useSession();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab State
    const [activeTab, setActiveTab] = useState<"daily" | "consolidated" | "subject" | "weekly" | "elective" | "tracker" | "defaulter" | "comparative" | "transcript">("daily");

    // Faculty Submission Tracker State
    const [trackerDate, setTrackerDate] = useState<string>(new Date().toISOString().split("T")[0]);
    const [trackerData, setTrackerData] = useState<any>(null);
    const [trackerLoading, setTrackerLoading] = useState<boolean>(false);

    // Defaulter Report (#1) State
    const [defaulterThreshold, setDefaulterThreshold] = useState<string>("75");
    const [defaulterData, setDefaulterData] = useState<any>(null);
    const [defaulterLoading, setDefaulterLoading] = useState<boolean>(false);

    // Comparative Report (#3) State
    const [comparativeData, setComparativeData] = useState<any>(null);
    const [comparativeLoading, setComparativeLoading] = useState<boolean>(false);

    // Student Transcript (#5) State
    const [transcriptRollNo, setTranscriptRollNo] = useState<string>("");
    const [transcriptData, setTranscriptData] = useState<any>(null);
    const [transcriptLoading, setTranscriptLoading] = useState<boolean>(false);

    // Filters
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [labBatches, setLabBatches] = useState<any[]>([]);
    const [selectedLabBatchId, setSelectedLabBatchId] = useState("");
    const [reportMode, setReportMode] = useState<"standard" | "subject_summary" | "scholarship" | "monthly">("standard");
    const [targetWorkingDays, setTargetWorkingDays] = useState("");
    const [subjectViewMode, setSubjectViewMode] = useState<"summary" | "register">("summary");
    const [registerData, setRegisterData] = useState<{ sessions: any[]; students: any[] } | null>(null);

    // Consolidated Dates
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [consolidatedData, setConsolidatedData] = useState<any[]>([]);
    const [subjectSummarySubjects, setSubjectSummarySubjects] = useState<any[]>([]);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: "percentage" | "rollNumber" | "totalClasses" | null, direction: "asc" | "desc" }>({ key: null, direction: "asc" });

    // Metadata for dropdowns
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);

    // Weekly View State
    const [weekDate, setWeekDate] = useState("");
    const [weeklyData, setWeeklyData] = useState<Record<string, Record<string, any>>>({}); // { [date]: { [periodId]: record } }
    const [weekDays, setWeekDays] = useState<Date[]>([]);

    // Edit Modal State
    const [editingRecord, setEditingRecord] = useState<any | null>(null);
    const [editDetails, setEditDetails] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<any | null>(null);

    // View Modal State (Mirrors History Page)
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewRecord, setViewRecord] = useState<any | null>(null);
    const [viewStats, setViewStats] = useState({ present: 0, absent: 0, total: 0 });

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    const clearFilters = () => {
        setDepartmentId("");
        setYear("");
        setSemester("");
        setSectionId("");
        setSubjectId("");
        setSelectedLabBatchId("");
        setStartDate("");
        setEndDate("");
        setWeekDate("");
    };

    const isBSHUser = useMemo(() => {
        if (!session?.user?.departmentId || departments.length === 0) return false;
        const bshDept = departments.find(d => d.code === "BSH");
        return bshDept ? bshDept.id === session.user.departmentId : false;
    }, [session, departments]);

    const isFaculty = useMemo(() => {
        return (session?.user?.role || "").toUpperCase() === "FACULTY";
    }, [session]);

    const isGlobal = useMemo(() => {
        const role = (session?.user?.role || "").toUpperCase();
        return ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role) || isBSHUser;
    }, [session, isBSHUser]);

    const effectiveDeptId = useMemo(() => {
        return isGlobal ? departmentId : (session?.user as any)?.departmentId;
    }, [isGlobal, departmentId, session]);

    const selectedSubjectObj = useMemo(() => {
        return subjects.find(s => s.id === subjectId);
    }, [subjects, subjectId]);

    const isLabSubject = useMemo(() => {
        return selectedSubjectObj?.type === "LAB";
    }, [selectedSubjectObj]);

    useEffect(() => {
        if (sectionId && effectiveDeptId && year && semester) {
            const query = new URLSearchParams({
                departmentId: effectiveDeptId,
                year,
                semester
            });
            fetch(`/api/sections/${sectionId}/batches?${query.toString()}`)
                .then(res => res.json())
                .then(data => setLabBatches(data.batches || []))
                .catch(console.error);
        } else {
            setLabBatches([]);
        }
        setSelectedLabBatchId("");
    }, [sectionId, effectiveDeptId, year, semester]);

    useEffect(() => {
        fetchDepartments();
        // Initial fetch based on tab
        if (activeTab === "daily") {
            fetchHistory();
        }
        fetchPeriods();
    }, [session]);

    const fetchElectives = async () => {
        if (!year || !semester) return;
        const params = new URLSearchParams({ year, semester, onlyElectives: "true" });
        const res = await fetch(`/api/subjects?${params}`);
        if (res.ok) setSubjects(await res.json());
    };

    useEffect(() => {
        if (activeTab === "elective") {
            fetchElectives();
            return;
        }
        if (effectiveDeptId) fetchSections(effectiveDeptId);
        if (effectiveDeptId && year && semester) fetchSubjects(effectiveDeptId);
    }, [effectiveDeptId, year, semester, activeTab]);

    // Refetch when filters change (Daily Only)
    useEffect(() => {
        if (activeTab === "daily") {
            fetchHistory();
        }
    }, [year, semester, sectionId, departmentId, activeTab]);

    useEffect(() => {
        if (activeTab === "tracker") {
            fetchTrackerData();
        }
    }, [activeTab, trackerDate, effectiveDeptId, year, semester]);

    const fetchTrackerData = async () => {
        setTrackerLoading(true);
        try {
            let url = `/api/reports/posting-status?date=${trackerDate}`;
            if (effectiveDeptId) url += `&departmentId=${effectiveDeptId}`;
            if (year) url += `&year=${year}`;
            if (semester) url += `&semester=${semester}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setTrackerData(data);
            }
        } catch (e) {
            console.error("Failed to fetch tracker data", e);
        } finally {
            setTrackerLoading(false);
        }
    };

    const handleDownloadPendingTracker = () => {
        if (!trackerData || !trackerData.pendingList || trackerData.pendingList.length === 0) {
            alert("No pending faculty entries to download.");
            return;
        }
        const ws = XLSX.utils.json_to_sheet(trackerData.pendingList.map((item: any) => ({
            "Faculty Name": item.facultyName,
            "Username": item.username,
            "Mobile": item.mobile,
            "Department": item.deptCode,
            "Subject": item.subjectName,
            "Subject Code": item.subjectCode,
            "Class": item.yrSem,
            "Section": item.sectionName,
            "Status": "Pending (Not Posted)"
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pending_Faculty");
        XLSX.writeFile(wb, `Pending_Attendance_Faculty_${trackerDate}.xlsx`);
    };

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchSections = async (deptId: string) => {
        const res = await fetch(`/api/sections?departmentId=${deptId}`);
        if (res.ok) setSections(await res.json());
    };

    const fetchSubjects = async (deptId: string) => {
        const params = new URLSearchParams({ departmentId: deptId, year, semester, excludeElectives: "true" });
        const res = await fetch(`/api/subjects?${params}`);
        if (res.ok) setSubjects(await res.json());
    };

    const fetchPeriods = async () => {
        const res = await fetch("/api/periods");
        if (res.ok) setPeriods(await res.json());
    };

    const getWeekDays = (dateStr: string) => {
        const d = new Date(dateStr);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(d.setDate(diff));

        const days = [];
        for (let i = 0; i < 6; i++) {
            const nextDay = new Date(monday);
            nextDay.setDate(monday.getDate() + i);
            days.push(nextDay);
        }
        return days;
    };

    const fetchWeeklyData = async () => {
        if (!weekDate || !departmentId || !year || !semester || !sectionId) return;
        setLoading(true);

        const days = getWeekDays(weekDate);
        setWeekDays(days);
        const start = days[0].toISOString().split('T')[0];
        const end = days[5].toISOString().split('T')[0];

        try {
            const params = new URLSearchParams();
            params.append("departmentId", departmentId);
            params.append("year", year);
            params.append("semester", semester);
            params.append("sectionId", sectionId);
            params.append("startDate", start);
            params.append("endDate", end);

            const res = await fetch(`/api/attendance/history?${params}`);
            if (res.ok) {
                const data = await res.json();
                // Transform to Map
                const map: Record<string, Record<string, any>> = {};

                // Initialize map structure
                days.forEach(d => {
                    const dateKey = d.toISOString().split('T')[0];
                    map[dateKey] = {};
                });

                data.forEach((rec: any) => {
                    const d = new Date(rec.date).toISOString().split('T')[0];
                    if (map[d] && rec.periodId) {
                        map[d][rec.periodId] = rec;
                    }
                });
                setWeeklyData(map);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (sectionId) params.append("sectionId", sectionId);
            if (departmentId) params.append("departmentId", departmentId);

            const res = await fetch(`/api/attendance/history?${params.toString()}`);
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

    const fetchSubjectRegister = async () => {
        if (!startDate || !endDate) return;
        if ((activeTab === "subject" || activeTab === "elective") && !subjectId) return;
        if (activeTab !== "elective" && !sectionId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (activeTab !== "elective" && sectionId) params.append("sectionId", sectionId);
            if (effectiveDeptId) params.append("departmentId", effectiveDeptId);
            if (activeTab !== "consolidated" && subjectId) params.append("subjectId", subjectId);
            if (selectedLabBatchId) params.append("labBatchId", selectedLabBatchId);
            params.append("startDate", startDate);
            params.append("endDate", endDate);

            const res = await fetch(`/api/reports/subject-register?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setRegisterData(data);
            } else {
                const err = await res.json();
                setStatus({ type: "error", message: err.error || "Failed to fetch Subject Register" });
            }
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error fetching Subject Register" });
        } finally {
            setLoading(false);
        }
    };

    const fetchConsolidated = async () => {
        if (!startDate || !endDate) return;

        if (subjectViewMode === "register") {
            await fetchSubjectRegister();
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (activeTab !== "elective") {
                if (sectionId) params.append("sectionId", sectionId);
                if (departmentId) params.append("departmentId", departmentId);
            }
            if ((activeTab === "subject" || activeTab === "elective") && subjectId) {
                params.append("subjectId", subjectId);
            }
            if (activeTab === "subject" && selectedLabBatchId) {
                params.append("labBatchId", selectedLabBatchId);
            }
            if (reportMode) {
                params.append("reportType", reportMode);
            }
            if (reportMode === "scholarship" && targetWorkingDays) {
                params.append("targetWorkingDays", targetWorkingDays);
            }
            params.append("startDate", startDate);
            params.append("endDate", endDate);

            const res = await fetch(`/api/reports/consolidated?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (reportMode === "subject_summary" && data.subjects) {
                    setSubjectSummarySubjects(data.subjects);
                    setConsolidatedData(data.students);
                } else {
                    setConsolidatedData(data);
                }
            } else {
                const err = await res.json();
                setStatus({ type: "error", message: err.error || "Failed to fetch report" });
            }
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error fetching consolidated report" });
        } finally {
            setLoading(false);
        }
    };

    const sortedConsolidatedData = useMemo(() => {
        if (!sortConfig.key) return consolidatedData;

        return [...consolidatedData].sort((a, b) => {
            let valA = a[sortConfig.key!];
            let valB = b[sortConfig.key!];

            if (sortConfig.key === "percentage") {
                valA = parseFloat(String(a.percentage || 0));
                valB = parseFloat(String(b.percentage || 0));
            } else if (sortConfig.key === "rollNumber") {
                // String comparison for roll numbers
                return sortConfig.direction === "asc"
                    ? String(valA).localeCompare(String(valB))
                    : String(valB).localeCompare(String(valA));
            }

            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
    }, [consolidatedData, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current.key === key) {
                return { key: key as any, direction: current.direction === "asc" ? "desc" : "asc" };
            }
            return { key: key as any, direction: "asc" };
        });
    };

    const handleDownloadConsolidated = () => {
        if ((activeTab === "subject" || activeTab === "elective") && subjectViewMode === "register" && registerData) {
            const exportRows = registerData.students.map(s => {
                const row: any = {
                    "Roll Number": s.rollNumber,
                    "Name": s.name
                };
                registerData.sessions.forEach(sess => {
                    const colName = `${sess.dateStr} (${sess.periodName})`;
                    row[colName] = s.attendanceMap[sess.id] || "-";
                });
                row["Total Classes"] = s.totalClasses;
                row["Present"] = s.present;
                row["Absent"] = s.absent;
                row["Percentage"] = s.percentage + "%";
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(exportRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Subject Register");
            const subName = subjects.find(s => s.id === subjectId)?.name || "Subject";
            XLSX.writeFile(wb, `${subName.replace(/\s+/g, '_')}_Register_${startDate}_to_${endDate}.xlsx`);
            return;
        }

        if (sortedConsolidatedData.length === 0) return;

        let exportRows: any[] = [];
        if (reportMode === "scholarship") {
            exportRows = sortedConsolidatedData.map(s => ({
                "Roll Number": s.rollNumber,
                "Name": s.name,
                "Govt Scholarship ID": s.scholarshipId || "N/A",
                "Total Working Days": s.totalDays,
                "Present Days": s.presentDays,
                "Absent Days": s.absentDays,
                "Attendance %": s.percentage + "%"
            }));
        } else if (reportMode === "monthly") {
            exportRows = sortedConsolidatedData.map(s => {
                const row: any = {
                    "Roll Number": s.rollNumber,
                    "Name": s.name
                };
                (s.monthlyStats || []).forEach((m: any) => {
                    row[`${m.monthLabel} (P)`] = m.present;
                    row[`${m.monthLabel} (A)`] = m.absent;
                    row[`${m.monthLabel} (C)`] = m.totalClasses;
                    row[`${m.monthLabel} (%)`] = m.percentage + "%";
                });
                return row;
            });
        } else if (reportMode === "subject_summary") {
            exportRows = sortedConsolidatedData.map(s => {
                const row: any = {
                    "Roll Number": s.rollNumber,
                    "Name": s.name
                };
                subjectSummarySubjects.forEach(sub => {
                    const subLabel = `${sub.shortName || sub.name} (Total: ${sub.totalHeld})`;
                    row[subLabel] = s.subjectStats?.[sub.id]?.present ?? 0;
                });
                row["Total Classes"] = s.totalClasses;
                row["Total Present"] = s.totalPresent || s.present;
                row["Total Absent"] = s.totalAbsent || s.absent;
                row["Attendance %"] = `${s.percentage}%`;
                return row;
            });
        } else {
            exportRows = sortedConsolidatedData.map(s => ({
                "Roll Number": s.rollNumber,
                "Name": s.name,
                "Total Classes": s.totalClasses,
                "Present": s.present,
                "Absent": s.absent,
                "Percentage": s.percentage + "%"
            }));
        }

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        const sheetTitle = reportMode === "scholarship" ? "Govt Scholarship Report" : (reportMode === "monthly" ? "Monthly Consolidation" : "Consolidated Report");
        XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
        const batchName = labBatches.find(b => b.id === selectedLabBatchId)?.name;
        const batchSuffix = batchName ? `_Batch_${batchName}` : "";
        XLSX.writeFile(wb, `${sheetTitle.replace(/\s+/g, '_')}_${startDate}_to_${endDate}${batchSuffix}.xlsx`);
    };

    const handleDownloadOverall = async () => {
        if (!startDate || !endDate) return;
        setStatus({ type: "success", message: "Generating Overall Matrix..." });

        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (sectionId) params.append("sectionId", sectionId);
            if (departmentId) params.append("departmentId", departmentId);
            params.append("startDate", startDate);
            params.append("endDate", endDate);

            const res = await fetch(`/api/reports/overall?${params}`);
            if (!res.ok) throw new Error("Failed to fetch overall data");

            const data = await res.json();
            // Data = { subjects: {name: string, total: number}[], students: { roll, name, subjects: { [sub]: number } }[] }

            // 1. Build Rows for SheetJS
            const rows: any[] = [];

            // A. Header Row: Roll No, Name, [Subject Names]
            const headerRow = ["Roll Number", "Name", ...data.subjects.map((s: any) => s.name)];
            rows.push(headerRow);

            // B. Total Classes Row: "Total Classes", "", [Subject Totals]
            const totalsRow = ["Total Classes", "", ...data.subjects.map((s: any) => s.total)];
            rows.push(totalsRow);

            // C. Student Data Rows
            data.students.forEach((s: any) => {
                const row = [s.rollNumber, s.name];
                data.subjects.forEach((sub: any) => {
                    // Check if student has data for this subject, else 0
                    // API returns simple number now (present count)
                    const presentCount = s.subjects[sub.name] !== undefined ? s.subjects[sub.name] : 0;
                    row.push(presentCount);
                });
                rows.push(row);
            });

            // 2. Create Sheet
            const ws = XLSX.utils.aoa_to_sheet(rows); // Array of Arrays to Sheet

            // 3. Auto-width columns (Optional polish)
            const wscols = [
                { wch: 15 }, // Roll
                { wch: 25 }, // Name
                ...data.subjects.map(() => ({ wch: 10 })) // Subjects
            ];
            ws['!cols'] = wscols;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Overall Summary");
            XLSX.writeFile(wb, `Overall_Subject_Summary_${startDate}_to_${endDate}.xlsx`);
            setStatus({ type: "success", message: "Overall Report Downloaded!" });

        } catch (e: any) {
            console.error(e);
            setStatus({ type: "error", message: "Failed to generate Overall Report" });
        }
    };

    const handleDownloadPDF = (action: "view" | "download" = "view") => {
        if ((activeTab === "subject" || activeTab === "elective" || activeTab === "consolidated") && subjectViewMode === "register" && registerData) {
            try {
                const doc = new jsPDF({ orientation: "landscape" });
                const pageWidth = doc.internal.pageSize.width;

                const subName = (subjectId ? subjects.find(s => s.id === subjectId)?.name : null) || "Consolidated_Class";
                const deptName = departments.find(d => d.id === departmentId)?.name || "";
                const secName = sections.find(s => s.id === sectionId)?.name || "";
                const academicYr = getAcademicYear(startDate);
                const batchStr = getBatchNameString(year, startDate);
                const labBatchName = labBatches.find(b => b.id === selectedLabBatchId)?.name;
                const fullBatchText = labBatchName ? `${batchStr} (${labBatchName})` : batchStr;

                const SESSIONS_PER_PAGE = 15;
                const totalSessions = registerData.sessions.length;
                const totalChunks = Math.max(1, Math.ceil(totalSessions / SESSIONS_PER_PAGE));
                const autoTableFn = (doc as any).autoTable || autoTable;

                for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
                    if (chunkIdx > 0) {
                        doc.addPage();
                    }

                    doc.setFont("times", "bold");
                    doc.setFontSize(12);
                    doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(A)", pageWidth / 2, 10, { align: "center" });

                    doc.setFontSize(9.5);
                    doc.text("ENGINEERING AND TECHNOLOGY PROGRAM - RUSHIKONDA, VISAKHAPATNAM", pageWidth / 2, 15, { align: "center" });

                    doc.setFontSize(11);
                    doc.setFont("times", "bold");
                    const titlePrefix = activeTab === "consolidated" ? "Consolidated Class Daily Attendance Register" : `Subject Attendance Register - ${subName}`;
                    doc.text(`${titlePrefix}${totalChunks > 1 ? ` (Part ${chunkIdx + 1} of ${totalChunks})` : ""}`, pageWidth / 2, 21, { align: "center" });

                    const chunkSessions = registerData.sessions.slice(chunkIdx * SESSIONS_PER_PAGE, (chunkIdx + 1) * SESSIONS_PER_PAGE);
                    const isLastChunk = chunkIdx === totalChunks - 1;

                    doc.setFontSize(8.5);
                    doc.setFont("times", "normal");
                    doc.text(`Department: ${deptName} | Academic Year: ${academicYr} | Batch: ${fullBatchText}`, pageWidth / 2, 26, { align: "center" });
                    
                    const chunkRangeText = totalChunks > 1 && chunkSessions.length > 0 ? ` (Part ${chunkIdx + 1}: ${chunkSessions[0].dateStr} - ${chunkSessions[chunkSessions.length - 1].dateStr})` : "";
                    doc.text(`Year: ${year} | Sem: ${semester} | Section: ${secName} | Dates: ${formatISTDate(startDate)} to ${formatISTDate(endDate)}${chunkRangeText}`, pageWidth / 2, 30, { align: "center" });

                    const tableColumn = [
                        "Roll No",
                        "Name",
                        ...chunkSessions.map(sess => `${sess.dateStr}\n${sess.periodName}`),
                        ...(isLastChunk ? ["Total", "P", "A", "%"] : [])
                    ];

                    const tableRows = registerData.students.map(s => [
                        s.rollNumber,
                        s.name,
                        ...chunkSessions.map(sess => s.attendanceMap[sess.id] || "-"),
                        ...(isLastChunk ? [s.totalClasses, s.present, s.absent, s.percentage + "%"] : [])
                    ]);

                    const chunkSessionCount = chunkSessions.length;
                    const totalIdx = 2 + chunkSessionCount;
                    const pIdx = 3 + chunkSessionCount;
                    const aIdx = 4 + chunkSessionCount;
                    const pctIdx = 5 + chunkSessionCount;

                    const columnStylesObj: Record<number, any> = {
                        0: { cellWidth: 22, halign: "left" },
                        1: { cellWidth: 35, halign: "left" }
                    };

                    if (isLastChunk) {
                        columnStylesObj[totalIdx] = { cellWidth: 12, halign: "center", fontStyle: "bold" };
                        columnStylesObj[pIdx] = { cellWidth: 10, halign: "center", fontStyle: "bold" };
                        columnStylesObj[aIdx] = { cellWidth: 10, halign: "center", fontStyle: "bold" };
                        columnStylesObj[pctIdx] = { cellWidth: 16, halign: "center", fontStyle: "bold" };
                    }

                    if (typeof autoTableFn === 'function') {
                        autoTableFn(doc, {
                            head: [tableColumn],
                            body: tableRows,
                            startY: 34,
                            theme: "grid",
                            styles: {
                                font: "times",
                                fontSize: 7.5,
                                cellPadding: 1.2,
                                halign: "center",
                                lineColor: [0, 0, 0],
                                lineWidth: 0.3
                            },
                            headStyles: {
                                fillColor: [240, 243, 246],
                                textColor: [30, 41, 59],
                                fontStyle: "bold",
                                halign: "center",
                                fontSize: 7.5,
                                cellPadding: 1.5,
                                lineColor: [0, 0, 0],
                                lineWidth: 0.4
                            },
                            columnStyles: columnStylesObj,
                            didParseCell: (data: any) => {
                                if (data.section === 'body') {
                                    const val = data.cell.raw ? String(data.cell.raw) : "";
                                    if (val === "P") {
                                        data.cell.styles.fillColor = [220, 252, 231];
                                        data.cell.styles.textColor = [22, 101, 52];
                                        data.cell.styles.fontStyle = "bold";
                                    } else if (val === "A") {
                                        data.cell.styles.fillColor = [254, 226, 226];
                                        data.cell.styles.textColor = [153, 27, 27];
                                        data.cell.styles.fontStyle = "bold";
                                    } else if (val.endsWith("%")) {
                                        const pct = parseFloat(val.replace("%", ""));
                                        if (!isNaN(pct)) {
                                            if (pct >= 75) {
                                                data.cell.styles.fillColor = [220, 252, 231];
                                                data.cell.styles.textColor = [22, 101, 52];
                                            } else if (pct >= 65) {
                                                data.cell.styles.fillColor = [254, 243, 199];
                                                data.cell.styles.textColor = [146, 64, 14];
                                            } else {
                                                data.cell.styles.fillColor = [254, 226, 226];
                                                data.cell.styles.textColor = [153, 27, 27];
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }

                if (action === "view") {
                    const pdfBlob = doc.output("blob");
                    const blobUrl = URL.createObjectURL(pdfBlob);
                    window.open(blobUrl, "_blank");
                    setStatus({ type: "success", message: "Opening PDF in new tab..." });
                } else {
                    doc.save(`${subName.replace(/\s+/g, '_')}_Register_${startDate}_to_${endDate}.pdf`);
                    setStatus({ type: "success", message: "Register PDF Downloaded!" });
                }
            } catch (err) {
                console.error(err);
                setStatus({ type: "error", message: "Failed to generate Register PDF" });
            }
            return;
        }

        console.log("PDF: Button clicked");
        try {
            if (consolidatedData.length === 0) {
                console.warn("PDF: No data");
                setStatus({ type: "error", message: "No data to print." });
                return;
            }

            setStatus({ type: "success", message: "Generating PDF..." }); // Show status

            const doc = new jsPDF(reportMode === "subject_summary" ? "l" : "p", "mm", "a4");
            const pageWidth = doc.internal.pageSize.width;

            // --- Header ---
            const logoUrl = "/logo.png";
            const img = new Image();
            img.src = logoUrl;

            const generate = () => {
                console.log("PDF: Generating content...");
                try {
                    // College Name
                    doc.setFont("times", "bold");
                    doc.setFontSize(11); // Reduced size to fit long name
                    const textX = 42; // Start text after the logo (Logo X=15 + Width=20 + Gap)

                    doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(A)", textX, 18);

                    // College Sub-Header 1
                    doc.setFontSize(10);
                    doc.text("ENGINEERING AND TECHNOLOGY PROGRAM", textX, 23);

                    // College Sub-Header 2
                    doc.setFontSize(10);
                    doc.text("RUSHIKONDA, VISAKHAPATNAM", textX, 28);

                    // Line Separator
                    doc.setLineWidth(0.5);
                    doc.line(15, 35, pageWidth - 15, 35);

                    // Report Details
                    doc.setFont("times", "normal");
                    doc.setFontSize(11);

                    const deptName = departments.find(d => d.id === departmentId)?.name || "Department";
                    const secName = sections.find(s => s.id === sectionId)?.name || "All";
                    const subName = subjects.find(s => s.id === subjectId)?.name;
                    const academicYr = getAcademicYear(startDate);
                    const batchStr = getBatchNameString(year, startDate);
                    const labBatchName = labBatches.find(b => b.id === selectedLabBatchId)?.name;
                    const fullBatchText = labBatchName ? `${batchStr} (${labBatchName})` : batchStr;

                    // Left Side Details
                    doc.text(`Department: ${deptName}`, 15, 41);
                    doc.text(`Academic Year: ${academicYr}     Batch: ${fullBatchText}`, 15, 46);
                    doc.text(`Year: ${year}   Semester: ${semester}   Section: ${secName}${subName ? `   Subject: ${subName}` : ""}`, 15, 51);

                    // Right Side Details
                    doc.text(`Report Type: Consolidated`, pageWidth - 15, 41, { align: "right" });
                    doc.text(`From: ${formatISTDate(startDate)}`, pageWidth - 15, 46, { align: "right" });
                    doc.text(`To: ${formatISTDate(endDate)}`, pageWidth - 15, 51, { align: "right" });

                    // Title
                    doc.setFont("times", "bold");
                    doc.setFontSize(13);
                    const titleText = reportMode === "scholarship" ? "Govt Scholarship Day-Wise Attendance Report" : (reportMode === "monthly" ? "Progressive Monthly Attendance Report" : (reportMode === "subject_summary" ? "Consolidated Subject-Wise Attendance Summary" : "Attendance Report"));
                    doc.text(titleText, pageWidth / 2, reportMode === "subject_summary" ? 58 : 64, { align: "center" });

                    // --- Table ---
                    let tableColumn: string[] = [];
                    let tableRows: any[] = [];

                    if (reportMode === "scholarship") {
                        tableColumn = ["Roll No", "Name", "Scholarship ID", "Total Days", "Present", "Absent", "%"];
                        tableRows = sortedConsolidatedData.map(s => [
                            s.rollNumber,
                            s.name,
                            s.scholarshipId || "N/A",
                            s.totalDays,
                            s.presentDays,
                            s.absentDays,
                            s.percentage + "%"
                        ]);
                    } else if (reportMode === "monthly") {
                        const monthLabels = (sortedConsolidatedData[0]?.monthlyStats || []).map((m: any) => m.monthLabel);
                        tableColumn = ["Roll No", "Name", ...monthLabels.map((l: string) => `${l} %`)];
                        tableRows = sortedConsolidatedData.map(s => [
                            s.rollNumber,
                            s.name,
                            ...(s.monthlyStats || []).map((m: any) => m.percentage + "%")
                        ]);
                    } else if (reportMode === "subject_summary") {
                        tableColumn = [
                            "Roll No",
                            "Name",
                            ...subjectSummarySubjects.map((sub: any) => `${sub.shortName || sub.name}\n(${sub.totalHeld})`),
                            "Total",
                            "P",
                            "A",
                            "%"
                        ];
                        tableRows = sortedConsolidatedData.map(s => [
                            s.rollNumber,
                            s.name,
                            ...subjectSummarySubjects.map((sub: any) => s.subjectStats?.[sub.id]?.present ?? 0),
                            s.totalClasses,
                            s.totalPresent || s.present,
                            s.totalAbsent || s.absent,
                            s.percentage + "%"
                        ]);
                    } else {
                        tableColumn = ["Roll No", "Name", "Total", "Present", "Absent", "%"];
                        tableRows = sortedConsolidatedData.map(s => [
                            s.rollNumber,
                            s.name,
                            s.totalClasses,
                            s.present,
                            s.absent,
                            s.percentage + "%"
                        ]);
                    }

                    const didParseCellFn = (data: any) => {
                        if (data.section === 'body') {
                            const textVal = data.cell.raw ? String(data.cell.raw) : "";
                            if (textVal.endsWith("%")) {
                                const pct = parseFloat(textVal.replace("%", ""));
                                if (!isNaN(pct)) {
                                    if (pct >= 75) {
                                        data.cell.styles.fillColor = [220, 252, 231];
                                        data.cell.styles.textColor = [22, 101, 52];
                                    } else if (pct >= 65) {
                                        data.cell.styles.fillColor = [254, 243, 199];
                                        data.cell.styles.textColor = [146, 64, 14];
                                    } else {
                                        data.cell.styles.fillColor = [254, 226, 226];
                                        data.cell.styles.textColor = [153, 27, 27];
                                    }
                                }
                            }
                        }
                    };

                    const isSubjectSummary = reportMode === "subject_summary";
                    const columnStylesConfig: any = {};

                    if (isSubjectSummary) {
                        columnStylesConfig[0] = { cellWidth: 22, halign: "center" }; // Roll No
                        columnStylesConfig[1] = { cellWidth: 42, halign: "left" };   // Name
                        const subCount = subjectSummarySubjects.length;
                        for (let c = 2; c < 2 + subCount; c++) {
                            columnStylesConfig[c] = { halign: "center" };
                        }
                        columnStylesConfig[2 + subCount] = { cellWidth: 12, halign: "center", fontStyle: "bold" };     // Total
                        columnStylesConfig[2 + subCount + 1] = { cellWidth: 10, halign: "center", fontStyle: "bold" }; // P
                        columnStylesConfig[2 + subCount + 2] = { cellWidth: 10, halign: "center", fontStyle: "bold" }; // A
                        columnStylesConfig[2 + subCount + 3] = { cellWidth: 14, halign: "center", fontStyle: "bold" }; // %
                    }

                    console.log("PDF: Drawing table...", tableRows.length);
                    const autoTableFn = (doc as any).autoTable || autoTable;
                    if (typeof autoTableFn === 'function') {
                        autoTableFn(doc, {
                            head: [tableColumn],
                            body: tableRows,
                            startY: isSubjectSummary ? 62 : 68,
                            theme: "grid",
                            styles: {
                                font: "times",
                                fontSize: isSubjectSummary ? 7.5 : 9.5,
                                cellPadding: isSubjectSummary ? { top: 1.5, bottom: 1.5, left: 1, right: 1 } : 2.5,
                                lineColor: [0, 0, 0],
                                lineWidth: 0.3,
                                valign: "middle"
                            },
                            headStyles: {
                                fillColor: [240, 243, 246],
                                textColor: [15, 23, 42],
                                fontStyle: "bold",
                                fontSize: isSubjectSummary ? 7 : 9,
                                lineWidth: 0.4,
                                lineColor: [0, 0, 0],
                                halign: "center",
                                valign: "middle"
                            },
                            columnStyles: columnStylesConfig,
                            didParseCell: didParseCellFn
                        });
                    } else {
                        console.error("PDF: autoTable plugin not found");
                        alert("PDF Plugin Error: autoTable not found");
                        setStatus({ type: "error", message: "PDF Plugin Error" });
                        return;
                    }

                    // Footer
                    const pageCount = (doc as any).internal.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                        doc.setPage(i);
                        doc.setFontSize(8);
                        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, doc.internal.pageSize.height - 10, { align: "right" });
                        doc.text(`Generated on ${formatISTDate(new Date())}`, 15, doc.internal.pageSize.height - 10);
                    }

                    if (action === "view") {
                        const pdfBlob = doc.output("blob");
                        const blobUrl = URL.createObjectURL(pdfBlob);
                        window.open(blobUrl, "_blank");
                        setStatus({ type: "success", message: "Opening PDF in new tab..." });
                    } else {
                        doc.save(`Consolidated_Report_${startDate}_${endDate}.pdf`);
                        setStatus({ type: "success", message: "PDF Downloaded!" });
                    }

                } catch (err: any) {
                    console.error("PDF Generation Internal Error:", err);
                    alert("Failed to generate PDF content: " + err.message);
                    setStatus({ type: "error", message: "PDF Logic Error" });
                }
            };

            let imageLoaded = false;

            const onImageComplete = () => {
                if (imageLoaded) return;
                imageLoaded = true;

                try {
                    if (img.complete && img.naturalHeight !== 0) {
                        const logoWidth = 20;
                        const logoHeight = (img.height / img.width) * logoWidth;
                        doc.addImage(img, 'PNG', 15, 10, logoWidth, logoHeight);
                    }
                } catch (e) {
                    console.warn("PDF: Logo load failed", e);
                }
                generate();
            };

            img.onload = onImageComplete;
            img.onerror = () => {
                console.warn("PDF: Logo failed to load (onerror)");
                onImageComplete();
            };

            // Fallback watchdog
            setTimeout(() => {
                if (!imageLoaded) {
                    console.warn("PDF: Image load timeout");
                    onImageComplete();
                }
            }, 800);

        } catch (e: any) {
            console.error("PDF Outer Error:", e);
            alert("An unexpected error occurred while starting PDF: " + e.message);
        }
    };

    const handleView = (record: any) => {
        if (!record.details || record.details === "[]") {
            setStatus({ type: "error", message: "No details available." });
            return;
        }
        try {
            const data = JSON.parse(record.details);
            let present = 0;
            let absent = 0;
            data.forEach((s: any) => {
                if (s.Status === "Present") present++;
                else absent++;
            });
            setViewStats({ present, absent, total: data.length });
            setViewRecord(record);
            setIsViewModalOpen(true);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Error reading details." });
        }
    };

    const handleDownloadFull = () => {
        if (!viewRecord || !viewRecord.details) return;
        try {
            const data = JSON.parse(viewRecord.details);
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendance");
            const deptStr = viewRecord.department?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "Dept";
            const subjectStr = viewRecord.subject?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "SMS";
            const dateStr = formatISTDate(viewRecord.date);
            const filename = `Attendance_${deptStr}_Yr-${viewRecord.year}_Sem-${viewRecord.semester}_Sec-${viewRecord.section?.name}_${subjectStr}_${dateStr}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (e) { console.error(e); }
    };

    const handleDownloadAbsentees = () => {
        if (!viewRecord || !viewRecord.details) return;
        try {
            const data = JSON.parse(viewRecord.details);
            const absentees = data.filter((s: any) => s.Status === "Absent").map((s: any) => ({
                "Roll Number": s["Roll Number"],
                "Name": s["Name"],
                "Mobile": s["Mobile"],
                "Status": "Absent"
            }));

            if (absentees.length === 0) {
                alert("No absentees in this record.");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(absentees);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Absentees");
            const deptStr = viewRecord.department?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "Dept";
            const subjectStr = viewRecord.subject?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "SMS";
            const dateStr = formatISTDate(viewRecord.date);
            const filename = `Absentees_${deptStr}_Yr-${viewRecord.year}_Sem-${viewRecord.semester}_Sec-${viewRecord.section?.name}_${subjectStr}_${dateStr}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/attendance/history/${id}`, { method: "DELETE" });
            if (res.ok) {
                setHistory(prev => prev.filter(h => h.id !== id));
                setStatus({ type: "success", message: "Deleted successfully" });
            } else {
                setStatus({ type: "error", message: "Failed to delete" });
            }
            setIsDeleteModalOpen(false);
        } catch (error) {
            setStatus({ type: "error", message: "Error deleting" });
        }
    };

    const openEditModal = (record: any) => {
        try {
            const details = JSON.parse(record.details);
            setEditDetails(details);
            setEditingRecord(record);
            setIsEditModalOpen(true);
        } catch (e) {
            setStatus({ type: "error", message: "Cannot edit this record (invalid data)" });
        }
    };

    const toggleAttendance = (index: number) => {
        const newDetails = [...editDetails];
        const currentStatus = newDetails[index]["Status"];
        newDetails[index]["Status"] = currentStatus === "Absent" ? "Present" : "Absent";
        setEditDetails(newDetails);
    };

    const saveEdits = async () => {
        if (!editingRecord) return;
        try {
            const res = await fetch(`/api/attendance/history/${editingRecord.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    details: editDetails,
                    status: "Modified" // Optional label update
                })
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Attendance updated successfully" });
                fetchHistory(); // Refresh list to update status label if needed
                setIsEditModalOpen(false);
                setEditingRecord(null);
            } else {
                setStatus({ type: "error", message: "Failed to update" });
            }
        } catch (e) {
            setStatus({ type: "error", message: "Error updating" });
        }
    };

    const fetchDefaulterReport = async () => {
        if (!departmentId || !year || !semester || !sectionId || !startDate || !endDate) {
            setStatus({ type: "error", message: "Please select Department, Year, Sem, Section, Start Date, and End Date." });
            return;
        }
        setDefaulterLoading(true);
        try {
            const params = new URLSearchParams({
                departmentId,
                year,
                semester,
                sectionId,
                startDate,
                endDate,
                threshold: defaulterThreshold
            });
            const res = await fetch(`/api/reports/defaulter?${params}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch defaulter report");
            }
            const data = await res.json();
            setDefaulterData(data);
        } catch (e: any) {
            setStatus({ type: "error", message: e.message });
        } finally {
            setDefaulterLoading(false);
        }
    };

    const fetchComparativeReport = async () => {
        if (!departmentId || !year || !semester || !startDate || !endDate) {
            setStatus({ type: "error", message: "Please select Department, Year, Semester, Start Date, and End Date." });
            return;
        }
        setComparativeLoading(true);
        try {
            const params = new URLSearchParams({
                departmentId,
                year,
                semester,
                startDate,
                endDate
            });
            const res = await fetch(`/api/reports/comparative?${params}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch comparative report");
            }
            const data = await res.json();
            setComparativeData(data);
        } catch (e: any) {
            setStatus({ type: "error", message: e.message });
        } finally {
            setComparativeLoading(false);
        }
    };

    const fetchTranscriptReport = async () => {
        if (!transcriptRollNo) {
            setStatus({ type: "error", message: "Please enter a Student Roll Number." });
            return;
        }
        setTranscriptLoading(true);
        try {
            const params = new URLSearchParams({ rollNumber: transcriptRollNo });
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            const res = await fetch(`/api/reports/transcript?${params}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch student transcript");
            }
            const data = await res.json();
            setTranscriptData(data);
        } catch (e: any) {
            setStatus({ type: "error", message: e.message });
        } finally {
            setTranscriptLoading(false);
        }
    };

    const handleDownloadDefaulterNoticePDF = (student: any) => {
        try {
            const doc = new jsPDF({ orientation: "portrait" });
            const pageWidth = doc.internal.pageSize.width;

            doc.setFont("times", "bold");
            doc.setFontSize(12);
            doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(A)", pageWidth / 2, 12, { align: "center" });

            doc.setFontSize(10);
            doc.text("ENGINEERING AND TECHNOLOGY PROGRAM - RUSHIKONDA, VISAKHAPATNAM", pageWidth / 2, 17, { align: "center" });
            doc.setFontSize(11);
            doc.text("OFFICIAL PARENT WARNING NOTICE (ATTENDANCE SHORTAGE)", pageWidth / 2, 23, { align: "center" });

            doc.setLineWidth(0.4);
            doc.line(15, 27, pageWidth - 15, 27);

            const academicYr = getAcademicYear(startDate);
            const batchStr = getBatchNameString(year, startDate);

            doc.setFont("times", "normal");
            doc.setFontSize(10);
            doc.text(`Ref No: GVP/ETH/ATT/${new Date().getFullYear()}/${student.rollNumber}`, 15, 33);
            doc.text(`Date: ${formatISTDate(new Date().toISOString())}`, pageWidth - 15, 33, { align: "right" });

            doc.text(`To Parent / Guardian of: ${student.parentName}`, 15, 41);
            doc.text(`Student Name: ${student.name}`, 15, 47);
            doc.text(`Roll Number: ${student.rollNumber}   |   Contact: ${student.mobile}`, 15, 53);
            doc.text(`Academic Year: ${academicYr}   |   Batch: ${batchStr}`, 15, 59);

            const autoTableFn = (doc as any).autoTable || autoTable;
            if (typeof autoTableFn === 'function') {
                autoTableFn(doc, {
                    head: [["Total Classes Held", "Attended Classes", "Absent Classes", "Attendance %", "Shortage %", "Status"]],
                    body: [[student.totalClasses, student.present, student.absent, student.percentage + "%", student.shortagePercentage + "%", student.statusLabel]],
                    startY: 65,
                    theme: "grid",
                    styles: { font: "times", fontSize: 10, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 },
                    headStyles: { fillColor: [240, 243, 246], textColor: [15, 23, 42], fontStyle: "bold", lineColor: [0, 0, 0], lineWidth: 0.4 }
                });
            }

            const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 95;

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            const noticeBody = [
                "WARNING REGARDING EXAM ELIGIBILITY:",
                "As per Gayatri Vidya Parishad College academic regulations, a minimum of 75% attendance is MANDATORY to be eligible for semester end examinations.",
                "• Attendance between 65.00% and 74.99% requires payment of a Condonation Fee subject to medical board approval.",
                "• Attendance below 65.00% results in DETENTION, rendering the student ineligible for semester examinations.",
                "",
                "Please advise your ward to attend all regular classes without fail."
            ];

            let yOffset = currentY;
            noticeBody.forEach((line) => {
                doc.text(line, 15, yOffset);
                yOffset += 6;
            });

            const sigY = yOffset + 25;
            doc.setFont("times", "bold");
            doc.text("Parent / Guardian Signature", 20, sigY);
            doc.text("HOD Signature", pageWidth / 2, sigY, { align: "center" });
            doc.text("Director / Principal", pageWidth - 20, sigY, { align: "right" });

            doc.save(`Parent_Warning_Notice_${student.rollNumber}.pdf`);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Failed to generate Parent Notice PDF" });
        }
    };

    const handleDownloadTranscriptPDF = () => {
        if (!transcriptData) return;
        try {
            const doc = new jsPDF({ orientation: "portrait" });
            const pageWidth = doc.internal.pageSize.width;

            doc.setFont("times", "bold");
            doc.setFontSize(12);
            doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(A)", pageWidth / 2, 12, { align: "center" });
            doc.setFontSize(10);
            doc.text("ENGINEERING AND TECHNOLOGY PROGRAM - RUSHIKONDA, VISAKHAPATNAM", pageWidth / 2, 17, { align: "center" });
            doc.setFontSize(11);
            doc.text("STUDENT CUMULATIVE ATTENDANCE TRANSCRIPT", pageWidth / 2, 23, { align: "center" });

            doc.setLineWidth(0.4);
            doc.line(15, 27, pageWidth - 15, 27);

            const st = transcriptData.student;
            const ov = transcriptData.overall;

            doc.setFont("times", "normal");
            doc.setFontSize(10);
            doc.text(`Roll Number: ${st.rollNumber}   |   Name: ${st.name}`, 15, 33);
            doc.text(`Department: ${st.departmentName}   |   Year: ${st.year}   |   Sem: ${st.semester}   |   Sec: ${st.sectionName}`, 15, 39);
            doc.text(`Parent: ${st.parentName}   |   Mobile: ${st.mobile}`, 15, 45);

            const tableCols = ["Subject Code/Name", "Faculty", "Classes Held", "Attended", "Absent", "%"];
            const tableRows = transcriptData.subjectBreakdown.map((sub: any) => [
                sub.name,
                sub.facultyName,
                sub.totalHeld,
                sub.present,
                sub.absent,
                sub.percentage + "%"
            ]);

            tableRows.push(["OVERALL SUMMARY", "-", ov.totalHeld, ov.totalPresent, ov.totalAbsent, ov.percentage + "%"]);

            const autoTableFn = (doc as any).autoTable || autoTable;
            if (typeof autoTableFn === 'function') {
                autoTableFn(doc, {
                    head: [tableCols],
                    body: tableRows,
                    startY: 50,
                    theme: "grid",
                    styles: { font: "times", fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.3 },
                    headStyles: { fillColor: [240, 243, 246], textColor: [15, 23, 42], fontStyle: "bold", lineColor: [0, 0, 0], lineWidth: 0.4 }
                });
            }

            const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 25 : 120;
            doc.setFont("times", "bold");
            doc.setFontSize(10);
            doc.text("Parent / Guardian Signature", 20, currentY);
            doc.text("HOD Signature", pageWidth / 2, currentY, { align: "center" });
            doc.text("Director / Principal", pageWidth - 20, currentY, { align: "right" });

            doc.save(`Attendance_Transcript_${st.rollNumber}.pdf`);
        } catch (e) {
            console.error(e);
            setStatus({ type: "error", message: "Failed to generate Transcript PDF" });
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            {status.message && !isDeleteModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
                <p className="text-sm text-slate-500">View, edit, and manage attendance reports.</p>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex space-x-1 rounded-xl bg-slate-100 p-1 sm:w-fit">
                <button
                    onClick={() => setActiveTab("daily")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                        }`}
                >
                    Daily Reports
                </button>
                <button
                    onClick={() => setActiveTab("consolidated")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "consolidated" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                        }`}
                >
                    Consolidated Reports
                </button>
                <button
                    onClick={() => setActiveTab("subject")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "subject" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                        }`}
                >
                    Subject Reports
                </button>
                <button
                    onClick={() => setActiveTab("weekly")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "weekly" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                        }`}
                >
                    Weekly View
                </button>
                <button
                    onClick={() => setActiveTab("elective")}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "elective" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                        }`}
                >
                    Open Elective Reports
                </button>
                {["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes((session?.user?.role || "").toUpperCase()) && (
                    <>
                        <button
                            onClick={() => setActiveTab("tracker")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "tracker" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Submission Tracker
                        </button>
                        <button
                            onClick={() => setActiveTab("defaulter")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "defaulter" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Defaulter List (Notice)
                        </button>
                        <button
                            onClick={() => setActiveTab("comparative")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "comparative" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Comparative View
                        </button>
                        <button
                            onClick={() => setActiveTab("transcript")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === "transcript" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                                }`}
                        >
                            Student Transcript
                        </button>
                    </>
                )}
            </div>

            {/* Daily Attendance Reports Section */}
            {activeTab === "daily" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Daily Attendance Reports</h2>

                    {/* Filters */}
                    <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
                        {isGlobal && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Department</label>
                                <select
                                    value={departmentId}
                                    onChange={(e) => setDepartmentId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                >
                                    <option value="">All Departments</option>
                                    {departments.map((dept) => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">All Years</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">All Semesters</option>
                            <option value="1">1st Sem</option>
                            <option value="2">2nd Sem</option>
                        </select>
                        <select
                            value={sectionId}
                            onChange={(e) => setSectionId(e.target.value)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">All Sections</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">Date</th>
                                        <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">Class</th>
                                        <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">Status</th>
                                        <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500">View</th>
                                        <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase text-slate-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500"><div className="flex justify-center"><LogoSpinner fullScreen={false} /></div></td></tr> :
                                        history.length === 0 ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No reports found.</td></tr> :
                                            history.map((record) => (
                                                <tr key={record.id} className="hover:bg-slate-50/80">
                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        {formatISTDateTime(record.date)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-900 truncate max-w-[150px] sm:max-w-[200px]" title={record.department?.name || "Unknown Dept"}>
                                                            {record.department?.name || "Unknown Dept"}
                                                        </div>
                                                        <div className="text-xs text-slate-500">Yr {record.year} - Sem {record.semester} - Sec {record.section?.name}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${record.status?.includes("Absent") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                                                            }`}>
                                                            {record.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button onClick={() => handleView(record)} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 font-medium">
                                                            <FaEye /> View Details
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD"].includes((session?.user?.role || "").toUpperCase()) && (
                                                            <>
                                                                <button onClick={() => openEditModal(record)} className="mr-3 text-blue-600 hover:text-blue-800" title="Edit">
                                                                    <FaEdit />
                                                                </button>
                                                                <button onClick={() => { setRecordToDelete(record); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-800" title="Delete">
                                                                    <FaTrash />
                                                                </button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Consolidated Reports Section */}
            {activeTab === "consolidated" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Consolidated Attendance</h2>
                    <p className="mb-4 text-sm text-slate-500">View attendance percentage for the entire class across all subjects.</p>

                    {/* Filters & Actions */}
                    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">View Format:</span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setSubjectViewMode("summary"); setReportMode("standard"); }}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "summary" && reportMode === "standard" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Standard Overall
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSubjectViewMode("summary"); setReportMode("subject_summary"); }}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "summary" && reportMode === "subject_summary" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Consolidated Subject-Wise
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSubjectViewMode("summary"); setReportMode("scholarship"); }}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "summary" && reportMode === "scholarship" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Govt Scholarship (Majority Rule)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSubjectViewMode("summary"); setReportMode("monthly"); }}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "summary" && reportMode === "monthly" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Progressive Monthly
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSubjectViewMode("register")}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "register" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Daily Register Matrix (Date-Wise)
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                        <div className="grid grid-cols-1 gap-4 flex-grow sm:grid-cols-2 lg:grid-cols-4">
                            {isGlobal && (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Department</label>
                                    <select
                                        value={departmentId}
                                        onChange={(e) => setDepartmentId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="">Select Dept</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Year</label>
                                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    <option value="">Select Year</option>
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Semester</label>
                                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    <option value="">Select Sem</option>
                                    <option value="1">1st Sem</option>
                                    <option value="2">2nd Sem</option>
                                </select>
                            </div>
                        </div>



                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">Section</label>
                            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                <option value="">Select Section</option>
                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">Start Date</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500">End Date</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                        <div className="flex gap-2">
                            <button
                                onClick={clearFilters}
                                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-red-600"
                            >
                                Clear
                            </button>
                            <button
                                onClick={fetchConsolidated}
                                disabled={!year || !semester || !sectionId || !startDate || !endDate}
                                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            )}

            {/* Subject Reports Section */}
            {
                activeTab === "subject" && (
                    <div className="mb-8">
                        <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Subject-wise Reports</h2>
                        <p className="mb-4 text-sm text-slate-500">View attendance for specific subjects or generate an overall summary matrix.</p>

                        {/* Filters & Actions */}
                        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">View Format:</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSubjectViewMode("summary")}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "summary" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Summary View
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSubjectViewMode("register")}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "register" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        Daily Register Matrix (Date-Wise)
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {isGlobal && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500">Department</label>
                                        <select
                                            value={departmentId}
                                            onChange={(e) => setDepartmentId(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="">Select Dept</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Year</label>
                                    <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">Select Year</option>
                                        <option value="1">1st Year</option>
                                        <option value="2">2nd Year</option>
                                        <option value="3">3rd Year</option>
                                        <option value="4">4th Year</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Semester</label>
                                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">Select Sem</option>
                                        <option value="1">1st Sem</option>
                                        <option value="2">2nd Sem</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Section</label>
                                    <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">Select Section</option>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className={`mt-4 grid grid-cols-2 gap-4 md:mt-0 md:w-full ${isLabSubject && labBatches.length > 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
                                <div className="space-y-1 col-span-2 md:col-span-1">
                                    <label className="text-xs font-semibold text-slate-500">Subject</label>
                                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">All Subjects</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                    </select>
                                </div>
                                {isLabSubject && labBatches.length > 0 && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500">Lab Batch</label>
                                        <select
                                            value={selectedLabBatchId}
                                            onChange={(e) => setSelectedLabBatchId(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="">All Batches</option>
                                            {labBatches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Start Date</label>
                                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">End Date</label>
                                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full" />
                                </div>
                                <div className="flex flex-col justify-end gap-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={clearFilters}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-red-600"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={fetchConsolidated}
                                            disabled={!year || !semester || !sectionId || !startDate || !endDate}
                                            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Generate
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {!isFaculty && (
                                <div className="mt-4 flex w-full justify-end border-t border-slate-100 pt-4">
                                    <button
                                        onClick={handleDownloadOverall}
                                        disabled={!year || !semester || !sectionId || !startDate || !endDate}
                                        className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                    >
                                        <FaFileExcel /> Download Overall Subject Summary (Excel)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Weekly Timetable View */}
            {
                activeTab === "weekly" && (
                    <div className="mb-8">
                        <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Weekly Class Report</h2>
                        <p className="mb-4 text-sm text-slate-500">Visual attendance grid for the selected week.</p>

                        {/* Filters */}
                        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                                {isGlobal && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500">Department</label>
                                        <select
                                            value={departmentId}
                                            onChange={(e) => setDepartmentId(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        >
                                            <option value="">Select Dept</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Year</label>
                                    <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">Select Year</option>
                                        <option value="1">1st Year</option>
                                        <option value="2">2nd Year</option>
                                        <option value="3">3rd Year</option>
                                        <option value="4">4th Year</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Semester</label>
                                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">Select Sem</option>
                                        <option value="1">1st Sem</option>
                                        <option value="2">2nd Sem</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Section</label>
                                    <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                        <option value="">Select Section</option>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500">Select Week</label>
                                    <input
                                        type="date"
                                        value={weekDate}
                                        onChange={(e) => setWeekDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <div className="flex gap-2">
                                    <button
                                        onClick={clearFilters}
                                        className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-red-600"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={fetchWeeklyData}
                                        disabled={!departmentId || !year || !semester || !sectionId || !weekDate}
                                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Load Timetable
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Grid */}
                        {weekDays.length > 0 && (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="border-b border-r bg-slate-50 px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 w-32 sticky left-0 z-10">Day / Period</th>
                                            {periods.map(p => (
                                                <th key={p.id} className="min-w-[140px] border-b border-r bg-slate-50 px-4 py-3 text-center text-xs font-bold uppercase text-slate-500">
                                                    {p.name}<br />
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        {p.startTime} - {p.endTime}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekDays.map(day => {
                                            const dateKey = day.toISOString().split('T')[0];
                                            const dayData = weeklyData[dateKey] || {};
                                            const dayName = day.toLocaleDateString("en-US", { weekday: 'long' });

                                            return (
                                                <tr key={dateKey} className="divide-x divide-slate-100 border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                                    <td className="bg-slate-50/50 px-4 py-4 text-sm font-semibold text-slate-700 sticky left-0 z-10 border-r w-32">
                                                        <div className="flex flex-col">
                                                            <span>{day.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: 'long' })}</span>
                                                            <span className="text-xs font-normal text-slate-400">{formatISTDate(day)}</span>
                                                        </div>
                                                    </td>
                                                    {periods.map((p, index) => {
                                                        const record = dayData[p.id];

                                                        // Helper: Check if previous period had SAME subject to decide if we hide this cell
                                                        if (index > 0) {
                                                            const prevRecord = dayData[periods[index - 1].id];
                                                            if (record && prevRecord && record.subjectId === prevRecord.subjectId) return null;
                                                        }

                                                        // Helper: Calculate colSpan for lookahead
                                                        let colSpan = 1;
                                                        if (record) {
                                                            for (let i = index + 1; i < periods.length; i++) {
                                                                if (dayData[periods[i].id]?.subjectId === record.subjectId) colSpan++;
                                                                else break;
                                                            }
                                                        }

                                                        let content = <span className="text-xs text-slate-300 italic">No Class</span>;
                                                        let bgStyle = {};

                                                        if (record) {
                                                            // Calculate Stats
                                                            let present = 0, total = 0;
                                                            try {
                                                                const details = JSON.parse(record.details);
                                                                total = details.length;
                                                                present = details.filter((s: any) => s.Status === "Present").length;
                                                            } catch (e) { }

                                                            const absent = total - present;
                                                            const presentPct = total > 0 ? (present / total) * 100 : 0;
                                                            const absentPct = 100 - presentPct;

                                                            bgStyle = {
                                                                background: `linear-gradient(to right, #dcfce7 ${presentPct}%, #fee2e2 ${presentPct}%)`
                                                            };

                                                            content = (
                                                                <div
                                                                    className="group relative flex h-full w-full flex-col items-center justify-center rounded-lg border border-slate-900 py-2 cursor-pointer shadow-sm transition-transform hover:scale-[1.02]"
                                                                    style={bgStyle}
                                                                >
                                                                    <span className="font-bold text-slate-900 text-sm text-center px-1 leading-tight">{record.subject?.name || "Subject"}</span>


                                                                    {/* Tooltip */}
                                                                    <div className="absolute bottom-full mb-2 hidden w-48 flex-col rounded-lg bg-slate-900 p-3 text-xs text-white shadow-xl group-hover:flex z-50 ring-1 ring-white/10">
                                                                        <div className="font-bold mb-2 border-b border-slate-700 pb-2 text-sm">{record.subject?.name}</div>
                                                                        {colSpan > 1 && <div className="mb-2 inline-block self-start rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300 font-bold uppercase tracking-wider border border-indigo-500/30">{colSpan}-Hour Session</div>}
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between"><span>Total:</span> <span className="font-mono">{total}</span></div>
                                                                            <div className="flex justify-between text-green-300"><span>Present:</span> <span className="font-mono">{present} ({Math.round(presentPct)}%)</span></div>
                                                                            <div className="flex justify-between text-red-300"><span>Absent:</span> <span className="font-mono">{absent}</span></div>
                                                                        </div>
                                                                        <div className="mt-2 text-[10px] text-slate-400 text-center italic">Click to View Details</div>
                                                                        {/* Arrow */}
                                                                        <div className="absolute top-full left-1/2 -ml-1 h-2 w-2 -translate-y-1 rotate-45 bg-slate-900"></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <td
                                                                key={p.id}
                                                                colSpan={colSpan}
                                                                className="h-24 p-1 align-middle transition-all relative border-r border-b border-slate-100 last:border-r-0"
                                                                onClick={() => record && handleView(record)}
                                                            >
                                                                {content}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Open Elective Reports Section */}
            {activeTab === "elective" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Open Elective Reports</h2>
                    <p className="mb-4 text-sm text-slate-500">View consolidated attendance for open elective subjects across all sections and departments.</p>

                    {/* Filters & Actions */}
                    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">View Format:</span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSubjectViewMode("summary")}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "summary" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                >
                                    Summary View
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSubjectViewMode("register")}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${subjectViewMode === "register" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                >
                                    Daily Register Matrix (Date-Wise)
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Year</label>
                                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    <option value="">Select Year</option>
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Semester</label>
                                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    <option value="">Select Sem</option>
                                    <option value="1">1st Sem</option>
                                    <option value="2">2nd Sem</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Elective Subject</label>
                                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    <option value="">Select Elective</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:items-end">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Start Date</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">End Date</label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full" />
                            </div>
                            <div className="flex flex-col justify-end gap-2">
                                <div className="flex gap-2">
                                    <button
                                        onClick={clearFilters}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-red-600"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={fetchConsolidated}
                                        disabled={!year || !semester || !subjectId || !startDate || !endDate}
                                        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Faculty Attendance Submission Tracker Section */}
            {activeTab === "tracker" && (
                <div className="mb-8 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Faculty Attendance Submission Tracker</h2>
                            <p className="text-xs text-slate-500">Monitor which faculty members have submitted attendance vs. pending submissions.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Date</label>
                                <input
                                    type="date"
                                    value={trackerDate}
                                    onChange={(e) => setTrackerDate(e.target.value)}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={fetchTrackerData}
                                className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                            >
                                Refresh Status
                            </button>
                            {trackerData?.pendingList?.length > 0 && (
                                <button
                                    onClick={handleDownloadPendingTracker}
                                    className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                                >
                                    <FaFileExcel /> Export Pending List
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Summary Metrics */}
                    {trackerData?.summary && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-xs font-semibold text-slate-500 uppercase">Total Assigned Classes</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">{trackerData.summary.totalAssigned}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                                <p className="text-xs font-semibold text-emerald-700 uppercase">Posted</p>
                                <p className="mt-1 text-2xl font-bold text-emerald-700">{trackerData.summary.postedCount}</p>
                            </div>
                            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
                                <p className="text-xs font-semibold text-rose-700 uppercase">Pending (Not Posted)</p>
                                <p className="mt-1 text-2xl font-bold text-rose-700">{trackerData.summary.pendingCount}</p>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
                                <p className="text-xs font-semibold text-blue-700 uppercase">Submission Rate</p>
                                <p className="mt-1 text-2xl font-bold text-blue-700">{trackerData.summary.completionRate}</p>
                            </div>
                        </div>
                    )}

                    {trackerLoading ? (
                        <div className="flex justify-center p-12">
                            <LogoSpinner />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Pending Table */}
                            <div className="rounded-xl border border-rose-200 bg-white shadow-sm overflow-hidden">
                                <div className="bg-rose-50 border-b border-rose-100 px-5 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-rose-500"></span>
                                        <h3 className="font-bold text-rose-900">Pending Submissions ({trackerData?.pendingList?.length || 0})</h3>
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-[500px]">
                                    <table className="w-full text-left text-xs text-slate-700">
                                        <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3">Faculty Name</th>
                                                <th className="px-4 py-3">Dept</th>
                                                <th className="px-4 py-3">Subject</th>
                                                <th className="px-4 py-3">Class / Sec</th>
                                                <th className="px-4 py-3">Mobile</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {trackerData?.pendingList?.map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-rose-50/30">
                                                    <td className="px-4 py-3 font-medium text-slate-900">{item.facultyName}</td>
                                                    <td className="px-4 py-3">{item.deptCode}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{item.subjectName}</td>
                                                    <td className="px-4 py-3">{item.yrSem} ({item.sectionName})</td>
                                                    <td className="px-4 py-3 text-slate-600">{item.mobile}</td>
                                                </tr>
                                            ))}
                                            {(!trackerData?.pendingList || trackerData.pendingList.length === 0) && (
                                                <tr>
                                                    <td colSpan={5} className="p-6 text-center text-slate-400">All faculty members have submitted attendance for this date! 🎉</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Posted Table */}
                            <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
                                <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                                        <h3 className="font-bold text-emerald-900">Posted Submissions ({trackerData?.postedList?.length || 0})</h3>
                                    </div>
                                </div>
                                <div className="overflow-x-auto max-h-[500px]">
                                    <table className="w-full text-left text-xs text-slate-700">
                                        <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3">Faculty Name</th>
                                                <th className="px-4 py-3">Dept</th>
                                                <th className="px-4 py-3">Subject</th>
                                                <th className="px-4 py-3">Class / Sec</th>
                                                <th className="px-4 py-3">Periods</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {trackerData?.postedList?.map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-emerald-50/30">
                                                    <td className="px-4 py-3 font-medium text-slate-900">{item.facultyName}</td>
                                                    <td className="px-4 py-3">{item.deptCode}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{item.subjectName}</td>
                                                    <td className="px-4 py-3">{item.yrSem} ({item.sectionName})</td>
                                                    <td className="px-4 py-3 font-medium text-emerald-700">{item.periods}</td>
                                                </tr>
                                            ))}
                                            {(!trackerData?.postedList || trackerData.postedList.length === 0) && (
                                                <tr>
                                                    <td colSpan={5} className="p-6 text-center text-slate-400">No attendance submissions recorded yet for this date.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Daily Register Matrix Table View */}
            {
                (activeTab === "subject" || activeTab === "elective" || activeTab === "consolidated") && subjectViewMode === "register" && registerData && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mb-8">
                        <div className="flex flex-wrap justify-between items-center border-b border-slate-100 bg-slate-50 px-6 py-3 gap-2">
                            <div>
                                <h3 className="font-semibold text-slate-700">{activeTab === "consolidated" ? "Consolidated Class Daily Attendance Register Matrix" : "Subject Daily Attendance Register Matrix"}</h3>
                                <p className="text-xs text-slate-500">{registerData.sessions.length} class sessions recorded</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleDownloadConsolidated} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 hover:border-green-300">
                                    <FaFileExcel className="text-green-600" /> Excel Register
                                </button>
                                <button onClick={() => handleDownloadPDF("view")} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 hover:border-red-300" title="View PDF in new tab">
                                    <FaEye className="text-red-600" /> View PDF
                                </button>
                                <button onClick={() => handleDownloadPDF("download")} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 hover:border-red-300" title="Download PDF file">
                                    <FaDownload className="text-red-600" /> Download PDF
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="sticky left-0 bg-slate-100 z-20 px-4 py-3 text-xs font-bold uppercase text-slate-600 border-b border-r border-slate-200 shadow-xs">Roll No</th>
                                        <th className="sticky left-28 bg-slate-100 z-20 px-4 py-3 text-xs font-bold uppercase text-slate-600 border-b border-r border-slate-200 shadow-xs">Name</th>
                                        {registerData.sessions.map((sess: any) => (
                                            <th key={sess.id} className="px-3 py-2 text-center text-xs font-bold text-slate-600 border-b border-r border-slate-200 min-w-[65px]">
                                                <div>{sess.dateStr}</div>
                                                <div className="text-[10px] text-blue-600 font-medium">{sess.periodName}</div>
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 border-b border-r border-slate-200">Total</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-green-700 border-b border-r border-slate-200">P</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-red-700 border-b border-r border-slate-200">A</th>
                                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 border-b border-slate-200">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {registerData.students.map((s: any) => {
                                        const renderBadge = (pctStr: string) => {
                                            const pct = parseFloat(pctStr);
                                            if (isNaN(pct)) return <span className="text-slate-600 font-medium">{pctStr}%</span>;
                                            if (pct >= 75) {
                                                return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-300">{pct.toFixed(2)}%</span>;
                                            } else if (pct >= 65) {
                                                return <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800 border border-amber-300">{pct.toFixed(2)}%</span>;
                                            } else {
                                                return <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-extrabold text-rose-800 border border-rose-300">{pct.toFixed(2)}%</span>;
                                            }
                                        };

                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50">
                                                <td className="sticky left-0 bg-white z-10 px-4 py-2.5 text-xs font-mono text-slate-700 border-r border-slate-100 font-semibold">{s.rollNumber}</td>
                                                <td className="sticky left-28 bg-white z-10 px-4 py-2.5 text-xs font-medium text-slate-900 border-r border-slate-100 max-w-[180px] truncate">{s.name}</td>
                                                {registerData.sessions.map((sess: any) => {
                                                    const st = s.attendanceMap[sess.id] || "-";
                                                    return (
                                                        <td key={sess.id} className="px-2 py-2 text-center text-xs border-r border-slate-100">
                                                            {st === "P" && <span className="inline-block w-6 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[11px]">P</span>}
                                                            {st === "A" && <span className="inline-block w-6 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[11px]">A</span>}
                                                            {st === "-" && <span className="text-slate-400 font-medium">-</span>}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-2.5 text-center text-xs text-slate-600 font-semibold border-r border-slate-100">{s.totalClasses}</td>
                                                <td className="px-4 py-2.5 text-center text-xs text-emerald-600 font-bold border-r border-slate-100">{s.present}</td>
                                                <td className="px-4 py-2.5 text-center text-xs text-rose-600 font-bold border-r border-slate-100">{s.absent}</td>
                                                <td className="px-4 py-2.5 text-center text-xs font-bold">
                                                    {renderBadge(s.percentage)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Shared Table for Consolidated & Subject Tabs (Summary Mode) */}
            {
                (activeTab === "consolidated" || (activeTab === "subject" && subjectViewMode === "summary") || activeTab === "elective") && (
                    <>
                        {consolidatedData.length > 0 && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex justify-between items-center border-b border-slate-100 bg-slate-50 px-6 py-3">
                                    <h3 className="font-semibold text-slate-700">Report Summary</h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleDownloadConsolidated} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 hover:border-green-300">
                                            <FaFileExcel className="text-green-600" /> Excel
                                        </button>
                                        <button onClick={() => handleDownloadPDF("view")} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 hover:border-red-300" title="View PDF in new tab">
                                            <FaEye className="text-red-600" /> View PDF
                                        </button>
                                        <button onClick={() => handleDownloadPDF("download")} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 hover:border-red-300" title="Download PDF file">
                                            <FaDownload className="text-red-600" /> Download PDF
                                        </button>
                                        {sortConfig.key && (
                                            <button
                                                onClick={() => setSortConfig({ key: null, direction: "asc" })}
                                                className="ml-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                                                title="Reset Sort"
                                            >
                                                <FaTimes /> Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th onClick={() => handleSort("rollNumber")} className="px-6 py-3 text-xs font-bold uppercase text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                                    <div className="flex items-center gap-1">
                                                        Roll No
                                                        {sortConfig.key === "rollNumber" && (
                                                            sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />
                                                        )}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500">Name</th>
                                                {reportMode === "scholarship" && (
                                                    <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">Govt Scholarship ID</th>
                                                )}
                                                {reportMode === "subject_summary" ? (
                                                    <>
                                                        {subjectSummarySubjects.map((sub: any) => (
                                                            <th key={sub.id} className="px-4 py-3 text-xs font-bold uppercase text-slate-700 text-center bg-slate-100/80 border-r border-slate-200">
                                                                <div>{sub.shortName || sub.name}</div>
                                                                <div className="text-[11px] font-bold text-blue-600 lowercase tracking-normal">Total Held: {sub.totalHeld}</div>
                                                            </th>
                                                        ))}
                                                        <th onClick={() => handleSort("totalClasses")} className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                                            <div className="flex items-center justify-center gap-1">
                                                                Total Held
                                                                {sortConfig.key === "totalClasses" && (
                                                                    sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Present</th>
                                                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">Absent</th>
                                                        <th onClick={() => handleSort("percentage")} className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                                            <div className="flex items-center justify-center gap-1">
                                                                %
                                                                {sortConfig.key === "percentage" && (
                                                                    sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />
                                                                )}
                                                            </div>
                                                        </th>
                                                    </>
                                                ) : reportMode === "monthly" ? (
                                                    (sortedConsolidatedData[0]?.monthlyStats || []).map((m: any) => (
                                                        <th key={m.monthKey} className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                                                            {m.monthLabel}
                                                        </th>
                                                    ))
                                                ) : (
                                                    <>
                                                        <th onClick={() => handleSort("totalClasses")} className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {reportMode === "scholarship" ? "Working Days" : "Total Classes"}
                                                                {sortConfig.key === "totalClasses" && (
                                                                    sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />
                                                                )}
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">Present</th>
                                                        <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">Absent</th>
                                                        <th onClick={() => handleSort("percentage")} className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none">
                                                            <div className="flex items-center justify-center gap-1">
                                                                %
                                                                {sortConfig.key === "percentage" && (
                                                                    sortConfig.direction === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />
                                                                )}
                                                            </div>
                                                        </th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedConsolidatedData.map((s) => {
                                                const renderHeatmapBadge = (pctStr: string) => {
                                                    const pct = parseFloat(pctStr);
                                                    if (isNaN(pct)) return <span className="text-slate-600 font-medium">{pctStr}%</span>;

                                                    if (pct >= 75) {
                                                        return (
                                                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 border border-emerald-300">
                                                                {pct.toFixed(2)}%
                                                            </span>
                                                        );
                                                    } else if (pct >= 65) {
                                                        return (
                                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-800 border border-amber-300">
                                                                {pct.toFixed(2)}%
                                                            </span>
                                                        );
                                                    } else {
                                                        return (
                                                            <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-extrabold text-rose-800 border border-rose-300">
                                                                {pct.toFixed(2)}%
                                                            </span>
                                                        );
                                                    }
                                                };

                                                return (
                                                    <tr key={s.rollNumber} className="hover:bg-slate-50">
                                                        <td className="px-6 py-3 text-sm font-mono text-slate-600">
                                                            <StudentHoverCard name={s.name} rollNumber={s.rollNumber} studentId={s.id}>
                                                                {s.rollNumber}
                                                            </StudentHoverCard>
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-medium text-slate-900">
                                                            <StudentHoverCard name={s.name} rollNumber={s.rollNumber} studentId={s.id}>
                                                                {s.name}
                                                            </StudentHoverCard>
                                                        </td>
                                                        {reportMode === "scholarship" && (
                                                            <td className="px-6 py-3 text-sm text-center font-mono text-slate-500">
                                                                {s.scholarshipId || "N/A"}
                                                            </td>
                                                        )}
                                                        {reportMode === "subject_summary" ? (
                                                            <>
                                                                {subjectSummarySubjects.map((sub: any) => (
                                                                    <td key={sub.id} className="px-4 py-3 text-sm text-center font-bold text-slate-800 border-r border-slate-100">
                                                                        {s.subjectStats?.[sub.id]?.present ?? 0}
                                                                    </td>
                                                                ))}
                                                                <td className="px-4 py-3 text-sm text-center font-semibold text-slate-600">{s.totalClasses}</td>
                                                                <td className="px-4 py-3 text-sm text-center font-bold text-emerald-600">{s.totalPresent || s.present}</td>
                                                                <td className="px-4 py-3 text-sm text-center font-bold text-rose-600">{s.totalAbsent || s.absent}</td>
                                                                <td className="px-4 py-3 text-sm text-center font-bold">
                                                                    {renderHeatmapBadge(s.percentage)}
                                                                </td>
                                                            </>
                                                        ) : reportMode === "monthly" ? (
                                                            (s.monthlyStats || []).map((m: any) => (
                                                                <td key={m.monthKey} className="px-4 py-3 text-sm text-center font-bold">
                                                                    {renderHeatmapBadge(m.percentage)}
                                                                </td>
                                                            ))
                                                        ) : (
                                                            <>
                                                                <td className="px-6 py-3 text-sm text-center text-slate-600">{s.totalClasses || s.totalDays}</td>
                                                                <td className="px-6 py-3 text-sm text-center text-green-600 font-semibold">{s.present || s.presentDays}</td>
                                                                <td className="px-6 py-3 text-sm text-center text-red-600 font-semibold">{s.absent || s.absentDays}</td>
                                                                <td className="px-6 py-3 text-sm text-center font-bold">
                                                                    {renderHeatmapBadge(s.percentage)}
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {consolidatedData.length === 0 && !loading && (
                            <div className="text-center py-12 text-slate-400">
                                Select filters and date range to generate report.
                            </div>
                        )}
                    </>
                )
            }

            {/* Defaulter List (Report #1) */}
            {activeTab === "defaulter" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Low Attendance & Parent Warning Notice Generator</h2>
                    
                    <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5">
                        {isGlobal && (
                            <div>
                                <label className="text-xs font-semibold text-slate-700">Department</label>
                                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Select Dept</option>
                                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Year / Sem / Sec</label>
                            <div className="flex gap-1">
                                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-1/3 rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Yr</option>
                                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                                </select>
                                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-1/3 rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Sem</option>
                                    <option value="1">1</option><option value="2">2</option>
                                </select>
                                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-1/3 rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Sec</option>
                                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Threshold %</label>
                            <select value={defaulterThreshold} onChange={(e) => setDefaulterThreshold(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                                <option value="75">&lt; 75% (Condonation & Detention)</option>
                                <option value="65">&lt; 65% (Detention Risk Only)</option>
                                <option value="80">&lt; 80% (Early Warning)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Date Range</label>
                            <div className="flex gap-1">
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-1/2 rounded-lg border border-slate-300 p-2 text-xs" />
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-1/2 rounded-lg border border-slate-300 p-2 text-xs" />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button onClick={fetchDefaulterReport} disabled={defaulterLoading} className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 flex items-center justify-center gap-2">
                                {defaulterLoading ? <LogoSpinner fullScreen={false} /> : <><FaFilter /> Generate Defaulters</>}
                            </button>
                        </div>
                    </div>

                    {defaulterData && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Total Classes Held</span>
                                    <p className="text-2xl font-extrabold text-slate-800">{defaulterData.totalHeld}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Class Strength</span>
                                    <p className="text-2xl font-extrabold text-slate-800">{defaulterData.totalStudents}</p>
                                </div>
                                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-center">
                                    <span className="text-xs font-bold text-rose-600 uppercase">Defaulter Count</span>
                                    <p className="text-2xl font-extrabold text-rose-700">{defaulterData.defaulterCount}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600">Roll No</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600">Name</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600">Contact / Parent</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Held</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Attended</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Shortage %</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Attendance %</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Status</th>
                                            <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {defaulterData.students.map((s: any) => (
                                            <tr key={s.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-mono font-bold text-slate-800">{s.rollNumber}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                                                <td className="px-4 py-3 text-xs text-slate-600">{s.mobile}<br/><span className="text-slate-400">({s.parentName})</span></td>
                                                <td className="px-4 py-3 text-center">{s.totalClasses}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-emerald-600">{s.present}</td>
                                                <td className="px-4 py-3 text-center font-semibold text-rose-600">{s.shortagePercentage}%</td>
                                                <td className="px-4 py-3 text-center font-extrabold text-rose-700">{s.percentage}%</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${s.percentage < 65 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                                                        {s.statusLabel}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleDownloadDefaulterNoticePDF(s)} className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 border border-rose-200">
                                                        <FaFilePdf /> Parent Notice PDF
                                                    </button>
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

            {/* Comparative Report (Report #3) */}
            {activeTab === "comparative" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Class & Department Comparative Attendance Summary</h2>
                    <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
                        {isGlobal && (
                            <div>
                                <label className="text-xs font-semibold text-slate-700">Department</label>
                                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Select Dept</option>
                                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Year / Semester</label>
                            <div className="flex gap-2">
                                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-1/2 rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Year</option>
                                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                                </select>
                                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-1/2 rounded-lg border border-slate-300 p-2 text-sm">
                                    <option value="">Sem</option>
                                    <option value="1">1</option><option value="2">2</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-700">Date Range</label>
                            <div className="flex gap-1">
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-1/2 rounded-lg border border-slate-300 p-2 text-xs" />
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-1/2 rounded-lg border border-slate-300 p-2 text-xs" />
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button onClick={fetchComparativeReport} disabled={comparativeLoading} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 flex items-center justify-center gap-2">
                                {comparativeLoading ? <LogoSpinner fullScreen={false} /> : <><FaFilter /> Compare Sections</>}
                            </button>
                        </div>
                    </div>

                    {comparativeData && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {comparativeData.sections.map((sec: any) => (
                                <div key={sec.sectionId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                                    <div className="flex justify-between items-center border-b pb-2">
                                        <h3 className="text-lg font-bold text-slate-800">Section {sec.sectionName}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${sec.averagePercentage >= 75 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                            Avg: {sec.averagePercentage}%
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="bg-slate-50 p-2 rounded"><span className="text-xs text-slate-500 block font-bold">Strength</span><span className="font-bold text-slate-800">{sec.totalStudents}</span></div>
                                        <div className="bg-slate-50 p-2 rounded"><span className="text-xs text-slate-500 block font-bold">Classes Held</span><span className="font-bold text-slate-800">{sec.totalClassesHeld}</span></div>
                                        <div className="bg-emerald-50 p-2 rounded"><span className="text-xs text-emerald-700 block font-bold">≥ 75% Attendance</span><span className="font-bold text-emerald-800">{sec.highAttendanceCount}</span></div>
                                        <div className="bg-rose-50 p-2 rounded"><span className="text-xs text-rose-700 block font-bold">&lt; 65% Detention</span><span className="font-bold text-rose-800">{sec.detentionCount}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Student Transcript (Report #5) */}
            {activeTab === "transcript" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Student Cumulative Attendance Transcript</h2>
                    <div className="mb-6 flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm items-end">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-700">Enter Student Roll Number</label>
                            <input type="text" placeholder="e.g. 2024101001" value={transcriptRollNo} onChange={(e) => setTranscriptRollNo(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono" />
                        </div>
                        <button onClick={fetchTranscriptReport} disabled={transcriptLoading} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 flex items-center gap-2">
                            {transcriptLoading ? <LogoSpinner fullScreen={false} /> : <><FaEye /> View Transcript</>}
                        </button>
                    </div>

                    {transcriptData && (
                        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                            <div className="flex justify-between items-start border-b pb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{transcriptData.student.name}</h3>
                                    <p className="text-sm font-mono text-slate-500">Roll Number: {transcriptData.student.rollNumber}</p>
                                    <p className="text-xs text-slate-500">{transcriptData.student.departmentName} | Year {transcriptData.student.year} | Sem {transcriptData.student.semester} | Sec {transcriptData.student.sectionName}</p>
                                </div>
                                <button onClick={handleDownloadTranscriptPDF} className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
                                    <FaFilePdf /> Download Official Transcript PDF
                                </button>
                            </div>

                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-600">Subject Name</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-600">Faculty</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Classes Held</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Attended</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Absent</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-600 text-center">Subject %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transcriptData.subjectBreakdown.map((sub: any) => (
                                        <tr key={sub.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-semibold text-slate-800">{sub.name}</td>
                                            <td className="px-4 py-3 text-xs text-slate-600">{sub.facultyName}</td>
                                            <td className="px-4 py-3 text-center">{sub.totalHeld}</td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-600">{sub.present}</td>
                                            <td className="px-4 py-3 text-center font-bold text-rose-600">{sub.absent}</td>
                                            <td className="px-4 py-3 text-center font-extrabold">{sub.percentage}%</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-100 font-bold">
                                        <td colSpan={2} className="px-4 py-3 text-slate-900">OVERALL ATTENDANCE SUMMARY</td>
                                        <td className="px-4 py-3 text-center">{transcriptData.overall.totalHeld}</td>
                                        <td className="px-4 py-3 text-center text-emerald-700">{transcriptData.overall.totalPresent}</td>
                                        <td className="px-4 py-3 text-center text-rose-700">{transcriptData.overall.totalAbsent}</td>
                                        <td className="px-4 py-3 text-center text-base text-blue-700">{transcriptData.overall.percentage}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Edit Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Attendance">
                <div className="p-4">
                    <h3 className="mb-4 text-sm font-bold text-slate-700">Update Student Status</h3>
                    <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-500">Roll No</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-500">Name</th>
                                    <th className="px-4 py-2 text-xs font-bold text-slate-500">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {editDetails.map((student, idx) => (
                                    <tr key={idx} className={student["Status"] === "Absent" ? "bg-red-50" : ""}>
                                        <td className="px-4 py-2 text-sm font-mono">{student["Roll Number"]}</td>
                                        <td className="px-4 py-2 text-sm">{student["Name"]}</td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() => toggleAttendance(idx)}
                                                className={`px-3 py-1 rounded text-xs font-bold ${student["Status"] === "Absent"
                                                    ? "bg-red-200 text-red-800"
                                                    : "bg-green-200 text-green-800"
                                                    }`}
                                            >
                                                {student["Status"]}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
                        <button onClick={saveEdits} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                            <FaSave /> Save Changes
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => recordToDelete && handleDelete(recordToDelete.id)}
                title="Delete Report"
                message="Are you sure you want to delete this report? This action cannot be undone."
                confirmText="Delete"
                isDangerous={true}
            />

            {/* View Modal */}
            {
                viewRecord && (
                    <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Attendance Report">
                        <div className="p-4">
                            <div className="space-y-4">
                                <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Date</span>
                                            <span className="font-medium text-slate-900">
                                                {new Date(viewRecord.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Class</span>
                                            <span className="font-medium text-slate-900">
                                                {viewRecord.department?.name || "Unknown Dept"}
                                            </span>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                Yr {viewRecord.year} - Sem {viewRecord.semester} - Sec {viewRecord.section?.name}
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Subject</span>
                                            <span className="font-medium text-slate-900">{viewRecord.subject?.name || "N/A"}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Faculty / Posted By</span>
                                            <span className="font-medium text-slate-900">{viewRecord.user?.faculty?.empName || viewRecord.user?.username || viewRecord.postedBy || "N/A"}</span>
                                        </div>
                                        <div className="col-span-2 my-2 border-t border-slate-200"></div>
                                        <div>
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Total Students</span>
                                            <span className="font-medium text-slate-900">{viewStats.total}</span>
                                        </div>
                                        <div></div>
                                        <div>
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Present</span>
                                            <span className="font-bold text-green-600">{viewStats.present}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Absent</span>
                                            <span className="font-bold text-red-600">{viewStats.absent}</span>
                                        </div>
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
                                        <FaDownload /> Download Absentees
                                    </button>
                                </div>

                                <button onClick={() => setIsViewModalOpen(false)} className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600 underline">
                                    Close
                                </button>
                            </div>
                        </div>
                    </Modal>
                )
            }
        </div >
    );
}
