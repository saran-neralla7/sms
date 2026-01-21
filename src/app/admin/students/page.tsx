"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import Modal from "@/components/Modal";
import * as XLSX from "xlsx";
import { FaDownload, FaEdit, FaFileImport, FaPlus, FaTrash, FaUserGraduate, FaCamera, FaTimes, FaPhone, FaBuilding, FaLayerGroup } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useSession } from "next-auth/react";

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Profile View State
    const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
    const [viewingTab, setViewingTab] = useState<"details" | "attendance" | "results">("details");
    const [attendanceStats, setAttendanceStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    // Results State
    const [studentResults, setStudentResults] = useState<any[]>([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    // Stats Date Filter
    const [statsDateRange, setStatsDateRange] = useState({ start: "", end: "" });

    // Photo Upload State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{
        loading: boolean;
        results: any[];
        successCount: number;
        failCount: number;
    }>({ loading: false, results: [], successCount: 0, failCount: 0 });


    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    // Bulk Selection State
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

    // Filters
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [section, setSection] = useState("");
    const [filterDepartmentId, setFilterDepartmentId] = useState("");
    const { data: session } = useSession();
    // The original loading state for fetchStudents is now replaced by the new `loading` state,
    // but its initial value was `false`. The new `loading` state starts as `true`.
    // I will keep the original `loading` state for filters as it was, assuming it's distinct.
    // If the user intended to remove the filter-specific loading, they would have specified.
    const [filterLoading, setFilterLoading] = useState(false); // Renamed to avoid conflict with new `loading`

    // Status State
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    // Dropdown Data
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [regulations, setRegulations] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        rollNumber: "",
        mobile: "",
        year: "1",
        semester: "1",
        departmentId: "",
        sectionId: "",
        regulation: "R22"
    });

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments");
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            }
        } catch (e) { console.error(e); }
    };

    const fetchSections = async () => {
        let url = "/api/sections";
        if (filterDepartmentId) {
            url += `?departmentId=${filterDepartmentId}`;
        }
        try {
            const res = await fetch(url);
            if (res.ok) setSections(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchRegulations = async () => {
        try {
            const res = await fetch("/api/regulations");
            if (res.ok) setRegulations(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchStudents = async () => {
        setLoading(true);
        setStatus({ type: null, message: "" });
        try {
            const query = new URLSearchParams();
            if (year) query.set("year", year);
            if (semester) query.set("semester", semester);
            if (section) query.set("sectionId", section);
            // Note: API might prefer sectionId but legacy uses name for filter? 
            // Actually API lines 26 check sectionId. But line 15 param is 'section'.
            // The existing code sends 'section' (A, B..). API logic at line 15 handles it potentially (though snippet was vague).
            // We just add departmentId here.
            if (filterDepartmentId) query.set("departmentId", filterDepartmentId);

            const res = await fetch(`/api/students?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStudents(data);
                setSelectedStudentIds(new Set()); // Reset selection on fresh fetch
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Failed to fetch students." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
        fetchDepartments();
        fetchSections();
        fetchRegulations();
    }, [year, semester, section, filterDepartmentId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });

        try {
            const url = editingStudent
                ? `/api/students/${editingStudent.id}`
                : "/api/students";
            const method = editingStudent ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                const successMessage = editingStudent ? "Student updated successfully" : "Student created successfully";
                setStatus({ type: "success", message: successMessage });
                setEditingStudent(null);
                setFormData({ rollNumber: "", name: "", mobile: "", year: "1", semester: "1", departmentId: "", sectionId: "", regulation: "R22" });
                fetchStudents();
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to save student" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error saving student" });
        }
    };

    const confirmDelete = (student: Student) => {
        setStudentToDelete(student);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
            if (res.ok) {
                setStatus({ type: "success", message: "Student deleted successfully" });
                setStudents(prev => prev.filter(s => s.id !== id));
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                setStatus({ type: "error", message: "Failed to delete student" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error deleting student" });
        }
    };

    const handleBulkDelete = async () => {
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch("/api/students/bulk-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentIds: Array.from(selectedStudentIds) })
            });

            if (res.ok) {
                const data = await res.json();
                setStatus({ type: "success", message: `${data.count} students deleted successfully` });
                setStudents(prev => prev.filter(s => !selectedStudentIds.has(s.id)));
                setSelectedStudentIds(new Set());
                setIsBulkDeleteModalOpen(false);
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete students" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error deleting students" });
        }
    };

    const toggleSelectAll = () => {
        if (selectedStudentIds.size === students.length && students.length > 0) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(students.map(s => s.id)));
        }
    };

    const toggleStudentSelection = (id: string) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedStudentIds(newSet);
    };

    const openAddModal = () => {
        setEditingStudent(null);
        setFormData({ rollNumber: "", name: "", mobile: "", year: "1", semester: "1", departmentId: "", sectionId: "", regulation: "R22" });
        setIsModalOpen(true);
    };

    const openEditModal = (student: Student) => {
        setEditingStudent(student);
        setFormData({
            rollNumber: student.rollNumber,
            name: student.name,
            mobile: student.mobile,
            year: student.year,
            semester: student.semester,
            departmentId: student.departmentId || "",
            sectionId: student.sectionId || "",
            regulation: student.regulation || "R22"
        });
        setIsModalOpen(true);
    };

    // Import Status State
    const [importStatus, setImportStatus] = useState<{
        isOpen: boolean;
        loading: boolean;
        successCount: number;
        updatedCount: number;
        failCount: number;
        errors: string[];
    }>({
        isOpen: false,
        loading: false,
        successCount: 0,
        updatedCount: 0,
        failCount: 0,
        errors: []
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset and Open Modal
        setImportStatus({
            isOpen: true,
            loading: true,
            successCount: 0,
            updatedCount: 0,
            failCount: 0,
            errors: []
        });

        // Use setTimeout to allow UI to render the modal before heavy processing blocks thread
        setTimeout(() => {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const bstr = evt.target?.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data: any[] = XLSX.utils.sheet_to_json(ws);

                    let successCount = 0;
                    let updatedCount = 0;
                    let failCount = 0;
                    const importErrors: string[] = [];

                    for (const row of data) {
                        // Map Names to IDs
                        const deptName = row['Department'] || row['DepartmentId'] || row['Dept'] || row['department'] || "";
                        const secName = row['Section'] || row['SectionId'] || row['Sec'] || row['section'] || "";

                        // Find ID by Name (Case Insensitive)
                        const deptId = departments.find(d =>
                            d.name.toLowerCase() === deptName.toLowerCase() ||
                            d.code.toLowerCase() === deptName.toLowerCase()
                        )?.id;

                        const secId = sections.find(s =>
                            s.name.toLowerCase() === secName.toLowerCase()
                        )?.id;

                        const finalDeptId = deptId || (deptName.length > 10 ? deptName : "");
                        const finalSecId = secId || (secName.length > 10 ? secName : "");

                        if (!finalDeptId || !finalSecId) {
                            const rowName = String(row['Name'] || row['name'] || "Unknown");
                            const errorMsg = `Row ${row['Roll Number'] || '?'}: Invalid Dept '${deptName}' or Section '${secName}'`;
                            if (failCount < 20) importErrors.push(errorMsg); // Limit displayed errors
                            failCount++;
                            continue;
                        }

                        const studentPayload = {
                            rollNumber: String(row['Roll Number'] || row['Roll'] || row['rollNumber']),
                            name: String(row['Name'] || row['name']),
                            mobile: String(row['Mobile'] || row['Phone'] || row['mobile']),
                            year: String(row['Year'] || row['year']),
                            semester: String(row['Semester'] || row['Sem'] || row['semester']),
                            sectionId: finalSecId,
                            departmentId: finalDeptId
                        };

                        if (!studentPayload.rollNumber) {
                            failCount++;
                            continue;
                        }

                        const res = await fetch("/api/students", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(studentPayload)
                        });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.action === "updated") {
                                updatedCount++;
                            } else {
                                successCount++;
                            }
                        } else {
                            failCount++;
                            const data = await res.json();
                            if (failCount < 20) importErrors.push(`Roll ${studentPayload.rollNumber}: ${data.error || "Failed to save"}`);
                        }
                    }

                    setImportStatus({
                        isOpen: true,
                        loading: false, // Done
                        successCount,
                        updatedCount,
                        failCount,
                        errors: importErrors
                    });

                    fetchStudents();
                    // Clear file input
                    e.target.value = "";
                } catch (error) {
                    console.error("Import error:", error);
                    setImportStatus({
                        isOpen: true,
                        loading: false,
                        successCount: 0,
                        updatedCount: 0,
                        failCount: 0,
                        errors: ["Critial error reading file. Please check format."]
                    });
                }
            };
            reader.readAsBinaryString(file);
        }, 100);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploadStatus({ loading: true, results: [], successCount: 0, failCount: 0 });
        setIsUploadModalOpen(true);

        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append("files", file);
        });

        try {
            const res = await fetch("/api/students/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setUploadStatus({
                    loading: false,
                    results: data.results || [],
                    successCount: data.successCount || 0,
                    failCount: data.failCount || 0
                });
                fetchStudents();
            } else {
                setUploadStatus({ loading: false, results: [{ status: "error", message: "Upload failed" }], successCount: 0, failCount: 1 });
            }
        } catch (error) {
            console.error(error);
            setUploadStatus({ loading: false, results: [{ status: "error", message: "Network error" }], successCount: 0, failCount: 1 });
        }
    };


    const downloadSample = () => {
        const headers = [
            { "Roll Number": "21131A0501", "Name": "John Doe", "Mobile": "9876543210", "Year": "1", "Semester": "1", "Section": "A", "Department": "CSE" }
        ];
        const ws = XLSX.utils.json_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "student_import_template.xlsx");
    };

    const fetchStudentStats = async (studentId: string, start = "", end = "") => {
        setStatsLoading(true);
        try {
            const query = new URLSearchParams();
            if (start) query.set("startDate", start);
            if (end) query.set("endDate", end);

            const res = await fetch(`/api/students/${studentId}/stats?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAttendanceStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch stats", error);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchStudentResults = async (studentId: string) => {
        setResultsLoading(true);
        try {
            const res = await fetch(`/api/results?studentId=${studentId}`);
            if (res.ok) setStudentResults(await res.json());
        } catch (e) { console.error(e); }
        finally { setResultsLoading(false); }
    };

    // Reset tabs when closing
    useEffect(() => {
        if (!viewingStudent) {
            setViewingTab("details");
            setAttendanceStats(null);
            setStatsDateRange({ start: "", end: "" });
            setStudentResults([]); // Reset results
        }
    }, [viewingStudent]);

    // Check when date range changes
    useEffect(() => {
        if (viewingStudent && viewingTab === "attendance") {
            const timer = setTimeout(() => {
                fetchStudentStats(viewingStudent.id, statsDateRange.start, statsDateRange.end);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [statsDateRange, viewingTab, viewingStudent]);

    const exportData = () => {
        const data = students.map(s => ({
            "Roll Number": s.rollNumber,
            "Name": s.name,
            "Mobile": s.mobile,
            "Year": s.year,
            "Semester": s.semester,
            "Section": (typeof s.section === 'object' ? (s.section as any)?.name : s.section) || "",
            "Department": (typeof s.department === 'object' ? (s.department as any)?.code : s.department) || ""
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        XLSX.writeFile(wb, `students_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };


    return (
        <div className="mx-auto max-w-7xl">
            {/* Status Message */}
            {status.message && !isModalOpen && !isDeleteModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FaUserGraduate size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Manage Students</h1>
                        <p className="text-sm text-slate-500">Add, edit, or import student details.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={downloadSample}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                        title="Download Template"
                    >
                        <FaFileImport className="text-slate-400" />
                        Sample CSV
                    </button>
                    {(session?.user as any)?.role === "ADMIN" && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                            <FaCamera className="text-purple-500" />
                            Upload Photos
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                        </label>
                    )}

                    {!["FACULTY", "USER"].includes((session?.user as any)?.role) && (
                        <>
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                                <FaFileImport className="text-blue-500" />
                                Import
                                <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </>
                    )}

                    <button
                        onClick={exportData}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <FaDownload className="text-green-500" />
                        Export
                    </button>

                    {!["FACULTY", "USER"].includes((session?.user as any)?.role) && (
                        <button onClick={openAddModal} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
                            <FaPlus size={12} /> Add Student
                        </button>
                    )}

                    {selectedStudentIds.size > 0 && !["FACULTY", "USER"].includes((session?.user as any)?.role) && (
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
                        >
                            <FaTrash size={12} /> Delete ({selectedStudentIds.size})
                        </button>
                    )}
                </div>
            </div>

            <div className={`mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user as any)?.role) ? "sm:grid-cols-4" : "sm:grid-cols-3"
                }`}>
                {/* Admin Only Department Filter */}
                {/* Global Admin Department Filter */}
                {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user as any)?.role) && (
                    <select
                        value={filterDepartmentId}
                        onChange={(e) => setFilterDepartmentId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d: any) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                )}

                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="">All Semesters</option>
                    <option value="1">1st Sem</option>
                    <option value="2">2nd Sem</option>
                </select>
                <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="">All Sections</option>
                    {sections.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="w-4 px-6 py-4">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={students.length > 0 && selectedStudentIds.size === students.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Roll No</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Class</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">Loading...</td></tr> :
                                students.map((student) => (
                                    <tr key={student.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedStudentIds.has(student.id)}
                                                onChange={() => toggleStudentSelection(student.id)}
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-slate-600">{student.rollNumber}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-slate-600">{student.rollNumber}</td>
                                        <td
                                            className="whitespace-nowrap px-6 py-4 text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                            onClick={() => setViewingStudent(student)}
                                        >
                                            {student.name}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {student.year}-{student.semester} ({typeof student.section === 'object' ? (student.section as any)?.name : student.section})
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
                                            {!["FACULTY", "USER"].includes((session?.user as any)?.role) && (
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        onClick={() => openEditModal(student)}
                                                        className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FaEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(student)}
                                                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FaTrash size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            {!loading && students.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No students found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }}
                title={editingStudent ? "Edit Student" : "Add New Student"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {status.message && (
                        <div className={`rounded-md p-3 text-sm ${status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                            }`}>
                            {status.message}
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-slate-700">Full Name</label>
                        <input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Roll Number</label>
                        <input
                            value={formData.rollNumber}
                            onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Mobile Number</label>
                        <input
                            value={formData.mobile}
                            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Year</label>
                            <select
                                value={formData.year}
                                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            >
                                {[1, 2, 3, 4].map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Semester</label>
                            <select
                                value={formData.semester}
                                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            >
                                {[1, 2].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700">Regulation</label>
                        <select
                            value={formData.regulation}
                            onChange={(e) => setFormData({ ...formData, regulation: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="">Select Regulation</option>
                            {regulations.map((r: any) => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-700">Department</label>
                            <select
                                value={formData.departmentId}
                                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                required
                            >
                                <option value="">Select Dept</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-700">Section</label>
                            <select
                                value={formData.sectionId}
                                onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                required
                            >
                                <option value="">Select Section</option>
                                {(() => {
                                    // Filter sections based on selected department
                                    const selectedDept = departments.find(d => d.id === formData.departmentId);
                                    // If department has linked sections, show ONLY them.
                                    // If department has NO linked sections (or no dept selected), show ALL sections (fallback).
                                    // However, typically we want to restrict it.
                                    // Let's assume strict mode: if dept selected, use its sections.

                                    const availableSections = selectedDept?.sections && selectedDept.sections.length > 0
                                        ? selectedDept.sections
                                        : sections; // Fallback to all if none linked (or maybe empty? user said "according to it")

                                    return availableSections.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ));
                                })()}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm">
                            {editingStudent ? "Save Changes" : "Save Student"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    if (studentToDelete) {
                        setStudentToDelete(null); // Clear studentToDelete when modal is closed
                    }
                    setIsDeleteModalOpen(false);
                }}
                onConfirm={() => {
                    if (studentToDelete) {
                        handleDelete(studentToDelete.id);
                        setIsDeleteModalOpen(false); // Close modal after confirming
                    }
                }}
                title="Delete Student"
                message={`Are you sure you want to delete ${studentToDelete?.name}? This action cannot be undone.`}
                confirmText="Delete"
                isDangerous={true}
            />

            {/* Bulk Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isBulkDeleteModalOpen}
                onClose={() => setIsBulkDeleteModalOpen(false)}
                onConfirm={handleBulkDelete}
                title="Delete Multiple Students"
                message={`Are you sure you want to delete ${selectedStudentIds.size} students? This action cannot be undone.`}
                confirmText={`Delete ${selectedStudentIds.size} Students`}
                isDangerous={true}
            />

            {/* Import Status Modal */}
            <Modal
                isOpen={importStatus.isOpen}
                onClose={() => {
                    // Only allow closing if not loading
                    if (!importStatus.loading) {
                        setImportStatus({ ...importStatus, isOpen: false });
                    }
                }}
                title={importStatus.loading ? "Importing Students..." : "Import Results"}
            >
                <div className="space-y-4">
                    {importStatus.loading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                            <p className="text-slate-600 font-medium">Processing your file...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-1 rounded-lg bg-green-50 p-4 text-center border border-green-100">
                                    <p className="text-2xl font-bold text-green-600">{importStatus.successCount}</p>
                                    <p className="text-sm font-medium text-green-800">Created</p>
                                </div>
                                <div className="flex-1 rounded-lg bg-blue-50 p-4 text-center border border-blue-100">
                                    <p className="text-2xl font-bold text-blue-600">{importStatus.updatedCount}</p>
                                    <p className="text-sm font-medium text-blue-800">Updated</p>
                                </div>
                                <div className={`flex-1 rounded-lg p-4 text-center border ${importStatus.failCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`}>
                                    <p className={`text-2xl font-bold ${importStatus.failCount > 0 ? "text-red-600" : "text-slate-600"}`}>{importStatus.failCount}</p>
                                    <p className={`text-sm font-medium ${importStatus.failCount > 0 ? "text-red-800" : "text-slate-800"}`}>Failed</p>
                                </div>
                            </div>

                            {importStatus.errors.length > 0 && (
                                <div>
                                    <p className="mb-2 text-sm font-semibold text-slate-700">Error Details:</p>
                                    <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                        <ul className="list-inside list-disc space-y-1 text-red-600">
                                            {importStatus.errors.map((err, idx) => (
                                                <li key={idx} className="break-words">{err}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => setImportStatus({ ...importStatus, isOpen: false })}
                                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
            {/* Profile View Modal */}
            {viewingStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewingStudent(null)}>
                    <div
                        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col md:flex-row"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setViewingStudent(null)}
                            className="absolute right-4 top-4 z-10 rounded-full bg-black/10 p-2 text-slate-500 backdrop-blur-md transition-colors hover:bg-black/20 hover:text-slate-800"
                        >
                            <FaTimes size={20} />
                        </button>

                        {/* Left: Photo */}
                        <div className="md:w-1/2 bg-slate-100 flex items-center justify-center p-8 border-r border-slate-200 text-center">
                            <img
                                src={viewingStudent.photoUrl || "/default-avatar.png"}
                                alt={viewingStudent.name}
                                className="max-h-[500px] w-full object-contain rounded-lg shadow-lg cursor-zoom-in hover:scale-105 transition-transform"
                                onClick={() => window.open(viewingStudent.photoUrl || "/default-avatar.png", "_blank")}
                            />
                        </div>

                        {/* Right: Details */}
                        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                            <div className="mb-2">
                                <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">Student</span>
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-2">{viewingStudent.name}</h2>
                            <p className="text-xl font-mono text-slate-500 mb-8">{viewingStudent.rollNumber}</p>

                            {/* Tabs */}
                            <div className="flex border-b border-slate-200 mb-6">
                                <button
                                    onClick={() => setViewingTab("details")}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${viewingTab === "details" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => {
                                        setViewingTab("attendance");
                                        if (!attendanceStats) fetchStudentStats(viewingStudent.id);
                                    }}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${viewingTab === "attendance" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    Attendance
                                </button>
                                <button
                                    onClick={() => {
                                        setViewingTab("results");
                                        if (studentResults.length === 0) fetchStudentResults(viewingStudent.id);
                                    }}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${viewingTab === "results" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                                >
                                    Results
                                </button>
                            </div>

                            {viewingTab === "details" && (
                                <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                                            <FaLayerGroup size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Class</p>
                                            <p className="font-semibold text-slate-900">
                                                {viewingStudent.year} Year - {viewingStudent.semester} Sem ({typeof viewingStudent.section === 'object' ? (viewingStudent.section as any)?.name : viewingStudent.section})
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                            <FaBuilding size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Department</p>
                                            <p className="font-semibold text-slate-900">
                                                {typeof viewingStudent.department === 'object' ? (viewingStudent.department as any)?.name : viewingStudent.department}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
                                            <FaPhone size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Mobile Number</p>
                                            <p className="font-semibold text-slate-900">{viewingStudent.mobile}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {viewingTab === "attendance" && (
                                <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
                                    {/* Date Range Filter */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">From Date</label>
                                            <input
                                                type="date"
                                                value={statsDateRange.start}
                                                onChange={(e) => setStatsDateRange({ ...statsDateRange, start: e.target.value })}
                                                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-slate-500 mb-1">To Date</label>
                                            <input
                                                type="date"
                                                value={statsDateRange.end}
                                                onChange={(e) => setStatsDateRange({ ...statsDateRange, end: e.target.value })}
                                                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {statsLoading ? (
                                        <div className="flex justify-center py-8">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
                                        </div>
                                    ) : attendanceStats ? (
                                        <>
                                            {/* Overall Stats */}
                                            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-500">Overall Attendance</p>
                                                        <p className="text-2xl font-bold text-slate-900">{attendanceStats.overall.percentage}%</p>
                                                    </div>
                                                    <p className="text-sm text-slate-500 font-mono">
                                                        {attendanceStats.overall.attended} / {attendanceStats.overall.total} Classes
                                                    </p>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${attendanceStats.overall.percentage >= 75 ? "bg-green-500" : attendanceStats.overall.percentage >= 65 ? "bg-yellow-500" : "bg-red-500"}`}
                                                        style={{ width: `${attendanceStats.overall.percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>

                                            {/* Subject List */}
                                            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200">
                                                {attendanceStats.subjects.map((sub: any) => (
                                                    <div key={sub.id} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                                                        <div className="flex justify-between items-center">
                                                            <p className="font-semibold text-slate-700 text-sm truncate max-w-[200px]" title={sub.name}>{sub.name}</p>
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sub.percentage >= 75 ? "bg-green-100 text-green-700" :
                                                                sub.percentage >= 65 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                                                }`}>
                                                                {sub.percentage}%
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-slate-500">
                                                            <span>Attendance</span>
                                                            <span className="font-mono">{sub.attended} / {sub.total}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${sub.percentage >= 75 ? "bg-green-500" : sub.percentage >= 65 ? "bg-yellow-500" : "bg-red-500"}`}
                                                                style={{ width: `${sub.percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {attendanceStats.subjects.length === 0 && (
                                                    <p className="text-center text-sm text-slate-400 py-4">No subjects found for this class.</p>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-center text-red-500">Failed to load stats.</p>
                                    )}
                                </div>
                            )}

                            {viewingTab === "results" && (
                                <div className="space-y-6 animate-in slide-in-from-right fade-in duration-300">
                                    {resultsLoading ? (
                                        <div className="flex justify-center py-8">
                                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
                                        </div>
                                    ) : studentResults.length === 0 ? (
                                        <p className="text-center text-slate-500 py-8">No results found.</p>
                                    ) : (
                                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                            {studentResults.map((semResult: any) => (
                                                <div key={semResult.id} className="rounded-xl border border-slate-200 overflow-hidden">
                                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                                        <h4 className="font-semibold text-slate-800">
                                                            Year {semResult.year} - Sem {semResult.semester}
                                                        </h4>
                                                        <div className="flex gap-2">
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                                                                SGPA: {semResult.sgpa}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">
                                                                CGPA: {semResult.cgpa}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-white text-slate-500 border-b border-slate-100">
                                                            <tr>
                                                                <th className="px-4 py-2 font-medium">Subject Code</th>
                                                                <th className="px-4 py-2 font-medium text-right">Grade</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {(semResult.grades as any[]).map((g: any, i: number) => (
                                                                <tr key={i}>
                                                                    <td className="px-4 py-2 text-slate-700">{g.subjectCode}</td>
                                                                    <td className="px-4 py-2 text-right font-bold text-slate-900">{g.grade}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Upload Results Modal */}
            <Modal
                isOpen={isUploadModalOpen}
                onClose={() => !uploadStatus.loading && setIsUploadModalOpen(false)}
                title="Photo Upload Results"
            >
                <div className="space-y-4">
                    {uploadStatus.loading ? (
                        <div className="flex flex-col items-center py-8">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600 mb-4"></div>
                            <p className="text-slate-600">Uploading photos...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-4">
                                <div className="flex-1 rounded-lg bg-green-50 p-4 text-center border border-green-100">
                                    <p className="text-2xl font-bold text-green-600">{uploadStatus.successCount}</p>
                                    <p className="text-sm font-medium text-green-800">Success</p>
                                </div>
                                <div className="flex-1 rounded-lg bg-red-50 p-4 text-center border border-red-100">
                                    <p className="text-2xl font-bold text-red-600">{uploadStatus.failCount}</p>
                                    <p className="text-sm font-medium text-red-800">Failed</p>
                                </div>
                            </div>

                            {uploadStatus.results.length > 0 && (
                                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                                    <ul className="space-y-1">
                                        {uploadStatus.results.map((res: any, idx: number) => (
                                            <li key={idx} className={`flex justify-between ${res.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                                <span>{res.file}</span>
                                                <span>{res.status === 'success' ? '✓' : `✗ ${res.message || ''}`}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <button
                                    onClick={() => {
                                        setIsUploadModalOpen(false);
                                        setUploadStatus({ loading: false, results: [], successCount: 0, failCount: 0 });
                                    }}
                                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div >
    );
}
