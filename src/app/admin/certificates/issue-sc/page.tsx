"use client";

import { useState } from "react";
import { FaArrowLeft, FaSearch, FaUser, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";
import LogoSpinner from "@/components/LogoSpinner";

export default function IssueStudyCertificatePage() {
    const router = useRouter();
    const pathname = usePathname();
    const basePath = pathname?.startsWith("/office") ? "/office" : "/admin";
    const [searchQuery, setSearchQuery] = useState("");
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error" | "warning" | null, message: string, url?: string }>({ type: null, message: "" });

    // Form fields
    const [formData, setFormData] = useState({
        academic_year: "2025-2026",
        purpose: "",
        father_name: "",
        date_of_birth: "",
        batch_year: "",
    });

    const searchStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: null, message: "" });
        
        try {
            const res = await fetch(`/api/students?q=${searchQuery.toUpperCase()}`);
            if (res.ok) {
                const result = await res.json();
                const students = Array.isArray(result) ? result : (result.data || []);
                const exactMatch = students.find((s: any) => s.rollNumber.toUpperCase() === searchQuery.toUpperCase());
                
                if (exactMatch) {
                    setStudent(exactMatch);
                    setFormData(prev => ({
                        ...prev,
                        father_name: exactMatch.fatherName || "",
                        date_of_birth: exactMatch.dateOfBirth ? new Date(exactMatch.dateOfBirth).toISOString().split("T")[0] : "",
                        batch_year: exactMatch.batch?.name || exactMatch.batchString || "",
                    }));
                } else {
                    setStatus({ type: "error", message: "No student found with that roll number." });
                }
            }
        } catch (error) {
            setStatus({ type: "error", message: "Error searching for student." });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!student) return;
        setGenerating(true);
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch("/api/certificates/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.id,
                    certificateType: "SC",
                    father_name: formData.father_name,
                    date_of_birth: formData.date_of_birth,
                    academic_year: formData.academic_year,
                    purpose: formData.purpose,
                    batch_year: formData.batch_year,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setStatus({ type: "success", message: `SC-${data.certificateNo} successfully generated!`, url: data.url });
                setStudent(null);
            } else {
                setStatus({ type: "error", message: data.error || "Failed to generate certificate" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error generating certificate." });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl animate-in fade-in">
            <button 
                onClick={() => router.push(`${basePath}/certificates`)}
                className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
                <FaArrowLeft /> Back to Certificates
            </button>

            <h1 className="text-2xl font-bold text-slate-900 mb-6">Issue Study cum Conduct Certificate</h1>

            {/* Search */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Retrieve Student</h2>
                <form onSubmit={searchStudent} className="flex gap-3">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Enter Roll Number"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading || !searchQuery}
                        className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                        {loading ? "..." : "Search"}
                    </button>
                </form>
            </div>

            {/* Status Messages */}
            {status.message && (
                <div className={`mb-6 rounded-lg p-4 text-sm font-medium flex items-start gap-3 ${
                    status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
                    status.type === "warning" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                    "bg-red-50 text-red-700 border border-red-200"
                }`}>
                    {status.type === "success" ? <FaCheckCircle className="mt-0.5 shrink-0" /> : <FaExclamationTriangle className="mt-0.5 shrink-0" />}
                    <div>
                        {status.message}
                        {status.url && (
                            <div className="mt-2">
                                <a href={status.url} target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
                                    Download Generated PDF
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Student Info + Form */}
            {student && (
                <>
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                <FaUser />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900">{student.name}</div>
                                <div className="text-xs text-slate-500">{student.rollNumber} • {student.department?.name || "N/A"} • {student.year || ""} Year</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-orange-600 mb-1">Father&apos;s Name <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.father_name} onChange={(e) => setFormData(f => ({ ...f, father_name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-600 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                                <input type="date" value={formData.date_of_birth} onChange={(e) => setFormData(f => ({ ...f, date_of_birth: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-600 mb-1">Academic Year <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.academic_year} onChange={(e) => setFormData(f => ({ ...f, academic_year: e.target.value }))}
                                    placeholder="e.g., 2024-2025"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-600 mb-1">Purpose <span className="text-slate-400 text-xs">(Optional)</span></label>
                                <input type="text" value={formData.purpose} onChange={(e) => setFormData(f => ({ ...f, purpose: e.target.value }))}
                                    placeholder="e.g., For Bank Loan, Scholarship"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-600 mb-1">Batch Year <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.batch_year} onChange={(e) => setFormData(f => ({ ...f, batch_year: e.target.value }))}
                                    placeholder="e.g., 2025-2029"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" />
                            </div>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => { setStudent(null); setStatus({ type: null, message: "" }); }}
                            className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={generating || !formData.father_name || !formData.date_of_birth || !formData.academic_year || !formData.batch_year}
                            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {generating ? <LogoSpinner /> : null}
                            {generating ? "Generating..." : "Generate Study cum Conduct Certificate"}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
