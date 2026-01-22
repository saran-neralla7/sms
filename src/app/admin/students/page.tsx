"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import Modal from "@/components/Modal";
import * as XLSX from "xlsx";
import { FaDownload, FaEdit, FaFileImport, FaPlus, FaTrash, FaUserGraduate, FaCamera, FaTimes, FaPhone, FaBuilding, FaLayerGroup, FaSearch } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useSession } from "next-auth/react";

import { useRouter } from "next/navigation";

export default function StudentsPage() {
    const router = useRouter();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Profile View State (Removed in favor of new Profile Page)
    // const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
    // const [viewingTab, setViewingTab] = useState<"details" | "attendance" | "results">("details");
    // const [attendanceStats, setAttendanceStats] = useState<any>(null);
    // const [statsLoading, setStatsLoading] = useState(false);

    // Results State
    // const [studentResults, setStudentResults] = useState<any[]>([]);
    // const [resultsLoading, setResultsLoading] = useState(false);

    // Stats Date Filter
    // const [statsDateRange, setStatsDateRange] = useState({ start: "", end: "" });

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

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
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

    // Filter students based on search query
    const filteredStudents = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelectAll = () => {
        if (selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
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

                    // Helper to parse dates from Excel (Serial or String)
                    const parseExcelDate = (val: any): string | null => {
                        if (!val) return null;

                        // If number (Excel Serial Date)
                        if (typeof val === 'number') {
                            const date = new Date((val - (25567 + 2)) * 86400 * 1000); // 25567 is offset, 2 is leap year bug adjust? 
                            // Actually XLSX utils usually handles this if we use cellDates: true, but manual:
                            // The standard formula for JS date from Excel serial is: new Date(Math.round((serial - 25569)*86400*1000));
                            // 25569 = 1970/1/1 in Excel days
                            const epoch = new Date(Math.round((val - 25569) * 86400 * 1000));
                            if (!isNaN(epoch.getTime())) return epoch.toISOString();
                        }

                        // If string
                        if (typeof val === 'string') {
                            // Try basic Date parse
                            const d = new Date(val);
                            if (!isNaN(d.getTime())) return d.toISOString();

                            // Try parsing DD-MM-YYYY or DD/MM/YYYY manually if standard fails or assuming strict format
                            // "15-05-2003"
                            const parts = val.split(/[-/]/);
                            if (parts.length === 3) {
                                // Assume DD-MM-YYYY if first part > 12? Or simply DD-MM-YYYY preference?
                                // Let's try to detect.
                                const p1 = parseInt(parts[0]);
                                const p2 = parseInt(parts[1]);
                                const p3 = parseInt(parts[2]);

                                // if p3 is year (4 digits)
                                if (p3 > 1000) {
                                    // d-m-y
                                    const dmy = new Date(p3, p2 - 1, p1);
                                    if (!isNaN(dmy.getTime())) return dmy.toISOString();
                                }
                            }
                        }
                        return null;
                    };

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
                            name: String(row['Name'] || row['name'] || row['Student Name'] || row['STUDENT NAME']),
                            mobile: String(row['Parent Mobile Number'] || row['Mobile'] || row['Phone'] || row['Parent Contact Number'] || row['PARENT CONTACT NUMBER'] || row['parent mobile number']),
                            year: String(row['Year'] || row['year']),
                            semester: String(row['Semester'] || row['Sem'] || row['semester']),
                            sectionId: finalSecId,
                            departmentId: finalDeptId,

                            // Extended Fields
                            hallTicketNumber: String(row['Hall Ticket Number'] || row['HALL TICKET NUMBER'] || ""),
                            eamcetRank: String(row['EAMCET Rank'] || row['EAMCET RANK'] || ""),
                            dateOfBirth: parseExcelDate(row['Date of Birth'] || row['DATE OF BIRTH']),
                            dateOfReporting: parseExcelDate(row['Date of Reporting'] || row['DATE OF REPORTING']),
                            gender: String(row['Gender'] || row['GENDER'] || ""),
                            caste: String(row['Caste'] || row['CASTE'] || ""),
                            casteName: String(row['Caste Name'] || row['CASTE NAME'] || ""),
                            category: String(row['Category'] || row['CATEGORY'] || ""),
                            admissionType: String(row['Admission Type'] || row['ADMISSION TYPE'] || ""),
                            fatherName: String(row['Father Name'] || row['FATHER NAME'] || ""),
                            motherName: String(row['Mother Name'] || row['MOTHER NAME'] || ""),
                            address: String(row['Address'] || row['ADDRESS'] || ""),
                            studentContactNumber: String(row['Student Contact Number'] || row['STUDENT CONTACT NUMBER'] || ""),
                            emailId: String(row['Email ID'] || row['EMAIL ID'] || ""),
                            aadharNumber: String(row['Aadhar Number'] || row['AADHAR NUMBER'] || ""),
                            abcId: String(row['ABC ID'] || row['ABC Id'] || ""),
                            reimbursement: String(row['Reimbursement'] || row['REIMBURSEMENT'] || "false").toLowerCase() === "true",
                            certificatesSubmitted: String(row['Certificates Submitted'] || row['CERTIFICATES SUBMITTED'] || "false").toLowerCase() === "true",
                            domainMailId: String(row['Domain Mail ID'] || row['DOMAIN MAIL ID'] || "")
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
            {
                "Roll Number": "21131A0501", "Name": "John Doe", "Parent Mobile Number": "9876543210",
                "Year": "3", "Semester": "1", "Section": "A", "Department": "CSE",
                "Hall Ticket Number": "HT123456", "EAMCET Rank": "1000",
                "Date of Birth": "2003-01-01", "Date of Reporting": "2021-09-01",
                "Gender": "Male", "Caste": "OC", "Caste Name": "Kapu", "Category": "A",
                "Admission Type": "Convener", "Father Name": "Father Doe", "Mother Name": "Mother Doe",
                "Address": "Visakhapatnam, AP", "Student Contact Number": "8888888888",
                "Email ID": "john.doe@example.com", "Aadhar Number": "123412341234",
                "ABC ID": "ABC123XYZ", "Reimbursement": "true", "Certificates Submitted": "true",
                "Domain Mail ID": "21131A0501@gvpcdpgc.edu.in"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "student_import_template_v3.xlsx");
    };

    // ... (fetchStudentStats, fetchStudentResults kept same or removed if used in new page) ...
    // Assuming we keep them for backward compat or if needed, but here simplifying

    // Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFilters, setExportFilters] = useState({ year: "", semester: "", sectionId: "" });
    const [exportLoading, setExportLoading] = useState(false);

    const handleExportClick = () => {
        // Pre-fill with current page filters
        setExportFilters({
            year: year || "",
            semester: semester || "",
            sectionId: section || ""
        });
        setIsExportModalOpen(true);
    };

    const handleExportConfirm = async () => {
        if (!exportFilters.year || !exportFilters.semester) {
            setStatus({ type: "error", message: "Year and Semester are required for export." });
            return;
        }

        setExportLoading(true);
        setStatus({ type: null, message: "" }); // Clear main status

        try {
            const query = new URLSearchParams();
            query.set("year", exportFilters.year);
            query.set("semester", exportFilters.semester);
            if (exportFilters.sectionId) query.set("sectionId", exportFilters.sectionId);
            if (filterDepartmentId) query.set("departmentId", filterDepartmentId); // Respect admin dept filter

            const res = await fetch(`/api/students?${query.toString()}`);
            if (res.ok) {
                const studentsData = await res.json();

                if (studentsData.length === 0) {
                    setStatus({ type: "error", message: "No students found for the selected criteria." });
                    setExportLoading(false);
                    setIsExportModalOpen(false);
                    return;
                }

                const data = studentsData.map((s: any) => ({
                    "Roll Number": s.rollNumber,
                    "Name": s.name,
                    "Mobile (Parent)": s.mobile,
                    "Student Mobile": s.studentContactNumber || "",
                    "Year": s.year,
                    "Semester": s.semester,
                    "Section": (typeof s.section === 'object' ? (s.section as any)?.name : s.section) || "",
                    "Department": (typeof s.department === 'object' ? (s.department as any)?.code : s.department) || "",
                    "Hall Ticket": s.hallTicketNumber || "",
                    "EAMCET Rank": s.eamcetRank || "",
                    "DOB": s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : "",
                    "Email": s.emailId || "",
                    "Aadhar": s.aadharNumber || "",
                    "Address": s.address || ""
                }));

                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Students");
                XLSX.writeFile(wb, `students_export_${exportFilters.year}_${exportFilters.semester}.xlsx`);

                setIsExportModalOpen(false);
                setStatus({ type: "success", message: "Export downloaded successfully." });
            } else {
                setStatus({ type: "error", message: "Failed to fetch data for export." });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error during export." });
        } finally {
            setExportLoading(false);
        }
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
                        onClick={handleExportClick}
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

            <div className={`mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user as any)?.role?.toUpperCase()) ? "sm:grid-cols-4" : "sm:grid-cols-3"
                }`}>
                {/* Admin Only Department Filter */}
                {/* Global Admin Department Filter */}
                {["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user as any)?.role?.toUpperCase()) && (
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

            {/* Search Bar */}
            <div className="mb-6 relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search by Name or Roll Number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-sm transition-all"
                />
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
                                        checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
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
                                filteredStudents.map((student) => (
                                    <tr key={student.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedStudentIds.has(student.id)}
                                                onChange={() => toggleStudentSelection(student.id)}
                                            />
                                        </td>
                                        <td
                                            className="whitespace-nowrap px-6 py-4 text-sm font-mono text-blue-600 cursor-pointer hover:underline"
                                            onClick={() => router.push(`/admin/students/${student.id}`)}
                                        >
                                            {student.rollNumber}
                                        </td>
                                        <td
                                            className="whitespace-nowrap px-6 py-4 text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                                            onClick={() => router.push(`/admin/students/${student.id}`)}
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
                            {!loading && filteredStudents.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    {searchQuery ? "No matching students found" : "No students found"}
                                </td></tr>
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

            {/* Export Modal */}
            <Modal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                title="Export Students"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Select criteria for student export. Year and Semester are mandatory.</p>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Year <span className="text-red-500">*</span></label>
                            <select
                                value={exportFilters.year}
                                onChange={(e) => setExportFilters({ ...exportFilters, year: e.target.value })}
                                className="w-full rounded-md border-slate-300 px-3 py-2 text-sm outline-none border bg-white"
                            >
                                <option value="">Select Year</option>
                                {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Semester <span className="text-red-500">*</span></label>
                            <select
                                value={exportFilters.semester}
                                onChange={(e) => setExportFilters({ ...exportFilters, semester: e.target.value })}
                                className="w-full rounded-md border-slate-300 px-3 py-2 text-sm outline-none border bg-white"
                            >
                                <option value="">Select Semester</option>
                                {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Section</label>
                            <select
                                value={exportFilters.sectionId}
                                onChange={(e) => setExportFilters({ ...exportFilters, sectionId: e.target.value })}
                                className="w-full rounded-md border-slate-300 px-3 py-2 text-sm outline-none border bg-white"
                            >
                                <option value="">All Sections</option>
                                {sections.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setIsExportModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExportConfirm}
                            disabled={exportLoading}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
                        >
                            {exportLoading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <FaDownload /> Download
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
