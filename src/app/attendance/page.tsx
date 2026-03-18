"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaSave, FaSearch, FaUserCheck, FaUserTimes, FaFileDownload, FaFileUpload, FaTrash, FaFilter, FaDownload } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import Modal from "@/components/Modal";
import * as XLSX from "xlsx";
import { formatISTDate } from "@/lib/dateUtils";

// Types
interface Student {
    id: string;
    rollNumber: string;
    name: string;
    mobile: string;
    status: "Present" | "Absent";
    sectionId: string; // Added for multi-section support
    section?: { name: string }; // Added for display
}

interface Meta {
    id: string;
    name: string;
}

export default function AttendancePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // -- VIEW MODE --
    const [viewMode, setViewMode] = useState<"manual" | "bulk">("manual");

    // -- SELECTIONS --
    const [departments, setDepartments] = useState<Meta[]>([]);
    const [selectedDept, setSelectedDept] = useState("");

    const [sections, setSections] = useState<Meta[]>([]);
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]); // Multi-select sections

    const [subjects, setSubjects] = useState<Meta[]>([]);
    const [selectedSubject, setSelectedSubject] = useState("");

    const [periods, setPeriods] = useState<Meta[]>([]);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]); // Multi-select

    // Lab Batches
    const [labBatches, setLabBatches] = useState<Meta[]>([]);
    const [selectedLabBatch, setSelectedLabBatch] = useState("");

    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    // -- DATA --
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);
    const [message, setMessage] = useState("");

    // -- BULK SPECIFIC --
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().split("T")[0]);
    const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split("T")[0]);

    // -- SUMMARY MODAL STATE --
    const [showSummary, setShowSummary] = useState(false);
    const [summaryData, setSummaryData] = useState<any>(null);
    const [submissionStep, setSubmissionStep] = useState<"confirm" | "success">("confirm");

    // Initialize Selections
    useEffect(() => {
        if (status === "authenticated") {
            loadInitialData();
        }
    }, [status]);

    const loadInitialData = async () => {
        // Fetch Departments
        const deptRes = await fetch("/api/departments");
        const depts = await deptRes.json();
        setDepartments(depts);

        // Auto-select Dept for Non-Admins
        const role = (session?.user?.role || "").toUpperCase();
        if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
            const userDept = (session?.user as any).departmentId;
            if (userDept) {
                setSelectedDept(userDept);
                // Lock the department list ONLY for SMS_USER
                if (role === "SMS_USER") {
                    setDepartments(depts.filter((d: any) => d.id === userDept));
                }
            }
        }

        // Fetch Periods
        const periodRes = await fetch("/api/periods");
        const per = await periodRes.json();
        setPeriods(per);
    };

    // Load Sections & Batches
    useEffect(() => {
        if (selectedDept) {
            fetch(`/api/sections?departmentId=${selectedDept}`)
                .then(res => res.json())
                .then(data => setSections(data))
                .catch(err => console.error(err));
        } else {
            setSections([]);
        }
    }, [selectedDept]);

    useEffect(() => {
        // Fetch batches for the first selected section
        const firstSec = selectedSectionIds[0];

        if (firstSec && selectedDept && year && semester) {
            const query = new URLSearchParams({
                departmentId: selectedDept,
                year,
                semester
            });

            fetch(`/api/sections/${firstSec}/batches?${query.toString()}`)
                .then(res => res.json())
                .then(data => setLabBatches(data.batches || []))
                .catch(console.error);
        } else {
            setLabBatches([]);
        }
        setSelectedLabBatch("");
    }, [selectedSectionIds, selectedDept, year, semester]);

    // Load Subjects
    useEffect(() => {
        if (selectedDept && year && semester) {
            fetch(`/api/subjects?departmentId=${selectedDept}&year=${year}&semester=${semester}`)
                .then(res => res.json())
                .then(data => setSubjects(data))
                .catch(err => console.error(err));
        } else {
            setSubjects([]);
        }
    }, [selectedDept, year, semester]);

    // -- HANDLERS: MANUAL MODE --

    // Period Toggle - Restored
    const handlePeriodToggle = (periodId: string) => {
        if (selectedPeriods.includes(periodId)) {
            setSelectedPeriods(selectedPeriods.filter(id => id !== periodId));
        } else {
            setSelectedPeriods([...selectedPeriods, periodId]);
        }
    };

    const handleSectionToggle = (sectionId: string) => {
        if (selectedSectionIds.includes(sectionId)) {
            setSelectedSectionIds(selectedSectionIds.filter(id => id !== sectionId));
        } else {
            setSelectedSectionIds([...selectedSectionIds, sectionId]);
        }
    };

    const handleFetchStudents = async () => {
        const role = (session?.user?.role || "").toUpperCase();
        const isAcademic = ["ADMIN", "DIRECTOR", "PRINCIPAL", "FACULTY", "HOD"].includes(role);

        if (isAcademic) {
            if (!selectedDept || !year || !semester || selectedSectionIds.length === 0 || selectedPeriods.length === 0 || !date) {
                setMessage("Please fill all required fields (Year, Sem, at least one Section, Date, and at least one Period).");
                return;
            }
            if (!selectedSubject) {
                setMessage("Subject is required for Academic Attendance.");
                return;
            }

            // Conflict Check (Manual Mode Only)
            if (viewMode === "manual" && selectedPeriods.length > 0) {
                for (const sectionId of selectedSectionIds) {
                    try {
                        const res = await fetch("/api/attendance/check-availability", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                date,
                                departmentId: selectedDept,
                                year,
                                semester,
                                sectionId,
                                periodIds: selectedPeriods,
                                subjectId: selectedSubject || undefined,
                                labBatchId: selectedLabBatch || undefined
                            })
                        });

                        if (res.ok) {
                            const data = await res.json();
                            if (data.conflict) {
                                setMessage(data.message);
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (e) {
                        console.error("Conflict check failed", e);
                        // Continue if check fails? Or block? Safe to continue or show warning?
                        // Let's log and continue to avoid blocking workflow on network glitch
                    }
                }
            }

        } else {
            // USER Role (SMS) - Only basic fields required
            if (!selectedDept || !year || !semester || selectedSectionIds.length === 0 || !date) {
                setMessage("Please fill all required fields.");
                return;
            }
        }

        setLoading(true);
        setMessage("");

        try {
            const query = new URLSearchParams({
                departmentId: selectedDept,
                year,
                semester,
                sectionIds: selectedSectionIds.join(","), // Send all IDs
                limit: "-1", // Fetch all students, no pagination
                ...(selectedSubject ? { subjectId: selectedSubject } : {})
            });

            const res = await fetch(`/api/students?${query.toString()}`);
            const data = await res.json();
            const studentList = data.data || data; // Handle pagination wrapper or direct array

            if (Array.isArray(studentList)) {
                let filtered = studentList;
                // Filter by Lab Batch if selected (Only applies if single section ideally, 
                // or if we filter students who have that labBatchId regardless of section)
                if (selectedLabBatch) {
                    filtered = filtered.filter((s: any) => s.labBatchId === selectedLabBatch);
                }

                setStudents(filtered.map((s: any) => ({ ...s, status: "Present" })));
                if (filtered.length === 0) setMessage("No students found.");
            } else {
                setStudents([]);
                setMessage("Failed to load students.");
            }
        } catch (error) {
            console.error(error);
            setMessage("Error fetching data.");
        } finally {
            setLoading(false);
        }
    };

    const toggleStudentStatus = (studentId: string) => {
        setStudents(students.map(s =>
            s.id === studentId
                ? { ...s, status: s.status === "Present" ? "Absent" : "Present" }
                : s
        ));
    };

    const markAll = (status: "Present" | "Absent") => {
        setStudents(students.map(s => ({ ...s, status })));
    };

    const initiateSubmission = () => {
        if (students.length === 0) return;

        // Check if students from all selected sections are present
        const loadedSectionIds = new Set(students.map(s => s.sectionId));
        const missingSections = selectedSectionIds.filter(id => !loadedSectionIds.has(id));

        if (missingSections.length > 0) {
            const missingNames = sections.filter(s => missingSections.includes(s.id)).map(s => s.name).join(", ");
            alert(`You have selected sections: ${missingNames}, but haven't loaded their students yet.\n\nPlease click "Load Students" to refresh the list.`);
            return;
        }

        // Calculate Stats
        const total = students.length;
        const present = students.filter(s => s.status === "Present").length;
        const absent = total - present;

        // Get Names
        const secNames = sections
            .filter(s => selectedSectionIds.includes(s.id))
            .map(s => s.name)
            .join(", ");

        const subName = subjects.find(s => s.id === selectedSubject)?.name || "N/A";
        const pNames = periods.filter(p => selectedPeriods.includes(p.id)).map(p => p.name).join(", ");

        setSummaryData({
            date,
            year,
            semester,
            section: secNames, // Use joined names
            subject: subName,
            periods: pNames,
            total,
            present,
            absent,
            students
        });

        setSubmissionStep("confirm");
        setShowSummary(true);
    };

    const executeSubmission = async () => {
        if (!summaryData) return;
        if (isSubmittingRef.current || submitting) return;

        isSubmittingRef.current = true;
        setSubmitting(true);

        try {
            const payload = {
                date: summaryData.date,
                year: summaryData.year,
                semester: summaryData.semester,
                // Pass IDs array
                sectionIds: selectedSectionIds,
                // Pass single ID if just one (for legacy/completeness, optional)
                sectionId: selectedSectionIds[0],
                departmentId: selectedDept,
                subjectId: selectedSubject || null,
                periodIds: selectedPeriods,
                labBatchId: selectedLabBatch || null,
                students: students.map(s => ({
                    rollNumber: s.rollNumber,
                    name: s.name,
                    mobile: s.mobile,
                    status: s.status,
                    sectionId: s.sectionId // IMPORTANT: Pass this back
                }))
            };

            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSubmissionStep("success");
            } else {
                const err = await res.json();
                alert(err.error || "Submission Failed");
                setShowSummary(false);
            }

        } catch (error) {
            console.error(error);
            alert("Error submitting attendance");
            setShowSummary(false);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseSummary = () => {
        setShowSummary(false);
        setSummaryData(null);
        setStudents([]); // Clear data
        setSubmissionStep("confirm"); // Reset for next time
        router.push("/attendance/history");
    };

    const downloadSummaryReport = () => {
        if (!summaryData) return;
        const data = summaryData.students.map((s: any) => ({
            "Roll Number": s.rollNumber,
            "Name": s.name,
            "Mobile": s.mobile,
            "Status": s.status
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_${summaryData.date}_${summaryData.section}.xlsx`);
    };

    const downloadAbsentees = () => {
        if (!summaryData) return;
        const absentees = summaryData.students.filter((s: any) => s.status === "Absent").map((s: any) => ({
            "Roll Number": s.rollNumber,
            "Name": s.name,
            "Mobile": (s.mobile === "undefined" || !s.mobile) ? "" : s.mobile,
            "Status": "Absent"
        }));

        if (absentees.length === 0) {
            alert("No absentees to download.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(absentees);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Absentees");
        XLSX.writeFile(wb, `Absentees_${summaryData.date}_${summaryData.section}.xlsx`);
    };

    // -- HANDLERS: BULK MODE --

    const downloadTemplate = async () => {
        if (!selectedDept || !year || !semester || selectedSectionIds.length === 0) {
            alert("Please select Department, Year, Semester and at least one Section (First selected will be used) to generate template.");
            return;
        }

        const query = new URLSearchParams({
            departmentId: selectedDept,
            year,
            semester,
            sectionId: selectedSectionIds[0] || "", // Use first selected for template
            startDate: bulkStartDate,
            endDate: bulkEndDate,
            t: Date.now().toString()
        });

        window.open(`/api/attendance/bulk/template?${query.toString()}`, "_blank");
    };

    const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setBulkFile(e.target.files[0]);
    };

    const uploadBulk = async () => {
        if (!bulkFile || !selectedDept || !year || !semester || selectedSectionIds.length === 0) {
            alert("Please fill all selections and choose a file.");
            return;
        }

        setBulkUploading(true);
        const formData = new FormData();
        formData.append("file", bulkFile);
        formData.append("departmentId", selectedDept);
        formData.append("year", year);
        formData.append("semester", semester);
        formData.append("sectionId", selectedSectionIds[0] || "");

        try {
            const res = await fetch("/api/attendance/bulk/upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                alert(`Successfully uploaded ${data.success} records!`);
                setBulkFile(null);
            } else {
                alert(data.error || "Upload Failed");
                if (data.details) alert(data.details.join("\n"));
            }
        } catch (e) {
            console.error(e);
            alert("Upload Error");
        } finally {
            setBulkUploading(false);
        }
    };

    const deleteBulk = async () => {
        if (selectedSectionIds.length === 0 || !bulkStartDate || !bulkEndDate) {
            alert("Please select a Section and Date Range to delete.");
            return;
        }
        if (!confirm(`Are you sure you want to delete ALL attendance for the selected Period?`)) return;

        try {
            const res = await fetch("/api/attendance/bulk/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sectionId: selectedSectionIds[0],
                    startDate: bulkStartDate,
                    endDate: bulkEndDate
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
            } else {
                alert(data.error);
            }
        } catch (e) {
            console.error(e);
            alert("Delete Failed");
        }
    };


    if (status === "loading") return <LogoSpinner />;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="mb-6 text-2xl font-bold text-slate-800">Attendance Portal</h1>

            {/* Mode Tabs */}
            <div className="mb-6 flex gap-4 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setViewMode("manual")}
                    className={`pb-2 text-sm font-semibold transition-colors ${viewMode === "manual" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                    Manual Marking
                </button>
                <button
                    onClick={() => setViewMode("bulk")}
                    className={`pb-2 text-sm font-semibold transition-colors ${viewMode === "bulk" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                >
                    Bulk Operations
                </button>
            </div>

            <div className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                {/* SELECTORS (Common for both) */}
                <div className="grid gap-4 md:grid-cols-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Department</label>
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            disabled={!["ADMIN", "DIRECTOR", "PRINCIPAL", "FACULTY", "HOD"].includes((session?.user?.role || "").toUpperCase()) && !!(session?.user as any).departmentId}
                            className={`block w-full rounded-md border border-slate-300 p-2 text-sm ${(!["ADMIN", "DIRECTOR", "PRINCIPAL", "FACULTY", "HOD"].includes((session?.user?.role || "").toUpperCase()) && !!(session?.user as any).departmentId) ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Select Dept</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Year</label>
                        <select
                            value={year} onChange={(e) => setYear(e.target.value)}
                            className="block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Year</option>
                            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Semester</label>
                        <select
                            value={semester} onChange={(e) => setSemester(e.target.value)}
                            className="block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Sem</option>
                            {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Sections (Multi-Select)</label>
                        <div className="flex flex-wrap gap-2 rounded-md border border-slate-300 p-2 min-h-[42px] bg-white">
                            {sections.length === 0 && <span className="text-xs text-slate-400">Select Year/Sem first</span>}
                            {sections.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleSectionToggle(s.id)}
                                    className={`rounded px-2 py-0.5 text-xs font-bold transition-all ${selectedSectionIds.includes(s.id)
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {viewMode === "manual" ? (
                    /* MANUAL MODE UI */
                    <>
                        <div className="grid gap-4 md:grid-cols-3 bg-slate-50 p-4 rounded-lg">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Date (DD-MM-YYYY)</label>
                                <div className="relative">
                                    {/* Hidden native date picker for calendar UI */}
                                    <input 
                                        type="date" 
                                        value={date} 
                                        onChange={(e) => setDate(e.target.value)} 
                                        max={new Date().toISOString().split("T")[0]} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                        title="Select Date"
                                    />
                                    {/* Visible formatted display */}
                                    <div className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700">
                                        <span>
                                            {date ? `${date.split('-')[2]}-${date.split('-')[1]}-${date.split('-')[0]}` : "DD-MM-YYYY"}
                                        </span>
                                        <FaCalendarAlt className="text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Subject & Period - Hidden for SMS_USER */}
                            {!["USER", "SMS_USER"].includes((session?.user?.role || "").toUpperCase()) && (
                                <>
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Subject</label>
                                        <select
                                            value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                                            className="block w-full rounded-md border border-slate-300 p-2 text-sm"
                                        >
                                            <option value="">Select Subject</option>
                                            {subjects.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} {(s as any).shortName ? `(${(s as any).shortName})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Periods (Select Multiple)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {periods.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => handlePeriodToggle(p.id)}
                                                    className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${selectedPeriods.includes(p.id)
                                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                                                        }`}
                                                >
                                                    {p.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Lab Batch Selection */}
                                    {subjects.find(s => s.id === selectedSubject && (s as any).type === "LAB") && (
                                        <div className="md:col-span-3 mt-4 border-t pt-4">
                                            <label className="mb-1 block text-xs font-semibold uppercase text-violet-600">Lab Batch (Optional)</label>
                                            <div className="flex gap-4 items-center">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedLabBatch("")}
                                                        className={`px-4 py-2 rounded-md text-sm font-medium border ${!selectedLabBatch ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                                    >
                                                        All Students
                                                    </button>
                                                    {labBatches.map(b => (
                                                        <button
                                                            key={b.id}
                                                            onClick={() => setSelectedLabBatch(b.id)}
                                                            className={`px-4 py-2 rounded-md text-sm font-medium border ${selectedLabBatch === b.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                                                        >
                                                            {b.name}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-slate-400">Select a batch to filter the student list.</p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex flex-col items-center justify-center gap-2">
                            <button
                                onClick={handleFetchStudents} disabled={loading}
                                className="flex min-w-[200px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? <LogoSpinner fullScreen={false} /> : "Load Students"}
                            </button>
                            {message && <span className="text-sm font-medium text-red-600">{message}</span>}
                        </div>

                        {students.length > 0 && (
                            <div className="mt-6 animate-in fade-in">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="font-bold text-slate-800">Student List ({students.length})</h3>
                                    <div className="flex gap-2 text-sm">
                                        <button onClick={() => markAll("Present")} className="text-green-600 hover:underline">All Present</button>
                                        <span className="text-slate-300">|</span>
                                        <button onClick={() => markAll("Absent")} className="text-red-600 hover:underline">All Absent</button>
                                    </div>
                                </div>

                                {/* CARD GRID LAYOUT */}
                                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    {students.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => toggleStudentStatus(s.id)}
                                            className={`cursor-pointer rounded-lg border p-4 text-center transition-all shadow-sm select-none ${s.status === "Absent"
                                                ? "bg-red-50 border-red-500 ring-1 ring-red-500" // Red for Absent
                                                : "bg-white border-slate-200 hover:border-green-400 hover:shadow-md" // White/Greenish hover for Present
                                                }`}
                                        >
                                            <p className={`text-lg font-bold ${s.status === "Absent" ? "text-red-700" : "text-slate-800"}`}>
                                                {s.rollNumber.slice(-3) || s.rollNumber}
                                            </p>
                                            <p className="mt-1 truncate text-xs font-medium text-slate-500" title={s.name}>
                                                {s.name} <span className="text-slate-300">({s.section?.name})</span>
                                            </p>
                                            <div className="mt-2 flex justify-center">
                                                {s.status === "Absent" ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700"><FaTimesCircle /> Absent</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700"><FaCheckCircle /> Present</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="sticky bottom-4 mt-8 flex justify-end">
                                    <button
                                        onClick={initiateSubmission}
                                        disabled={submitting}
                                        className="flex items-center gap-2 rounded-full bg-slate-900 px-8 py-3 font-bold text-white shadow-xl hover:bg-slate-800 hover:scale-105 transition-all disabled:opacity-50"
                                    >
                                        <FaSave /> Review & Submit
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* BULK MODE UI */
                    <div className="space-y-8 animate-in fade-in">
                        {/* 1. Download Template */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800"><FaFileDownload /> 1. Download Template</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-semibold uppercase text-slate-500">Start Date (DD-MM-YYYY)</label>
                                    <div className="relative mt-1">
                                        <input 
                                            type="date" 
                                            value={bulkStartDate} 
                                            onChange={(e) => setBulkStartDate(e.target.value)} 
                                            max={new Date().toISOString().split("T")[0]}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                        />
                                        <div className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700 h-[38px]">
                                            <span>
                                                {bulkStartDate ? `${bulkStartDate.split('-')[2]}-${bulkStartDate.split('-')[1]}-${bulkStartDate.split('-')[0]}` : "DD-MM-YYYY"}
                                            </span>
                                            <FaCalendarAlt className="text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-semibold uppercase text-slate-500">End Date (DD-MM-YYYY)</label>
                                    <div className="relative mt-1">
                                        <input 
                                            type="date" 
                                            value={bulkEndDate} 
                                            onChange={(e) => setBulkEndDate(e.target.value)} 
                                            max={new Date().toISOString().split("T")[0]}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                        />
                                        <div className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-700 h-[38px]">
                                            <span>
                                                {bulkEndDate ? `${bulkEndDate.split('-')[2]}-${bulkEndDate.split('-')[1]}-${bulkEndDate.split('-')[0]}` : "DD-MM-YYYY"}
                                            </span>
                                            <FaCalendarAlt className="text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={downloadTemplate}
                                    className="mb-0.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700"
                                >
                                    Download
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Generates a pre-filled Excel sheet for the selected date range and class.</p>
                        </div>

                        {/* 2. Upload Template */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-800"><FaFileUpload /> 2. Upload Data</h3>
                            <div className="flex gap-4 items-center">
                                <input
                                    type="file" accept=".xlsx, .xls"
                                    onChange={handleBulkFileChange}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                                />
                                <button
                                    onClick={uploadBulk} disabled={!bulkFile || bulkUploading}
                                    className="rounded-md bg-green-600 px-6 py-2 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-50"
                                >
                                    {bulkUploading ? "Uploading..." : "Upload"}
                                </button>
                            </div>
                        </div>

                        {/* 3. Delete Data */}
                        <div className="rounded-lg border border-red-100 bg-red-50 p-6">
                            <h3 className="mb-4 flex items-center gap-2 font-bold text-red-800"><FaTrash /> 3. Delete Bulk Records</h3>
                            <p className="mb-4 text-sm text-red-600">Permanently delete attendance records for the selected section in the date range.</p>
                            <button
                                onClick={deleteBulk}
                                className="rounded-md bg-red-600 px-6 py-2 text-sm font-bold text-white shadow hover:bg-red-700"
                            >
                                Delete Records
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary Modal */}
            {showSummary && summaryData && (
                <Modal isOpen={showSummary} onClose={handleCloseSummary} title={submissionStep === "confirm" ? "Confirm Attendance" : "Attendance Submitted"}>
                    <div className="p-6">
                        <div className="flex flex-col items-center mb-6">
                            {submissionStep === "confirm" ? (
                                <h2 className="text-xl font-bold text-slate-800">Confirm Submission</h2>
                            ) : (
                                <>
                                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                                        <FaCheckCircle className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">Success!</h2>
                                    <p className="text-sm text-slate-500">Attendance has been recorded.</p>
                                </>
                            )}
                        </div>

                        <div className="rounded-lg bg-slate-50 p-4 border border-slate-100 mb-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {/* Details Block (Same for both) */}
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Date</span>
                                    <span className="font-semibold text-slate-900">{formatISTDate(summaryData.date)}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Class</span>
                                    <span className="font-semibold text-slate-900">Yr {summaryData.year} - Sem {summaryData.semester} - Sec {summaryData.section}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Subject</span>
                                    <span className="font-semibold text-slate-900">{summaryData.subject}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Periods</span>
                                    <span className="font-semibold text-slate-900">{summaryData.periods}</span>
                                </div>

                                <div className="col-span-2 border-t border-slate-200 my-2"></div>

                                {/* Stats - Highlighted for Confirmation */}
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Total Students</span>
                                    <span className="font-bold text-slate-900 text-lg">{summaryData.total}</span>
                                </div>
                                <div></div>

                                <div className="flex flex-col">
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Present</span>
                                    <span className="font-bold text-green-600 text-lg">{summaryData.present}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Absent</span>
                                    <span className="font-bold text-red-600 text-lg">{summaryData.absent}</span>
                                </div>
                            </div>
                        </div>

                        {submissionStep === "confirm" ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSummary(false)}
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeSubmission}
                                    disabled={submitting}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {submitting ? "Saving..." : "Confirm & Save"}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <button
                                        onClick={downloadSummaryReport}
                                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                                    >
                                        <FaDownload /> Full Report
                                    </button>
                                    <button
                                        onClick={downloadAbsentees}
                                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                                    >
                                        <FaDownload /> Absentees
                                    </button>
                                </div>

                                <button
                                    onClick={handleCloseSummary}
                                    className="mt-6 w-full text-center text-sm text-slate-400 hover:text-slate-600 underline"
                                >
                                    Close & Return
                                </button>
                            </>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}
