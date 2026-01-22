"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaCalendarAlt, FaFileExcel, FaFilter, FaTrash, FaEdit, FaUserCircle, FaSave, FaTimes, FaEye, FaDownload, FaFilePdf } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import { motion } from "framer-motion";
import LogoSpinner from "@/components/LogoSpinner";

export default function ReportsPage() {
    const { data: session } = useSession();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab State
    const [activeTab, setActiveTab] = useState<"daily" | "consolidated" | "subject" | "weekly">("daily");

    // Filters
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [subjectId, setSubjectId] = useState("");

    // Consolidated Dates
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [consolidatedData, setConsolidatedData] = useState<any[]>([]);

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

    useEffect(() => {
        const role = (session?.user.role || "").toUpperCase();
        if (["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) fetchDepartments();
        // Initial fetch based on tab
        if (activeTab === "daily") {
            fetchHistory();
        }
        fetchPeriods();
    }, [session]);

    useEffect(() => {
        const role = (session?.user.role || "").toUpperCase();
        const isGlobal = ["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
        const effectiveDeptId = isGlobal ? departmentId : (session?.user as any)?.departmentId;
        if (effectiveDeptId) fetchSections(effectiveDeptId);
        if (effectiveDeptId && year && semester) fetchSubjects(effectiveDeptId);
    }, [departmentId, session, year, semester]);

    // Refetch when filters change (Daily Only)
    useEffect(() => {
        if (activeTab === "daily") {
            fetchHistory();
        }
    }, [year, semester, sectionId, departmentId, activeTab]);

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchSections = async (deptId: string) => {
        const res = await fetch(`/api/sections?departmentId=${deptId}`);
        if (res.ok) setSections(await res.json());
    };

    const fetchSubjects = async (deptId: string) => {
        const params = new URLSearchParams({ departmentId: deptId, year, semester });
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

    const fetchConsolidated = async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (sectionId) params.append("sectionId", sectionId);
            if (departmentId) params.append("departmentId", departmentId);
            if (activeTab === "subject" && subjectId) params.append("subjectId", subjectId);
            params.append("startDate", startDate);
            params.append("endDate", endDate);

            const res = await fetch(`/api/reports/consolidated?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setConsolidatedData(data);
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

    const handleDownloadConsolidated = () => {
        if (consolidatedData.length === 0) return;

        const ws = XLSX.utils.json_to_sheet(consolidatedData.map(s => ({
            "Roll Number": s.rollNumber,
            "Name": s.name,
            "Total Classes": s.totalClasses,
            "Present": s.present,
            "Absent": s.absent,
            "Percentage": s.percentage + "%"
        })));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Consolidated Report");
        XLSX.writeFile(wb, `Consolidated_Report_${startDate}_to_${endDate}.xlsx`);
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

    const handleDownloadPDF = () => {
        console.log("PDF: Button clicked");
        try {
            if (consolidatedData.length === 0) {
                console.warn("PDF: No data");
                setStatus({ type: "error", message: "No data to print." });
                return;
            }

            setStatus({ type: "success", message: "Generating PDF..." }); // Show status

            const doc = new jsPDF();
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

                    // Left Side Details
                    doc.text(`Department: ${deptName}`, 15, 42);
                    doc.text(`Year: ${year}   Semester: ${semester}`, 15, 48);
                    doc.text(`Section: ${secName} ${subName ? `   Subject: ${subName}` : ""}`, 15, 54);

                    // Right Side Details
                    doc.text(`Report Type: Consolidated`, pageWidth - 15, 42, { align: "right" });
                    doc.text(`From: ${new Date(startDate).toLocaleDateString()}`, pageWidth - 15, 48, { align: "right" });
                    doc.text(`To: ${new Date(endDate).toLocaleDateString()}`, pageWidth - 15, 54, { align: "right" });

                    // Title
                    doc.setFont("times", "bold");
                    doc.setFontSize(14);
                    doc.text("Attendance Report", pageWidth / 2, 65, { align: "center" });

                    // --- Table ---
                    const tableColumn = ["Roll No", "Name", "Total", "Present", "Absent", "%"];
                    const tableRows: any[] = [];

                    consolidatedData.forEach(student => {
                        const rowData = [
                            student.rollNumber,
                            student.name,
                            student.totalClasses,
                            student.present,
                            student.absent,
                            student.percentage + "%"
                        ];
                        tableRows.push(rowData);
                    });

                    console.log("PDF: Drawing table...", tableRows.length);
                    // Try different autoTable invocations
                    if ((doc as any).autoTable) {
                        (doc as any).autoTable({
                            head: [tableColumn],
                            body: tableRows,
                            startY: 70,
                            theme: "plain",
                            styles: { font: "times", fontSize: 10, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
                            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.1, lineColor: [0, 0, 0] },
                            columnStyles: {
                                0: { cellWidth: 30 },
                                1: { cellWidth: 60 },
                                2: { cellWidth: 20, halign: 'center' },
                                3: { cellWidth: 20, halign: 'center' },
                                4: { cellWidth: 20, halign: 'center' },
                                5: { cellWidth: 20, halign: 'center' },
                            }
                        });
                    } else if (typeof autoTable === 'function') {
                        console.log("PDF: Using autoTable function directly");
                        autoTable(doc, {
                            head: [tableColumn],
                            body: tableRows,
                            startY: 70,
                            theme: "plain",
                            styles: { font: "times", fontSize: 10, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
                            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", lineWidth: 0.1, lineColor: [0, 0, 0] },
                            columnStyles: {
                                0: { cellWidth: 30 },
                                1: { cellWidth: 60 },
                                2: { cellWidth: 20, halign: 'center' },
                                3: { cellWidth: 20, halign: 'center' },
                                4: { cellWidth: 20, halign: 'center' },
                                5: { cellWidth: 20, halign: 'center' },
                            }
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
                        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 15, doc.internal.pageSize.height - 10);
                    }

                    console.log("PDF: Saving file...");
                    doc.save(`Consolidated_Report_${startDate}_${endDate}.pdf`);
                    setStatus({ type: "success", message: "PDF Downloaded!" });

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
            XLSX.writeFile(wb, viewRecord.fileName || "Full_Report.xlsx");
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
            const baseName = viewRecord.fileName || "Report.xlsx";
            const filename = baseName.replace("FullReport", "Absentees").replace("Attendance Report", "Absentees");
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
            </div>

            {/* Daily Attendance Reports Section */}
            {activeTab === "daily" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Daily Attendance Reports</h2>

                    {/* Filters */}
                    <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
                        {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
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
                                                        {new Date(record.date).toLocaleDateString("en-IN", {
                                                            day: 'numeric', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-900">Year {record.year} - Sem {record.semester}</div>
                                                        <div className="text-xs text-slate-500">Sec {record.section?.name}</div>
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
                                                        <button onClick={() => openEditModal(record)} className="mr-3 text-blue-600 hover:text-blue-800" title="Edit">
                                                            <FaEdit />
                                                        </button>
                                                        <button onClick={() => { setRecordToDelete(record); setIsDeleteModalOpen(true); }} className="text-red-600 hover:text-red-800" title="Delete">
                                                            <FaTrash />
                                                        </button>
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
                    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end">
                        <div className="grid grid-cols-2 gap-4 flex-grow md:grid-cols-4">
                            {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
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

                        <button
                            onClick={fetchConsolidated}
                            disabled={!year || !semester || !sectionId || !startDate || !endDate}
                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Generate
                        </button>
                    </div>
                </div>
            )}

            {/* Subject Reports Section */}
            {activeTab === "subject" && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Subject-wise Reports</h2>
                    <p className="mb-4 text-sm text-slate-500">View attendance for specific subjects or generate an overall summary matrix.</p>

                    {/* Filters & Actions */}
                    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
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

                        <div className="mt-4 grid grid-cols-2 gap-4 md:mt-0 md:w-full md:grid-cols-4">
                            <div className="space-y-1 col-span-2 md:col-span-1">
                                <label className="text-xs font-semibold text-slate-500">Subject</label>
                                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                    <option value="">All Subjects</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">Start Date</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500">End Date</label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full" />
                            </div>
                            <div className="flex flex-col justify-end gap-2">
                                <button
                                    onClick={fetchConsolidated}
                                    disabled={!year || !semester || !sectionId || !startDate || !endDate}
                                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Generate
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 flex w-full justify-end border-t border-slate-100 pt-4">
                            <button
                                onClick={handleDownloadOverall}
                                disabled={!year || !semester || !sectionId || !startDate || !endDate}
                                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                                <FaFileExcel /> Download Overall Subject Summary (Excel)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Weekly Timetable View */}
            {
                activeTab === "weekly" && (
                    <div className="mb-8">
                        <h2 className="mb-4 text-lg font-semibold text-slate-800 border-b pb-2">Weekly Class Report</h2>
                        <p className="mb-4 text-sm text-slate-500">Visual attendance grid for the selected week.</p>

                        {/* Filters */}
                        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                                {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user.role || "").toUpperCase()) && (
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
                                <button
                                    onClick={fetchWeeklyData}
                                    disabled={!departmentId || !year || !semester || !sectionId || !weekDate}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Load Timetable
                                </button>
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
                                                            <span>{dayName}</span>
                                                            <span className="text-xs font-normal text-slate-400">{day.toLocaleDateString()}</span>
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
                                                                <div className="group relative flex h-full w-full flex-col items-center justify-center py-2 cursor-pointer">
                                                                    <span className="font-bold text-slate-800 text-sm">{record.subject?.name || "Subject"}</span>


                                                                    {/* Tooltip */}
                                                                    <div className="absolute bottom-full mb-2 hidden w-48 flex-col rounded-lg bg-slate-800 p-2 text-xs text-white shadow-xl group-hover:flex z-50">
                                                                        <div className="font-bold mb-1 border-b border-slate-600 pb-1">{record.subject?.name}</div>
                                                                        {colSpan > 1 && <div className="mb-1 text-[10px] text-green-400 font-bold uppercase tracking-wider">{colSpan}-Hour Session</div>}
                                                                        <div className="flex justify-between"><span>Total:</span> <span>{total}</span></div>
                                                                        <div className="flex justify-between text-green-300"><span>Present:</span> <span>{present} ({Math.round(presentPct)}%)</span></div>
                                                                        <div className="flex justify-between text-red-300"><span>Absent:</span> <span>{absent}</span></div>
                                                                        <div className="mt-1 text-[10px] text-slate-400 text-center">Click to View Details</div>
                                                                        {/* Arrow */}
                                                                        <div className="absolute top-full left-1/2 -ml-1 h-2 w-2 -translate-y-1 rotate-45 bg-slate-800"></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <td
                                                                key={p.id}
                                                                colSpan={colSpan}
                                                                className="h-24 p-0 align-middle transition-all relative border-r border-b"
                                                                style={bgStyle}
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

            {/* Shared Table for Consolidated & Subject Tabs */}
            {
                (activeTab === "consolidated" || activeTab === "subject") && (
                    <>
                        {consolidatedData.length > 0 && (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex justify-between items-center border-b border-slate-100 bg-slate-50 px-6 py-3">
                                    <h3 className="font-semibold text-slate-700">Report Summary</h3>
                                    <div className="flex items-center">
                                        <button onClick={handleDownloadConsolidated} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100 hover:border-green-300">
                                            <FaFileExcel className="text-green-600" /> Excel
                                        </button>
                                        <button onClick={handleDownloadPDF} className="ml-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 hover:border-red-300">
                                            <FaFilePdf className="text-red-600" /> PDF
                                        </button>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500">Roll No</th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500">Name</th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">Total Classes</th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">Present</th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">Absent</th>
                                                <th className="px-6 py-3 text-xs font-bold uppercase text-slate-500 text-center">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {consolidatedData.map((s) => (
                                                <tr key={s.rollNumber} className="hover:bg-slate-50">
                                                    <td className="px-6 py-3 text-sm font-mono text-slate-600">{s.rollNumber}</td>
                                                    <td className="px-6 py-3 text-sm font-medium text-slate-900">{s.name}</td>
                                                    <td className="px-6 py-3 text-sm text-center text-slate-600">{s.totalClasses}</td>
                                                    <td className="px-6 py-3 text-sm text-center text-green-600 font-semibold">{s.present}</td>
                                                    <td className="px-6 py-3 text-sm text-center text-red-600 font-semibold">{s.absent}</td>
                                                    <td className="px-6 py-3 text-sm text-center font-bold">
                                                        <span className={parseFloat(s.percentage) < 75 ? "text-red-600" : "text-green-600"}>
                                                            {s.percentage}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
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
                                                Year {viewRecord.year} - Sem {viewRecord.semester} - Sec {viewRecord.section?.name}
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="block text-slate-500 text-xs uppercase font-bold">Subject</span>
                                            <span className="font-medium text-slate-900">{viewRecord.subject?.name || "N/A"}</span>
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
        </div>
    );
}
