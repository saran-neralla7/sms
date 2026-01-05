"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import Modal from "@/components/Modal";
import * as XLSX from "xlsx";
import { FaDownload, FaEdit, FaFileImport, FaPlus, FaTrash, FaUserGraduate } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useSession } from "next-auth/react";

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        rollNumber: "",
        mobile: "",
        year: "1",
        semester: "1",
        departmentId: "",
        sectionId: ""
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
        try {
            const res = await fetch("/api/sections");
            if (res.ok) setSections(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchStudents = async () => {
        setLoading(true);
        setStatus({ type: null, message: "" });
        try {
            const query = new URLSearchParams();
            if (year) query.set("year", year);
            if (semester) query.set("semester", semester);
            if (section) query.set("section", section); // This uses name (A,B,C)
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
                setFormData({ rollNumber: "", name: "", mobile: "", year: "1", semester: "1", departmentId: "", sectionId: "" });
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
        setFormData({ rollNumber: "", name: "", mobile: "", year: "1", semester: "1", departmentId: "", sectionId: "" });
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
        });
        setIsModalOpen(true);
    };

    // Import Status State
    const [importStatus, setImportStatus] = useState<{
        isOpen: boolean;
        loading: boolean;
        successCount: number;
        failCount: number;
        errors: string[];
    }>({
        isOpen: false,
        loading: false,
        successCount: 0,
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
                            successCount++;
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
                        failCount: 0,
                        errors: ["Critial error reading file. Please check format."]
                    });
                }
            };
            reader.readAsBinaryString(file);
        }, 100);
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
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                        <FaFileImport className="text-blue-500" />
                        Import
                        <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button
                        onClick={exportData}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <FaDownload className="text-green-500" />
                        Export
                    </button>
                    <button onClick={openAddModal} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
                        <FaPlus size={12} /> Add Student
                    </button>
                    {selectedStudentIds.size > 0 && (
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
                        >
                            <FaTrash size={12} /> Delete ({selectedStudentIds.size})
                        </button>
                    )}
                </div>
            </div>

            <div className={`mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${(session?.user as any)?.role === "ADMIN" ? "sm:grid-cols-4" : "sm:grid-cols-3"
                }`}>
                {/* Admin Only Department Filter */}
                {(session?.user as any)?.role === "ADMIN" && (
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
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
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
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">{student.name}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {student.year}-{student.semester} ({typeof student.section === 'object' ? (student.section as any)?.name : student.section})
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
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
                                    <p className="text-sm font-medium text-green-800">Imported</p>
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
        </div>
    );
}
