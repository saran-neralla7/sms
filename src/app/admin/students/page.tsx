"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import Modal from "@/components/Modal";
import * as XLSX from "xlsx";
import { FaDownload, FaEdit, FaFileImport, FaPlus, FaTrash, FaUserGraduate, FaCamera, FaTimes, FaPhone, FaBuilding, FaLayerGroup, FaSearch, FaUser } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useSession } from "next-auth/react";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import LogoSpinner from "@/components/LogoSpinner";
import StudentHoverCard from "@/components/StudentHoverCard";
import Link from "next/link";
import Image from "next/image"; // Added Image import
import { formatISTDate } from "@/lib/dateUtils";

export default function StudentsPage() {
    const router = useRouter();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Photo Preview State
    const [photoStudent, setPhotoStudent] = useState<Student | null>(null);

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

    // SMS Logs Modal State
    const [isSmsLogModalOpen, setIsSmsLogModalOpen] = useState(false);
    const [smsLogData, setSmsLogData] = useState<{ student: any, absentDates: any[] } | null>(null);
    const [smsLogLoading, setSmsLogLoading] = useState(false);

    const openSmsLogs = async (studentId: string) => {
        setIsSmsLogModalOpen(true);
        setSmsLogLoading(true);
        setSmsLogData(null);
        try {
            const res = await fetch(`/api/students/${studentId}/sms-logs`);
            if (res.ok) {
                const data = await res.json();
                setSmsLogData(data);
            } else {
                setSmsLogData({ student: null, absentDates: [] }); // Error state
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSmsLogLoading(false);
        }
    };

    // Filters
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Filters - Init from URL or Default
    const [year, setYear] = useState(searchParams?.get("year") || "");
    const [semester, setSemester] = useState(searchParams?.get("semester") || "");
    const [section, setSection] = useState(searchParams?.get("section") || "");
    const [filterDepartmentId, setFilterDepartmentId] = useState(searchParams?.get("dept") || "");

    // Search State
    const [searchTerm, setSearchTerm] = useState(searchParams?.get("q") || "");
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
    const [batches, setBatches] = useState<any[]>([]); // Added batches

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        rollNumber: "",
        mobile: "",
        year: "1",
        semester: "1",
        departmentId: "",
        sectionId: "",
        regulation: "R22",
        batchId: "", // Added batchId
        isDetained: false,
        isLateralEntry: false,
        originalBatchId: ""
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

    const fetchBatches = async () => {
        try {
            const res = await fetch("/api/batches");
            if (res.ok) setBatches(await res.json());
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

    const updateFilters = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams?.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        router.push(`${pathname || "/"}?${params.toString()}`);
    };

    // Update state when URL params change (e.g. Back button)
    useEffect(() => {
        setYear(searchParams?.get("year") || "");
        setSemester(searchParams?.get("semester") || "");
        setSection(searchParams?.get("section") || "");
        setFilterDepartmentId(searchParams?.get("dept") || "");

        // Sync search only if it differs significantly or on initial load
        // But we want to avoid overwriting user typing if they are typing.
        // Usually initial load is enough.
        const q = searchParams?.get("q") || "";
        if (q !== searchTerm) {
            setSearchTerm(q);
        }
    }, [searchParams]);

    // Debounce Logic for Search
    useEffect(() => {
        const handler = setTimeout(() => {
            const currentQ = searchParams?.get("q") || "";
            if (searchTerm !== currentQ) {
                updateFilters("q", searchTerm);
            }
        }, 500); // 500ms delay

        return () => {
            clearTimeout(handler);
        };
    }, [searchTerm]);

    // Pagination State
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [total, setTotal] = useState(0);

    const fetchStudents = async () => {
        setLoading(true);
        setStatus({ type: null, message: "" });
        try {
            const query = new URLSearchParams();
            if (year) query.set("year", year);
            if (semester) query.set("semester", semester);
            if (section) query.set("sectionId", section);
            if (filterDepartmentId) query.set("departmentId", filterDepartmentId);

            // Search & Pagination
            if (searchTerm) query.set("q", searchTerm);
            query.set("page", page.toString());
            query.set("limit", limit.toString());

            const res = await fetch(`/api/students?${query.toString()}`);
            if (res.ok) {
                const json = await res.json();
                // Handle new response structure { data, meta }
                // Fallback for safety if API reverts or glitch
                if (Array.isArray(json)) {
                    setStudents(json);
                    setTotal(json.length);
                } else {
                    setStudents(json.data);
                    setTotal(json.meta.total);
                }
                setSelectedStudentIds(new Set());
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Failed to fetch students." });
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering is NO LONGER needed as API does it.
    // We just point filterStudents to students for compatibility with rest of UI
    const filteredStudents = students;

    // Effect to re-fetch students when filters change
    useEffect(() => {
        // Reset to page 1 when filters change (except page itself)
        setPage(1);
    }, [year, semester, section, filterDepartmentId, searchTerm, limit]);

    useEffect(() => {
        fetchDepartments();
        fetchSections(); // Initial fetch
        fetchRegulations();
        fetchBatches();
    }, []);

    useEffect(() => {
        fetchStudents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, year, semester, section, filterDepartmentId, searchTerm, limit]);

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
                setFormData({ rollNumber: "", name: "", mobile: "", year: "1", semester: "1", departmentId: "", sectionId: "", regulation: "R22", batchId: "", isDetained: false, isLateralEntry: false, originalBatchId: "" });
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

    const clearFilters = () => {
        router.push(pathname || "/");
    };

    const openAddModal = () => {
        setEditingStudent(null);
        setFormData({ rollNumber: "", name: "", mobile: "", year: "1", semester: "1", departmentId: "", sectionId: "", regulation: "R22", batchId: "", isDetained: false, isLateralEntry: false, originalBatchId: "" }); // Reset
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
            regulation: student.regulation || "R22",
            batchId: student.batchId || "",
            isDetained: student.isDetained || false,
            isLateralEntry: student.isLateralEntry || false,
            originalBatchId: student.originalBatchId || ""
        });
        setIsModalOpen(true);
    };

    // ... (rest of file) ...
    // ...
    // But I must include the Batch UI in the render logic too.
    // I will use replace_file_content carefully. 
    // Wait, the previous views didn't show the student.batchId property usage in openEditModal because I didn't add it in the first view.
    // I will assume `openEditModal` logic was just shown and I can validly replace it if I match correctly.
    // The main block I am replacing is from `// Dropdown Data` all the way to `openEditModal`.
    // Wait, that's a HUGE block.
    // The previous view ended at line 800. The code snippet I have goes from 82 to 305.
    // I will replace `// Dropdown Data` (line 82) to `openEditModal` closing brace (line 305).
    // And I'll need to update the JSX form later.
    // Let's do the state/logic update first.

    // Actually, I can do it in two chunks or one.
    // Chunk 1: State & Fetchers & Handlers (lines 82-211)
    // Chunk 2: JSX Form (lines 879-998)

    // Chunk 1 replacement:



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


    // --- STANDARDIZED EXCEL HEADERS ---
    // Single Source of Truth for Column Names (checking aliases for Import)
    const HEADERS = {
        ROLL_NUMBER: ["Roll Number", "Roll", "rollNumber"],
        NAME: ["Name", "Student Name", "STUDENT NAME"],
        PARENT_MOBILE: ["Parent Mobile Number", "Mobile (Parent)", "Mobile", "Phone", "Parent Contact Number", "PARENT CONTACT NUMBER", "parent mobile number"],
        YEAR: ["Year", "year"],
        SEMESTER: ["Semester", "Sem", "semester"],
        SECTION: ["Section", "SectionId", "Sec", "section"],
        DEPARTMENT: ["Department", "DepartmentId", "Dept", "department"],
        HALL_TICKET: ["Hall Ticket Number", "Hall Ticket", "HALL TICKET NUMBER"],
        EAMCET_RANK: ["EAMCET Rank", "EAMCET RANK", "Rank"],
        DOB: ["Date of Birth", "DOB", "DATE OF BIRTH"],
        DATE_OF_REPORTING: ["Date of Reporting", "Joining Date", "DATE OF REPORTING"],
        GENDER: ["Gender", "GENDER"],
        CASTE: ["Caste", "CASTE"],
        CASTE_NAME: ["Caste Name", "CASTE NAME", "Sub Caste"],
        CATEGORY: ["Category", "CATEGORY"],
        ADMISSION_TYPE: ["Admission Type", "ADMISSION TYPE"],
        FATHER_NAME: ["Father Name", "FATHER NAME"],
        MOTHER_NAME: ["Mother Name", "MOTHER NAME"],
        ADDRESS: ["Address", "ADDRESS"],
        STUDENT_MOBILE: ["Student Contact Number", "Student Mobile", "STUDENT CONTACT NUMBER"],
        EMAIL: ["Email ID", "Email", "EMAIL ID"],
        AADHAR: ["Aadhar Number", "Aadhar", "AADHAR NUMBER"],
        ABC_ID: ["ABC ID", "ABC Id", "ABC id"],
        REIMBURSEMENT: ["Reimbursement", "REIMBURSEMENT"],
        CERTIFICATES_SUBMITTED: ["Certificates Submitted", "CERTIFICATES SUBMITTED"],
        DOMAIN_MAIL: ["Domain Mail ID", "DOMAIN MAIL ID"],
        BATCH_NAME: ["Batch Name", "BATCH NAME", "Batch"],
        IS_DETAINED: ["Is Detained", "IS DETAINED"],
        LATERAL_ENTRY: ["Lateral Entry", "LATERAL ENTRY", "Is Lateral"],
        ORIGINAL_BATCH: ["Original Batch", "ORIGINAL BATCH"]
    };

    // Helper to get value from row using multiple aliases
    const getValue = (row: any, aliases: string[]) => {
        for (const alias of aliases) {
            if (row[alias] !== undefined && row[alias] !== null) return row[alias];
        }
        return undefined;
    };


    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportStatus({
            isOpen: true,
            loading: true,
            successCount: 0,
            updatedCount: 0,
            failCount: 0,
            errors: []
        });

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

                    const parseExcelDate = (val: any): string | null => {
                        if (!val) return null;
                        if (typeof val === 'number') {
                            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                            if (!isNaN(date.getTime())) return date.toISOString();
                        }
                        if (typeof val === 'string') {
                            const d = new Date(val);
                            if (!isNaN(d.getTime())) return d.toISOString();
                            const parts = val.split(/[-/]/);
                            if (parts.length === 3) {
                                const p1 = parseInt(parts[0]);
                                const p2 = parseInt(parts[1]);
                                const p3 = parseInt(parts[2]);
                                if (p3 > 1000) {
                                    const dmy = new Date(p3, p2 - 1, p1);
                                    if (!isNaN(dmy.getTime())) return dmy.toISOString();
                                }
                            }
                        }
                        return null;
                    };

                    for (const row of data) {
                        const deptName = String(getValue(row, HEADERS.DEPARTMENT) || "");
                        const secName = String(getValue(row, HEADERS.SECTION) || "");

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
                            const roll = getValue(row, HEADERS.ROLL_NUMBER) || '?';
                            if (failCount < 20) importErrors.push(`Row ${roll}: Invalid Dept '${deptName}' or Section '${secName}'`);
                            failCount++;
                            continue;
                        }

                        const studentPayload = {
                            rollNumber: String(getValue(row, HEADERS.ROLL_NUMBER) || ""),
                            name: String(getValue(row, HEADERS.NAME) || ""),
                            mobile: String(getValue(row, HEADERS.PARENT_MOBILE) || ""),
                            year: String(getValue(row, HEADERS.YEAR) || ""),
                            semester: String(getValue(row, HEADERS.SEMESTER) || ""),
                            sectionId: finalSecId,
                            departmentId: finalDeptId,

                            // Extended Fields
                            hallTicketNumber: String(getValue(row, HEADERS.HALL_TICKET) || ""),
                            eamcetRank: String(getValue(row, HEADERS.EAMCET_RANK) || ""),
                            dateOfBirth: parseExcelDate(getValue(row, HEADERS.DOB)),
                            dateOfReporting: parseExcelDate(getValue(row, HEADERS.DATE_OF_REPORTING)),
                            gender: String(getValue(row, HEADERS.GENDER) || ""),
                            caste: String(getValue(row, HEADERS.CASTE) || ""),
                            casteName: String(getValue(row, HEADERS.CASTE_NAME) || ""), // Sub-caste
                            category: String(getValue(row, HEADERS.CATEGORY) || ""),
                            admissionType: String(getValue(row, HEADERS.ADMISSION_TYPE) || ""),
                            fatherName: String(getValue(row, HEADERS.FATHER_NAME) || ""),
                            motherName: String(getValue(row, HEADERS.MOTHER_NAME) || ""),
                            address: String(getValue(row, HEADERS.ADDRESS) || ""),
                            studentContactNumber: String(getValue(row, HEADERS.STUDENT_MOBILE) || ""),
                            emailId: String(getValue(row, HEADERS.EMAIL) || ""),
                            aadharNumber: String(getValue(row, HEADERS.AADHAR) || ""),
                            abcId: String(getValue(row, HEADERS.ABC_ID) || ""),
                            reimbursement: ["true", "y", "yes"].includes(String(getValue(row, HEADERS.REIMBURSEMENT) || "false").toLowerCase()),
                            certificatesSubmitted: ["true", "y", "yes"].includes(String(getValue(row, HEADERS.CERTIFICATES_SUBMITTED) || "false").toLowerCase()),
                            domainMailId: String(getValue(row, HEADERS.DOMAIN_MAIL) || "")
                        };

                        // Batch Logic
                        const batchName = String(getValue(row, HEADERS.BATCH_NAME) || "");
                        const isDetainedStr = String(getValue(row, HEADERS.IS_DETAINED) || "N").toUpperCase();
                        const isLateralStr = String(getValue(row, HEADERS.LATERAL_ENTRY) || "N").toUpperCase();
                        const originalBatchName = String(getValue(row, HEADERS.ORIGINAL_BATCH) || "");

                        if (batchName) {
                            const foundBatch = batches.find(b => b.name === batchName);
                            if (foundBatch) (studentPayload as any).batchId = foundBatch.id;
                        }

                        if (!(studentPayload as any).batchId) {
                            const roll = getValue(row, HEADERS.ROLL_NUMBER) || '?';
                            if (failCount < 20) importErrors.push(`Row ${roll}: Invalid or missing Batch '${batchName}'`);
                            failCount++;
                            continue;
                        }

                        if (isLateralStr === 'Y' || isLateralStr === 'YES' || isLateralStr === 'TRUE') {
                            (studentPayload as any).isLateralEntry = true;
                        } else {
                            (studentPayload as any).isLateralEntry = false;
                        }

                        if (isDetainedStr === 'Y' || isDetainedStr === 'YES') {
                            (studentPayload as any).isDetained = true;
                            if (originalBatchName) {
                                const foundOriginal = batches.find(b => b.name === originalBatchName);
                                if (foundOriginal) (studentPayload as any).originalBatchId = foundOriginal.id;
                            }
                        } else {
                            (studentPayload as any).isDetained = false;
                        }

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
                            if (data.action === "updated") updatedCount++; else successCount++;
                        } else {
                            failCount++;
                            const data = await res.json();
                            if (failCount < 20) importErrors.push(`Roll ${studentPayload.rollNumber}: ${data.error || "Failed to save"}`);
                        }
                    }

                    setImportStatus({
                        isOpen: true,
                        loading: false,
                        successCount,
                        updatedCount,
                        failCount,
                        errors: importErrors
                    });

                    fetchStudents();
                    e.target.value = "";
                } catch (error) {
                    console.error("Import error:", error);
                    setImportStatus({
                        isOpen: true,
                        loading: false,
                        successCount: 0,
                        updatedCount: 0,
                        failCount: 0,
                        errors: ["Critial error reading file."]
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
        Array.from(files).forEach((file) => formData.append("files", file));
        try {
            const res = await fetch("/api/upload-photos", { method: "POST", body: formData });
            if (res.ok) {
                const data = await res.json();
                setUploadStatus({ loading: false, results: data.results || [], successCount: data.successCount || 0, failCount: data.failCount || 0 });
                fetchStudents();
            } else {
                const errData = await res.json();
                setUploadStatus({ loading: false, results: [{ status: "error", message: errData.error || "Upload failed" }], successCount: 0, failCount: 1 });
            }
        } catch (error) {
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
                "ABC ID": "ABC123XYZ", "Reimbursement": "Y", "Certificates Submitted": "Y",
                "Domain Mail ID": "21131A0501@gvpcdpgc.edu.in",
                "Batch Name": "2023-2027", "Is Detained": "N", "Lateral Entry": "N", "Original Batch": "2023-2027"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "student_import_template_v4.xlsx");
    };

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFilters, setExportFilters] = useState({ year: "", semester: "", sectionId: "", departmentId: "" });
    const [exportLoading, setExportLoading] = useState(false);

    const handleExportClick = () => {
        setExportFilters({ year: year || "", semester: semester || "", sectionId: section || "", departmentId: filterDepartmentId || "" });
        setIsExportModalOpen(true);
    };

    const handleExportConfirm = async () => {
        if (!exportFilters.year || !exportFilters.semester) {
            setStatus({ type: "error", message: "Year and Semester are required for export." });
            return;
        }

        setExportLoading(true);
        setStatus({ type: null, message: "" });
        try {
            const query = new URLSearchParams();
            query.set("year", exportFilters.year);
            query.set("semester", exportFilters.semester);
            query.set("limit", "-1");
            if (exportFilters.sectionId) query.set("sectionId", exportFilters.sectionId);
            if (exportFilters.departmentId) query.set("departmentId", exportFilters.departmentId);
            else if (filterDepartmentId) query.set("departmentId", filterDepartmentId);

            const res = await fetch(`/api/students?${query.toString()}`);
            if (res.ok) {
                const result = await res.json();
                const studentsToExport = Array.isArray(result) ? result : (result.data || []);

                if (!studentsToExport || studentsToExport.length === 0) {
                    setStatus({ type: "error", message: "No students found." });
                    setExportLoading(false);
                    return;
                }

                const data = studentsToExport.map((s: any) => ({
                    "Roll Number": s.rollNumber,
                    "Name": s.name,
                    "Parent Mobile Number": s.mobile,
                    "Year": s.year,
                    "Semester": s.semester,
                    "Section": (typeof s.section === 'object' ? (s.section as any)?.name : s.section) || "",
                    "Department": (typeof s.department === 'object' ? (s.department as any)?.code : s.department) || "",
                    "Hall Ticket Number": s.hallTicketNumber || "",
                    "EAMCET Rank": s.eamcetRank || "",
                    "Date of Birth": s.dateOfBirth ? formatISTDate(s.dateOfBirth) : "",
                    "Date of Reporting": s.dateOfReporting ? formatISTDate(s.dateOfReporting) : "",
                    "Gender": s.gender || "",
                    "Caste": s.caste || "",
                    "Caste Name": s.casteName || "",
                    "Category": s.category || "",
                    "Admission Type": s.admissionType || "",
                    "Father Name": s.fatherName || "",
                    "Mother Name": s.motherName || "",
                    "Address": s.address || "",
                    "Student Contact Number": s.studentContactNumber || "",
                    "Email ID": s.emailId || "",
                    "Aadhar Number": s.aadharNumber || "",
                    "ABC ID": s.abcId || "",
                    "Reimbursement": s.reimbursement ? "Y" : "N",
                    "Certificates Submitted": s.certificatesSubmitted ? "Y" : "N",
                    "Domain Mail ID": s.domainMailId || "",
                    "Batch Name": s.batchString || "", // Using batchString from DB if available
                    "Is Detained": s.isDetained ? "Y" : "N",
                    "Lateral Entry": s.isLateralEntry ? "Y" : "N"
                    // Original batch not easily available in flat export unless joined, skipping for now or adding if critical
                }));

                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Students");
                XLSX.writeFile(wb, `students_export_${exportFilters.year}_${exportFilters.semester}.xlsx`);

                setIsExportModalOpen(false);
                setStatus({ type: "success", message: "Export downloaded successfully." });
            } else {
                setStatus({ type: "error", message: "Failed to fetch export data." });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Export failed." });
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

                    {selectedStudentIds.size > 0 && (session?.user as any)?.role === "ADMIN" && (
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
                        onChange={(e) => updateFilters("dept", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d: any) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                )}

                <select value={year} onChange={(e) => updateFilters("year", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
                <select value={semester} onChange={(e) => updateFilters("semester", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="">All Semesters</option>
                    <option value="1">1st Sem</option>
                    <option value="2">2nd Sem</option>
                </select>
                <select value={section} onChange={(e) => updateFilters("section", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                    <option value="">All Sections</option>
                    {sections.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            {/* Search Bar */}
            {/* Search Bar & Reset */}
            <div className="mb-6 flex gap-4">
                <div className="relative flex-1">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by Name or Roll Number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-sm transition-all"
                    />
                </div>
                <button
                    onClick={clearFilters}
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-red-600 transition-colors"
                >
                    Clear Filters
                </button>
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
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Photo</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Roll No</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Class</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500"><div className="flex justify-center"><LogoSpinner fullScreen={false} /></div></td></tr> :
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
                                        <td className="px-6 py-4">
                                            <div
                                                className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => student.photoUrl && setPhotoStudent(student)}
                                            >
                                                {student.photoUrl ? (
                                                    <Image
                                                        src={student.photoUrl}
                                                        alt={student.name}
                                                        fill
                                                        sizes="40px"
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                                                        <FaUser size={16} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-blue-600">
                                            <StudentHoverCard name={student.name} rollNumber={student.rollNumber} studentId={student.id} disableHover={true}>
                                                {student.rollNumber}
                                            </StudentHoverCard>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-blue-600">
                                            <StudentHoverCard name={student.name} rollNumber={student.rollNumber} studentId={student.id} disableHover={true}>
                                                {student.name}
                                            </StudentHoverCard>
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
                                                        onClick={() => openSmsLogs(student.id)}
                                                        className="rounded-md p-1.5 text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                                                        title="View SMS Absent Logs"
                                                    >
                                                        <FaLayerGroup size={16} />
                                                    </button>
                                                    {(session?.user as any)?.role === "ADMIN" && (
                                                        <button
                                                            onClick={() => confirmDelete(student)}
                                                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <FaTrash size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            {!loading && filteredStudents.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    {searchTerm ? "No matching students found" : "No students found"}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Rows per page:</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value))}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500"
                    >
                        <option value="20">20</option>
                        <option value="40">40</option>
                        <option value="60">60</option>
                        <option value="-1">All</option>
                    </select>
                    <span className="text-sm text-slate-500">
                        {limit === -1 ? `Showing all ${total} students` : `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, total)} of ${total}`}
                    </span>
                </div>

                {limit !== -1 && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm font-medium text-slate-600">
                            Page {page} of {Math.ceil(total / limit) || 1}
                        </span>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page * limit >= total}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
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

                    {/* Lateral Entry Logic */}
                    <div className="flex items-center gap-2 mt-4 ml-1">
                        <input
                            type="checkbox"
                            checked={formData.isLateralEntry}
                            onChange={(e) => setFormData({ ...formData, isLateralEntry: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            id="isLateralEntryCheck"
                        />
                        <label htmlFor="isLateralEntryCheck" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                            Is Lateral Entry? (Starts from 2nd Year)
                        </label>
                    </div>

                    {/* Detained Student Logic */}
                    <div className="flex items-center gap-2 mt-4 ml-1">
                        <input
                            type="checkbox"
                            checked={formData.isDetained}
                            onChange={(e) => setFormData({ ...formData, isDetained: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            id="isDetainedCheck"
                        />
                        <label htmlFor="isDetainedCheck" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                            Is Detained Student?
                        </label>
                    </div>

                    {formData.isDetained && (
                        <div className="mt-4 bg-red-50 p-4 rounded-md border border-red-100">
                            <p className="text-xs text-red-600 mb-2">
                                <strong>Note:</strong> Select the student's <strong>Current Operational Batch</strong> above.
                                Below, select their <strong>Original Batch</strong> (when they first joined).
                            </p>
                            <label className="text-sm font-medium text-slate-700">Original Batch (History)</label>
                            <select
                                value={formData.originalBatchId}
                                onChange={(e) => setFormData({ ...formData, originalBatchId: e.target.value })}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500"
                            >
                                <option value="">Select Original Batch</option>
                                {batches.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="mt-4">
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
                    <div>
                        <label className="text-sm font-medium text-slate-700">Batch</label>
                        <select
                            value={formData.batchId}
                            onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="">Select Batch (Optional)</option>
                            {batches.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.name}</option>
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
                        {["ADMIN", "DIRECTOR", "PRINCIPAL", "HOD", "FACULTY"].includes((session?.user as any)?.role?.toUpperCase()) && (
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">Department</label>
                                <select
                                    value={exportFilters.departmentId}
                                    onChange={(e) => setExportFilters({ ...exportFilters, departmentId: e.target.value })}
                                    className="w-full rounded-md border-slate-300 px-3 py-2 text-sm outline-none border bg-white"
                                // Disable data modification for non-admins if we wanted to lock it, but user requested options.
                                // API restricts access anyway if they try to access other dept data (for HOD/Faculty).
                                // For Admin, it allows selection.
                                >
                                    <option value="">All Departments</option>
                                    {departments.map((d: any) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                {(() => {
                                    // Dynamic filtering for modal
                                    const selectedDeptId = exportFilters.departmentId;
                                    let availableSections: any[] = [];

                                    if (selectedDeptId) {
                                        // Specific Department Selected
                                        const selectedDept = departments.find(d => d.id === selectedDeptId);
                                        if (selectedDept?.sections) {
                                            // Sections belong to this department explicitly
                                            availableSections = selectedDept.sections.map((s: any) => ({ ...s, _deptName: selectedDept.name }));
                                        }
                                    } else {
                                        // All Departments Selected
                                        // Flatten all sections from all departments and tag them
                                        // Note: Same section ID might appear multiple times if shared (M-to-M), but we list them to be clear.
                                        availableSections = departments.flatMap(d =>
                                            (d.sections || []).map((s: any) => ({ ...s, _deptName: d.name }))
                                        );
                                    }

                                    // Remove duplicates (by ID) IF validation suggests, but strict M-to-M implies context matters.
                                    // However, for filter dropdown, user might just want unique section names?
                                    // Actually, duplicate values in <select> is bad UX/invalid HTML.
                                    // Let's unique by (id + dept) if showing all? 
                                    // But since value is ID, duplicates are problematic.

                                    // If we show duplicates with same ID, picking one picks all.
                                    // Let's just list them.

                                    return availableSections.map((s: any, idx: number) => (
                                        <option key={`${s.id}-${idx}`} value={s.id}>
                                            {s.name} {selectedDeptId ? "" : `(${s._deptName})`}
                                        </option>
                                    ));
                                })()}
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
            {/* Photo Preview Modal */}
            <Modal
                isOpen={!!photoStudent}
                onClose={() => setPhotoStudent(null)}
                title={photoStudent?.name || "Student Photo"}
                maxWidth="max-w-xl"
            >
                <div className="p-4">
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                        {photoStudent?.photoUrl ? (
                            <Image
                                src={photoStudent.photoUrl}
                                alt={photoStudent.name}
                                fill
                                className="object-contain"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <FaUser size={64} />
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
            {/* SMS Logs Modal */}
            <Modal
                isOpen={isSmsLogModalOpen}
                onClose={() => setIsSmsLogModalOpen(false)}
                title="SMS Absent Logs"
            >
                <div className="space-y-4">
                    {smsLogLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                        </div>
                    ) : smsLogData ? (
                        <div>
                            <div className="mb-4 rounded-md bg-slate-50 p-3">
                                <p className="text-sm font-semibold text-slate-800">{smsLogData.student?.name}</p>
                                <p className="text-xs text-slate-500">{smsLogData.student?.rollNumber}</p>
                            </div>

                            {smsLogData.absentDates.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="font-medium">No Absent Records</p>
                                    <p className="text-xs mt-1">Student present for all SMS sessions.</p>
                                </div>
                            ) : (
                                <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 border-b border-slate-200">Date</th>
                                                <th className="px-4 py-2 border-b border-slate-200 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {smsLogData.absentDates.map((record: any) => (
                                                <tr key={record.recordId} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 text-slate-700">
                                                        {formatISTDate(record.date)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Absent</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-center text-red-500">Failed to load data.</p>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={() => setIsSmsLogModalOpen(false)}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </div >
    );
}
