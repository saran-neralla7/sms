"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaFileDownload, FaFileUpload, FaTrashAlt } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import Modal from "@/components/Modal";

interface Meta {
    id: string;
    name: string;
}

export default function InternalMarksUploadPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [departments, setDepartments] = useState<Meta[]>([]);
    const [academicYears, setAcademicYears] = useState<Meta[]>([]);
    const [sections, setSections] = useState<Meta[]>([]);

    const [selectedDept, setSelectedDept] = useState("");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [selectedSection, setSelectedSection] = useState("");

    const [isOldMarks, setIsOldMarks] = useState(false);
    const [subjectYear, setSubjectYear] = useState("");
    const [subjectSemester, setSubjectSemester] = useState("");

    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkUploading, setBulkUploading] = useState(false);

    // Modals Data
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);

    useEffect(() => {
        if (status === "authenticated") {
            const role = (session.user as any)?.role?.toUpperCase();
            if (role !== "ADMIN" && role !== "HOD") {
                router.push("/");
                return;
            }
            loadInitialData();
        }
    }, [status]);

    const loadInitialData = async () => {
        try {
            const [deptRes, academicRes] = await Promise.all([
                fetch("/api/departments"),
                fetch("/api/academic-years")
            ]);
            
            const depts = await deptRes.json();
            const ays = await academicRes.json();

            setDepartments(depts);
            setAcademicYears(ays);

            // Auto-select active academic year
            const activeAy = ays.find((ay: any) => ay.isCurrent);
            if (activeAy) setSelectedAcademicYear(activeAy.id);

            // Role based lock
            const role = (session?.user as any)?.role?.toUpperCase();
            if (role === "HOD") {
                const userDept = (session?.user as any).departmentId;
                if (userDept) {
                    setSelectedDept(userDept);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (selectedDept) {
            fetch(`/api/sections?departmentId=${selectedDept}`)
                .then(res => res.json())
                .then(data => setSections(data))
                .catch(err => console.error(err));
        } else {
            setSections([]);
            setSelectedSection("");
        }
    }, [selectedDept]);

    const downloadTemplate = () => {
        if (!selectedAcademicYear || !selectedDept || !year || !semester || !selectedSection) {
            alert("Please select Academic Year, Department, Year, Semester, and Section to generate template.");
            return;
        }

        const queryParams: any = {
            academicYearId: selectedAcademicYear,
            departmentId: selectedDept,
            year,
            semester,
            sectionId: selectedSection
        };

        if (isOldMarks && subjectYear && subjectSemester) {
            queryParams.subjectYear = subjectYear;
            queryParams.subjectSemester = subjectSemester;
        }

        const query = new URLSearchParams(queryParams);

        window.open(`/api/internal-marks/template?${query.toString()}`, "_blank");
    };

    const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) setBulkFile(e.target.files[0]);
    };

    const uploadBulk = async () => {
        if (!bulkFile || !selectedAcademicYear || !selectedDept || !year || !semester || !selectedSection) {
            setSuccessMessage("Please fill all selections and choose a file.");
            setIsSuccessModalOpen(true);
            return;
        }

        setBulkUploading(true);
        const formData = new FormData();
        formData.append("file", bulkFile);
        formData.append("academicYearId", selectedAcademicYear);
        formData.append("departmentId", selectedDept);
        formData.append("year", year);
        formData.append("semester", semester);
        formData.append("sectionId", selectedSection);

        if (isOldMarks && subjectYear && subjectSemester) {
            formData.append("subjectYear", subjectYear);
            formData.append("subjectSemester", subjectSemester);
        }

        try {
            const res = await fetch("/api/internal-marks/bulk", {
                method: "POST",
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMessage(`Success! Generated/Updated ${data.recordsUpdated} marks.\nSkipped missing students: ${data.skippedStudentRows}\nIgnored invalid marks: ${data.invalidMarksIgnored}`);
                setBulkFile(null);
                const fileInput = document.getElementById('marksUploadFile') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } else {
                setSuccessMessage(data.error || "Upload Failed");
            }
        } catch (e) {
            console.error(e);
            setSuccessMessage("Upload Error");
        } finally {
            setBulkUploading(false);
            setIsSuccessModalOpen(true);
        }
    };

    const handleBulkDelete = async () => {
        if (!selectedAcademicYear || !selectedDept || !year || !semester || !selectedSection) {
            setSuccessMessage("Please fill all drop-down selections before performing a Bulk Delete.");
            setIsSuccessModalOpen(true);
            setIsBulkDeleteModalOpen(false);
            return;
        }

        setBulkDeleting(true);
        try {
            const formData = {
                academicYearId: selectedAcademicYear,
                departmentId: selectedDept,
                year,
                semester,
                sectionId: selectedSection,
                subjectYear: isOldMarks ? subjectYear : undefined,
                subjectSemester: isOldMarks ? subjectSemester : undefined
            };

            const res = await fetch("/api/internal-marks/bulk-delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMessage(`Successfully deleted ${data.recordsDeleted} records.`);
                setIsBulkDeleteModalOpen(false);
                setIsSuccessModalOpen(true);
            } else {
                setSuccessMessage(data.error || "Bulk Delete Failed");
                setIsBulkDeleteModalOpen(false);
                setIsSuccessModalOpen(true);
            }
        } catch (e) {
            console.error(e);
            setSuccessMessage("Bulk Delete Error");
            setIsBulkDeleteModalOpen(false);
            setIsSuccessModalOpen(true);
        } finally {
            setBulkDeleting(false);
        }
    };

    if (status === "loading") return <LogoSpinner />;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 animate-in fade-in">
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Internal Marks - Bulk Upload</h1>
            <p className="mb-6 text-slate-500">Download Excel templates structured by class section, fill in the marks, and upload to synchronize with the database. Supports active and historical semesters.</p>

            <div className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                
                {/* SELECTORS */}
                <div className="grid gap-4 md:grid-cols-5">
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Academic Year</label>
                        <select
                            value={selectedAcademicYear}
                            onChange={(e) => setSelectedAcademicYear(e.target.value)}
                            className="block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select AY</option>
                            {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Department</label>
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            disabled={(session?.user as any)?.role?.toUpperCase() === "HOD" && !!(session?.user as any).departmentId}
                            className={`block w-full rounded-md border border-slate-300 p-2 text-sm ${((session?.user as any)?.role?.toUpperCase() === "HOD" && !!(session?.user as any).departmentId) ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
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
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Section</label>
                        <select
                            value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}
                            className="block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Section</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* HISTORICAL SESSIONS TOGGLE */}
                <div className="mt-2 text-sm text-slate-600">
                    <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" checked={isOldMarks} onChange={e => setIsOldMarks(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        Upload Previous Semester Marks (Backlog/HistoricalData)
                    </label>
                </div>

                {/* HISTORICAL SESSIONS FIELDS */}
                {isOldMarks && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase text-orange-700">Which Semester's Marks?</label>
                            <select
                                value={subjectYear} onChange={(e) => setSubjectYear(e.target.value)}
                                className="block w-full rounded-md border border-orange-300 p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="">Select Subject Year</option>
                                {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase text-orange-700">&nbsp;</label>
                            <select
                                value={subjectSemester} onChange={(e) => setSubjectSemester(e.target.value)}
                                className="block w-full rounded-md border border-orange-300 p-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="">Select Subject Sem</option>
                                {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="mt-4 border-t border-slate-100 pt-6 space-y-8">
                    {/* 1. Download Template */}
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg"><FaFileDownload className="text-blue-600" /> 1. Generate Template</h3>
                            <p className="mt-1 text-sm text-slate-500">Downloads a pre-filled Excel sheet containing student roll numbers and columns for all assigned subjects natively.</p>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="shrink-0 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
                        >
                            Download Excel Form
                        </button>
                    </div>

                    {/* 2. Upload Template */}
                    <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-lg"><FaFileUpload className="text-purple-600" /> 2. Upload Computed Marks</h3>
                            <p className="mt-1 text-sm text-slate-500 mb-4">Enter exact marks into your local Excel spreadsheet. Blank cells are safely ignored.</p>
                            
                            <input
                                type="file"
                                id="marksUploadFile"
                                accept=".xlsx, .xls"
                                onChange={handleBulkFileChange}
                                className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-purple-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-200 focus:outline-none"
                            />
                        </div>
                        <div className="shrink-0 flex items-end justify-end w-full md:w-auto mt-4 md:mt-0">
                            <button
                                onClick={uploadBulk}
                                disabled={bulkUploading || !bulkFile}
                                className="w-full md:w-auto flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-8 py-3 text-sm font-bold text-white shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {bulkUploading ? <LogoSpinner fullScreen={false} /> : "Upload to System"}
                            </button>
                        </div>
                    </div>

                    {/* 3. Bulk Delete Warning Row */}
                    <div className="rounded-lg border border-red-100 bg-red-50/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="flex items-center gap-2 font-bold text-red-800 text-lg"><FaTrashAlt className="text-red-600" /> 3. Rollback Database Changes</h3>
                            <p className="mt-1 text-sm text-red-600/80 mb-2">If you uploaded a broken spreadsheet or the wrong class segment, you can instantly strip every internal mark recorded for the current section and subjects chosen above.</p>
                        </div>
                        <div className="shrink-0 flex items-center justify-end whitespace-nowrap">
                            <button
                                onClick={() => setIsBulkDeleteModalOpen(true)}
                                disabled={bulkDeleting}
                                className="flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50 shadow-sm"
                            >
                                <FaTrashAlt />
                                {bulkDeleting ? "Deleting..." : "Purge Marks Data"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success/Error Modal */}
            <Modal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                title="System Notice"
                maxWidth="sm"
            >
                <div className="p-4 flex flex-col items-center text-center">
                    <p className="text-sm font-medium text-slate-700 mb-6 whitespace-pre-wrap">{successMessage}</p>
                    <button
                        onClick={() => setIsSuccessModalOpen(false)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold text-sm transition-colors"
                    >
                        Acknowledge
                    </button>
                </div>
            </Modal>

            {/* Bulk Delete Confirm Modal */}
            <Modal
                isOpen={isBulkDeleteModalOpen}
                onClose={() => setIsBulkDeleteModalOpen(false)}
                title="Confirm Bulk Deletion"
                maxWidth="md"
            >
                <div className="p-4">
                    <p className="text-sm text-slate-600 mb-6 font-medium">
                        Are you sure you want to permanently delete ALL internal marks for the exact group of students and subjects you specified in the dropdown fields above?
                        This action CANNOT be reversed automatically.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setIsBulkDeleteModalOpen(false)}
                            disabled={bulkDeleting}
                            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={bulkDeleting}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-sm transition-colors disabled:opacity-50"
                        >
                            {bulkDeleting ? "Processing..." : "Yes, Purge Records"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
