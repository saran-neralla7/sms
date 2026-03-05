"use client";

import { useState, useEffect } from "react";
import { Faculty, Department } from "@/types";
import Modal from "@/components/Modal";
import * as XLSX from "xlsx";
import { FaEdit, FaPlus, FaTrash, FaSearch, FaUserTie, FaEnvelope, FaPhone, FaFileImport, FaDownload, FaTimes, FaCheck, FaExclamationTriangle } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import Image from "next/image";

import { useSession } from "next-auth/react";

export default function FacultyPage() {
    const { data: session } = useSession();
    const [facultyList, setFacultyList] = useState<Faculty[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [saving, setSaving] = useState(false);

    // Import State
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

    const [formData, setFormData] = useState({
        empCode: "",
        empName: "",
        shortName: "",
        dob: "",
        gender: "",
        joinDate: "",
        departmentId: "",
        designation: "",
        mobile: "",
        email: "",
        bloodGroup: "",
        basicSalary: "",
        fatherName: "",
        motherName: "",
        address: "",
        qualification: "",
        aadharNo: "",
        panNo: ""
    });

    useEffect(() => {
        fetchFaculty();
        fetchDepartments();
    }, []);

    const fetchFaculty = async () => {
        try {
            const res = await fetch("/api/faculty");
            if (res.ok) {
                setFacultyList(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const deptRes = await fetch("/api/departments?all=true");
            if (deptRes.ok) setDepartments(await deptRes.json());
        } catch (error) { console.error(error); }
    };

    const downloadSample = () => {
        const headers = [
            {
                "Emp Code": "EMP001", "Emp Name": "John Doe", "Short Name": "JD",
                "Gender": "Male", "DOB": "1985-05-15", "Join Date": "2010-06-01",
                "Department": "CSE", "Designation": "Assistant Professor",
                "Mobile": "9876543210", "Email": "john.doe@example.com",
                "Blood Group": "O+", "Basic Salary": "50000",
                "Father Name": "Father Doe", "Mother Name": "Mother Doe",
                "Address": "Visakhapatnam", "Qualification": "M.Tech",
                "Aadhar No": "123412341234", "PAN No": "ABCDE1234F"
            }
        ];
        const ws = XLSX.utils.json_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "faculty_import_template.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportStatus({
            isOpen: true,
            loading: true,
            successCount: 0,
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
                    let failCount = 0;
                    const importErrors: string[] = [];

                    const parseDate = (val: any) => {
                        if (!val) return "";
                        if (typeof val === 'number') {
                            const epoch = new Date(Math.round((val - 25569) * 86400 * 1000));
                            if (!isNaN(epoch.getTime())) return epoch.toISOString();
                        }
                        const d = new Date(val);
                        return !isNaN(d.getTime()) ? d.toISOString() : "";
                    };

                    for (const row of data) {
                        const empCode = String(row['Emp Code'] || row['EmpCode'] || "").trim();
                        if (!empCode) {
                            // Skip empty rows silently or specific error
                            continue;
                        }

                        // Resolve Dept
                        const deptName = row['Department'] || row['Dept'] || "";
                        const deptId = departments.find(d =>
                            d.name.toLowerCase() === String(deptName).toLowerCase() ||
                            d.code.toLowerCase() === String(deptName).toLowerCase()
                        )?.id;

                        if (!deptId) {
                            failCount++;
                            if (importErrors.length < 20) importErrors.push(`Emp ${empCode}: Invalid Dept '${deptName}'`);
                            continue;
                        }

                        const payload = {
                            empCode,
                            empName: String(row['Emp Name'] || row['EmpName'] || ""),
                            shortName: String(row['Short Name'] || row['ShortName'] || ""),
                            gender: String(row['Gender'] || "Other"),
                            dob: parseDate(row['DOB']),
                            joinDate: parseDate(row['Join Date'] || row['JoinDate']),
                            departmentId: deptId,
                            designation: String(row['Designation'] || ""),
                            mobile: String(row['Mobile'] || ""),
                            email: String(row['Email'] || ""),
                            bloodGroup: String(row['Blood Group'] || row['BloodGroup'] || ""),
                            basicSalary: String(row['Basic Salary'] || row['BasicSalary'] || ""),
                            fatherName: String(row['Father Name'] || row['FatherName'] || ""),
                            motherName: String(row['Mother Name'] || row['MotherName'] || ""),
                            address: String(row['Address'] || ""),
                            qualification: String(row['Qualification'] || ""),
                            aadharNo: String(row['Aadhar No'] || row['AadharNo'] || ""),
                            panNo: String(row['PAN No'] || row['PANNo'] || "")
                        };

                        const res = await fetch("/api/faculty", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload)
                        });

                        if (res.ok) {
                            successCount++;
                        } else {
                            failCount++;
                            const err = await res.json();
                            if (importErrors.length < 20) importErrors.push(`Emp ${empCode}: ${err.error || "Failed"}`);
                        }
                    }

                    setImportStatus({
                        isOpen: true,
                        loading: false,
                        successCount,
                        failCount,
                        errors: importErrors
                    });

                    fetchFaculty();
                    e.target.value = "";

                } catch (error) {
                    console.error(error);
                    setImportStatus(prev => ({ ...prev, loading: false, errors: ["Critical file error"] }));
                }
            };
            reader.readAsBinaryString(file);
        }, 100);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });
        setSaving(true);

        try {
            const url = editingFaculty ? `/api/faculty/${editingFaculty.id}` : "/api/faculty";
            const method = editingFaculty ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setStatus({ type: "success", message: editingFaculty ? "Faculty updated successfully" : "Faculty created successfully" });
                setEditingFaculty(null);
                resetForm();
                fetchFaculty();
                setTimeout(() => {
                    setIsModalOpen(false);
                    setStatus({ type: null, message: "" });
                }, 1500);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to save faculty" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error saving faculty" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this faculty member? This will also remove their user login.")) return;

        try {
            const res = await fetch(`/api/faculty/${id}`, { method: "DELETE" });
            if (res.ok) {
                setFacultyList(prev => prev.filter(f => f.id !== id));
                setStatus({ type: "success", message: "Faculty deleted successfully" });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                setStatus({ type: "error", message: "Failed to delete faculty" });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openAddModal = () => {
        setEditingFaculty(null);
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (faculty: Faculty) => {
        setEditingFaculty(faculty);
        setFormData({
            empCode: faculty.empCode,
            empName: faculty.empName,
            shortName: faculty.shortName || "",
            dob: faculty.dob ? new Date(faculty.dob).toISOString().split('T')[0] : "",
            gender: faculty.gender,
            joinDate: faculty.joinDate ? new Date(faculty.joinDate).toISOString().split('T')[0] : "",
            departmentId: faculty.departmentId,
            designation: faculty.designation,
            mobile: faculty.mobile,
            email: faculty.email || "",
            bloodGroup: faculty.bloodGroup || "",
            basicSalary: faculty.basicSalary ? String(faculty.basicSalary) : "",
            fatherName: faculty.fatherName || "",
            motherName: faculty.motherName || "",
            address: faculty.address || "",
            qualification: faculty.qualification || "",
            aadharNo: faculty.aadharNo || "",
            panNo: faculty.panNo || ""
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            empCode: "",
            empName: "",
            shortName: "",
            dob: "",
            gender: "",
            joinDate: "",
            departmentId: "",
            designation: "",
            mobile: "",
            email: "",
            bloodGroup: "",
            basicSalary: "",
            fatherName: "",
            motherName: "",
            address: "",
            qualification: "",
            aadharNo: "",
            panNo: ""
        });
    };

    const filteredFaculty = facultyList.filter(f =>
        f.empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.empCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="mx-auto max-w-7xl pb-10">
            {/* Header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                        <FaUserTie size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Manage Faculty</h1>
                        <p className="text-sm text-slate-500">add and manage faculty profiles</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.open('/api/faculty/export', '_blank')}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <FaDownload size={12} /> Export
                    </button>
                    <button
                        onClick={downloadSample}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                    >
                        <FaDownload size={12} /> Template
                    </button>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                            className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                            <FaFileImport size={12} /> Import
                        </button>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 transition-colors"
                    >
                        <FaPlus size={12} /> Add Faculty
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by Name or Emp Code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 shadow-sm"
                    />
                </div>
            </div>

            {/* Status Message */}
            {status.message && !isModalOpen && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Designation</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Department</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="py-12 text-center"><LogoSpinner /></td></tr>
                            ) : filteredFaculty.length === 0 ? (
                                <tr><td colSpan={5} className="py-12 text-center text-slate-500">No faculty members found.</td></tr>
                            ) : (
                                filteredFaculty.map((f) => (
                                    <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-semibold text-slate-900">{f.empName}</p>
                                                <p className="text-xs font-mono text-slate-500">{f.empCode}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{f.designation}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                                                {f.department?.name || "N/A"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 text-sm text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <FaPhone size={10} className="text-slate-400" /> {f.mobile}
                                                </div>
                                                {f.email && (
                                                    <div className="flex items-center gap-2">
                                                        <FaEnvelope size={10} className="text-slate-400" /> {f.email}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEditModal(f)} className="rounded p-2 text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors">
                                                    <FaEdit size={16} />
                                                </button>
                                                {(session?.user as any)?.role === "ADMIN" && (
                                                    <button onClick={() => handleDelete(f.id)} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                                                        <FaTrash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingFaculty ? "Edit Faculty" : "Add New Faculty"}
                maxWidth="max-w-4xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Details */}
                    <div>
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-purple-600">Basic Details</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Input label="Employee Code *" value={formData.empCode} onChange={v => setFormData({ ...formData, empCode: v })} required disabled={!!editingFaculty} />
                            <Input label="Employee Name *" value={formData.empName} onChange={v => setFormData({ ...formData, empName: v })} required />
                            <Input label="Short Name" value={formData.shortName} onChange={v => setFormData({ ...formData, shortName: v })} />

                            <Input label="Designation *" value={formData.designation} onChange={v => setFormData({ ...formData, designation: v })} required />

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">Department *</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
                                    value={formData.departmentId}
                                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Dept</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>

                            <Input label="Basic Salary" type="number" value={formData.basicSalary} onChange={v => setFormData({ ...formData, basicSalary: v })} />
                        </div>
                    </div>

                    {/* Personal & Contact */}
                    <div>
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-purple-600">Personal & Contact</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Input label="Mobile *" value={formData.mobile} onChange={v => setFormData({ ...formData, mobile: v })} required />
                            <Input label="Email" type="email" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} />
                            <Input label="Blood Group" value={formData.bloodGroup} onChange={v => setFormData({ ...formData, bloodGroup: v })} />

                            <Input label="Date of Birth *" type="date" value={formData.dob} onChange={v => setFormData({ ...formData, dob: v })} required />

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-500">Gender *</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
                                    value={formData.gender}
                                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                    required
                                >
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <Input label="Joining Date *" type="date" value={formData.joinDate} onChange={v => setFormData({ ...formData, joinDate: v })} required />
                        </div>
                    </div>

                    {/* Other Details */}
                    <div>
                        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-purple-600">Additional Details</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Input label="Qualification" value={formData.qualification} onChange={v => setFormData({ ...formData, qualification: v })} />
                            <Input label="Father's Name" value={formData.fatherName} onChange={v => setFormData({ ...formData, fatherName: v })} />
                            <Input label="Mother's Name" value={formData.motherName} onChange={v => setFormData({ ...formData, motherName: v })} />
                            <Input label="Aadhar No" value={formData.aadharNo} onChange={v => setFormData({ ...formData, aadharNo: v })} />
                            <Input label="PAN No" value={formData.panNo} onChange={v => setFormData({ ...formData, panNo: v })} />
                            <div className="className='sm:col-span-2 lg:col-span-3'">
                                <Input label="Address" value={formData.address} onChange={v => setFormData({ ...formData, address: v })} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : editingFaculty ? "Update Faculty" : "Create Faculty"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Import Status Modal */}
            <Modal
                isOpen={importStatus.isOpen}
                onClose={() => !importStatus.loading && setImportStatus(prev => ({ ...prev, isOpen: false }))}
                title="Import Faculty"
            >
                <div className="space-y-4">
                    {importStatus.loading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <LogoSpinner />
                            <p className="mt-4 text-sm text-slate-500">Processing file...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-xl bg-green-50 p-4 text-center">
                                    <p className="text-2xl font-bold text-green-600">{importStatus.successCount}</p>
                                    <p className="text-xs text-green-700">Successful Imports</p>
                                </div>
                                <div className="rounded-xl bg-red-50 p-4 text-center">
                                    <p className="text-2xl font-bold text-red-600">{importStatus.failCount}</p>
                                    <p className="text-xs text-red-700">Failed Imports</p>
                                </div>
                            </div>

                            {importStatus.errors.length > 0 && (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                                    <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700">
                                        <FaExclamationTriangle /> Validation Errors
                                    </h4>
                                    <ul className="max-h-40 overflow-y-auto pl-4 text-xs text-red-600 list-disc space-y-1">
                                        {importStatus.errors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={() => setImportStatus(prev => ({ ...prev, isOpen: false }))}
                                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
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

function Input({ label, value, onChange, type = "text", required, disabled }: { label: string, value: string, onChange: (v: string) => void, type?: string, required?: boolean, disabled?: boolean }) {
    return (
        <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                disabled={disabled}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
        </div>
    );
}
