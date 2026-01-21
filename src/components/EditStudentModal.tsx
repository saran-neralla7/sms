
"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import { useSession } from "next-auth/react";
import Modal from "./Modal";

interface EditStudentModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student;
    onSuccess: () => void;
}

export default function EditStudentModal({ isOpen, onClose, student, onSuccess }: EditStudentModalProps) {
    const { data: session } = useSession();
    const userRole = (session?.user as any)?.role;
    const userDeptId = (session?.user as any)?.departmentId;

    const [activeTab, setActiveTab] = useState<"basic" | "personal" | "admission" | "contact">("basic");
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [regulations, setRegulations] = useState<any[]>([]);

    const [formData, setFormData] = useState<any>({});

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    useEffect(() => {
        if (isOpen && student) {
            // Initialize form data
            setFormData({
                ...student,
                // Ensure date strings are formatted for input date
                dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "",
                dateOfReporting: student.dateOfReporting ? new Date(student.dateOfReporting).toISOString().split('T')[0] : "",
                reimbursement: student.reimbursement ? "true" : "false",
                certificatesSubmitted: student.certificatesSubmitted ? "true" : "false",
                departmentId: student.departmentId || "",
                sectionId: student.sectionId || "",
                // If student has no regulation, we will try to set R22 once regulations load
                regulationId: student.regulationId || "",
            });
            setStatus({ type: null, message: "" }); // Clear status on open
            fetchDropdowns();
        }
    }, [isOpen, student]);

    const fetchDropdowns = async () => {
        try {
            const [deptRes, secRes, regRes] = await Promise.all([
                fetch("/api/departments"),
                fetch("/api/sections"),
                fetch("/api/regulations")
            ]);

            if (deptRes.ok) setDepartments(await deptRes.json());
            if (secRes.ok) setSections(await secRes.json());
            if (regRes.ok) {
                const regs = await regRes.json();
                setRegulations(regs);

                // Auto-select R22 if not set
                setFormData((prev: any) => {
                    if (!prev.regulationId) {
                        const r22 = regs.find((r: any) => r.name === "R22");
                        return r22 ? { ...prev, regulationId: r22.id } : prev;
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
        // Clear error when user types
        if (status.type === "error") setStatus({ type: null, message: "" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            // Prepare payload - Sanitize to remove Prisma Relations that cause "Unknown argument"
            // We create a new object containing only scalar fields we intend to update.
            // Alternatively, strict allowlist or strict deletelist.
            // Delete list is safer for now.
            const {
                department, section, regulation, subjects, downloads, user,
                // Exclude other relations if any
                ...cleanedData
            } = formData;

            const payload = {
                ...cleanedData,
                reimbursement: formData.reimbursement === "true",
                certificatesSubmitted: formData.certificatesSubmitted === "true",
                regulationId: cleanedData.regulationId || undefined,
                departmentId: cleanedData.departmentId || undefined,
                sectionId: cleanedData.sectionId || undefined,
            };

            const res = await fetch(`/api/students/${student.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Student updated successfully!" });
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to update student" });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "Error updating student. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Filter sections based on selected department
    const filteredSections = formData.departmentId
        ? sections.filter((s: any) => {
            return s.departmentId === formData.departmentId || !s.departmentId;
        })
        : sections;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Student Profile">
            {status.message && (
                <div className={`mx-6 mt-4 mb-0 rounded-md p-3 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}
            <div className="flex flex-col h-[80vh]">
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
                    <TabButton active={activeTab === "basic"} onClick={() => setActiveTab("basic")} label="Basic Info" />
                    <TabButton active={activeTab === "personal"} onClick={() => setActiveTab("personal")} label="Personal" />
                    <TabButton active={activeTab === "admission"} onClick={() => setActiveTab("admission")} label="Admission" />
                    <TabButton active={activeTab === "contact"} onClick={() => setActiveTab("contact")} label="Contact" />
                </div>

                {/* Form Content - Scrollable */}
                <form id="edit-student-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-1">
                    <div className="space-y-4 pb-4">
                        {activeTab === "basic" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Full Name" value={formData.name} onChange={(v) => handleChange("name", v)} required />
                                <Input label="Roll Number" value={formData.rollNumber} onChange={(v) => handleChange("rollNumber", v)} required />
                                <Select label="Year" value={formData.year} onChange={(v) => handleChange("year", v)} options={[1, 2, 3, 4]} />
                                <Select label="Semester" value={formData.semester} onChange={(v) => handleChange("semester", v)} options={[1, 2]} />
                                <Select
                                    label="Department"
                                    value={userRole === "HOD" ? userDeptId : formData.departmentId}
                                    onChange={(v) => handleChange("departmentId", v)}
                                    options={departments.map(d => ({ value: d.id, label: d.name }))}
                                    required
                                    disabled={userRole === "HOD"}
                                />
                                <Select
                                    label="Section"
                                    value={formData.sectionId}
                                    onChange={(v) => handleChange("sectionId", v)}
                                    options={filteredSections.map((s: any) => ({ value: s.id, label: s.name }))}
                                    required
                                />
                                <Select
                                    label="Regulation"
                                    value={formData.regulationId} // Assuming we update by ID
                                    onChange={(v) => handleChange("regulationId", v)}
                                    options={regulations.map((r: any) => ({ value: r.id, label: r.name }))}
                                />
                                <Input label="Hall Ticket" value={formData.hallTicketNumber} onChange={(v) => handleChange("hallTicketNumber", v)} />
                            </div>
                        )}

                        {activeTab === "personal" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Date of Birth" type="date" value={formData.dateOfBirth} onChange={(v) => handleChange("dateOfBirth", v)} />
                                <Select label="Gender" value={formData.gender} onChange={(v) => handleChange("gender", v)} options={["Male", "Female", "Other"]} />
                                <Input label="Father's Name" value={formData.fatherName} onChange={(v) => handleChange("fatherName", v)} />
                                <Input label="Mother's Name" value={formData.motherName} onChange={(v) => handleChange("motherName", v)} />
                                <Input label="Caste" value={formData.caste} onChange={(v) => handleChange("caste", v)} />
                                <Input label="Caste Name" value={formData.casteName} onChange={(v) => handleChange("casteName", v)} />
                                <Input label="Category" value={formData.category} onChange={(v) => handleChange("category", v)} />
                                <Input label="Aadhar Number" value={formData.aadharNumber} onChange={(v) => handleChange("aadharNumber", v)} />
                                <Input label="ABC ID" value={formData.abcId} onChange={(v) => handleChange("abcId", v)} />
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
                                    <textarea
                                        value={formData.address || ""}
                                        onChange={(e) => handleChange("address", e.target.value)}
                                        className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === "admission" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Admission Type" value={formData.admissionType} onChange={(v) => handleChange("admissionType", v)} placeholder="e.g. Convener, Management" />
                                <Input label="EAMCET Rank" value={formData.eamcetRank} onChange={(v) => handleChange("eamcetRank", v)} />
                                <Input label="Date of Reporting" type="date" value={formData.dateOfReporting} onChange={(v) => handleChange("dateOfReporting", v)} />
                                <Select label="Reimbursement" value={formData.reimbursement} onChange={(v) => handleChange("reimbursement", v)} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
                                <Select label="Certificates Submitted" value={formData.certificatesSubmitted} onChange={(v) => handleChange("certificatesSubmitted", v)} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
                            </div>
                        )}

                        {activeTab === "contact" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Student Mobile" value={formData.studentContactNumber} onChange={(v) => handleChange("studentContactNumber", v)} />
                                <Input label="Parent Mobile" value={formData.mobile} onChange={(v) => handleChange("mobile", v)} required />
                                <Input label="Personal Email" type="email" value={formData.emailId} onChange={(v) => handleChange("emailId", v)} />
                                <div className="md:col-span-2">
                                    <Input
                                        label="Domain Mail ID (Auto-generated)"
                                        value={formData.rollNumber ? `${formData.rollNumber.toUpperCase()}@gvpcdpgc.edu.in` : ""}
                                        onChange={() => { }}
                                        disabled={true}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">This is automatically derived from the Roll Number.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-end gap-3 mt-auto bg-white">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">Cancel</button>
                    <button
                        form="edit-student-form"
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm disabled:opacity-50"
                    >
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
        >
            {label}
        </button>
    );
}

interface InputProps {
    label: string;
    value: any;
    onChange: (value: any) => void;
    type?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
}

function Input({ label, value, onChange, type = "text", required = false, disabled = false, placeholder = "" }: InputProps) {
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
            <input
                type={type}
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border disabled:bg-slate-100 disabled:text-slate-500"
                required={required}
            />
        </div>
    );
}

interface SelectProps {
    label: string;
    value: any;
    onChange: (value: any) => void;
    options: (string | number | { value: string | number; label: string })[];
    required?: boolean;
    disabled?: boolean;
}

function Select({ label, value, onChange, options, required = false, disabled = false }: SelectProps) {
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
            <select
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border disabled:bg-slate-100 disabled:text-slate-500"
                required={required}
                disabled={disabled}
            >
                <option value="">Select...</option>
                {options.map((opt) => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const lab = typeof opt === 'object' ? opt.label : opt;
                    return <option key={val} value={val}>{lab}</option>;
                })}
            </select>
        </div>
    );
}
