"use client";

import { useState } from "react";
import { FaArrowLeft, FaSearch, FaUser, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useRouter } from "next/navigation";
import LogoSpinner from "@/components/LogoSpinner";

export default function IssueCertificatePage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [student, setStudent] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error" | "warning" | null, message: string, url?: string }>({ type: null, message: "" });
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [duplicateNeeded, setDuplicateNeeded] = useState(false);

    // Form fields
    const [formData, setFormData] = useState({
        nationality: "INDIAN",
        religion: "HINDU",
        subcaste_name: "",
        left_date: new Date().toISOString().split("T")[0],
        promotion: "YES",
        reason_remarks: "COURSE COMPLETED",
        father_name: "",
        date_of_birth: "",
        caste_category: "",
        join_date: ""
    });

    const searchStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: null, message: "" });
        
        try {
            // Find student by roll number
            const res = await fetch(`/api/students?q=${searchQuery.toUpperCase()}`);
            if (res.ok) {
                const result = await res.json();
                const students = Array.isArray(result) ? result : (result.data || []);
                const exactMatch = students.find((s: any) => s.rollNumber.toUpperCase() === searchQuery.toUpperCase());
                
                if (exactMatch) {
                    setStudent(exactMatch);
                    setFormData(prev => ({
                        ...prev,
                        nationality: exactMatch.nationality || "INDIAN",
                        religion: exactMatch.religion || "HINDU",
                        subcaste_name: exactMatch.casteName || exactMatch.caste || "",
                        father_name: exactMatch.fatherName || "",
                        date_of_birth: exactMatch.dateOfBirth ? new Date(exactMatch.dateOfBirth).toISOString().split("T")[0] : "",
                        caste_category: exactMatch.category || exactMatch.caste || "",
                        join_date: exactMatch.dateOfReporting ? new Date(exactMatch.dateOfReporting).toISOString().split("T")[0] : ""
                    }));
                } else {
                    setStatus({ type: "error", message: "Student not found with that Roll Number." });
                    setStudent(null);
                }
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error searching for student." });
        } finally {
            setLoading(false);
            setDuplicateNeeded(false);
            setIsDuplicate(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!student) return;

        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            const res = await fetch("/api/certificates/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.id,
                    isDuplicate: isDuplicate || duplicateNeeded,
                    ...formData
                })
            });

            const data = await res.json();

            if (res.ok) {
                setStatus({ 
                    type: "success", 
                    message: `TC-${data.certificateNo} successfully generated!`,
                    url: data.url
                });
            } else {
                if (data.requiresDuplicateApproval) {
                    setStatus({ type: "warning", message: "A Transfer Certificate was already issued for this student. Are you generating a Duplicate?" });
                    setDuplicateNeeded(true);
                } else {
                    setStatus({ type: "error", message: data.error || "Failed to generate certificate." });
                }
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error generating certificate." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl animate-in fade-in">
            <div className="mb-8">
                <button 
                    onClick={() => router.push("/admin/certificates")}
                    className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                    <FaArrowLeft /> Back to Certificates
                </button>
                <h1 className="text-2xl font-bold text-slate-900">Issue Transfer Certificate</h1>
            </div>

            {/* Step 1: Search */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
                <form onSubmit={searchStudent} className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="w-full space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Retrieve Student</label>
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Enter Roll Number..."
                                required
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-10 outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="rounded-lg bg-slate-800 px-6 py-2 font-semibold text-white shadow-sm hover:bg-slate-900 transition-colors disabled:opacity-50">
                        Search
                    </button>
                </form>
            </div>

            {/* Status Notifications */}
            {status.message && (
                <div className={`mb-6 rounded-lg border p-4 flex gap-3 ${
                    status.type === "success" ? "border-green-300 bg-green-50 text-green-800" :
                    status.type === "warning" ? "border-amber-300 bg-amber-50 text-amber-800" :
                    "border-red-300 bg-red-50 text-red-800"
                }`}>
                    {status.type === "success" ? <FaCheckCircle className="mt-1" /> : <FaExclamationTriangle className="mt-1" />}
                    <div className="flex-1">
                        <p className="font-semibold">{status.message}</p>
                        {status.url && (
                            <a href={status.url} download target="_blank" className="mt-2 inline-block rounded-md bg-green-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-green-700">
                                Download Generated PDF
                            </a>
                        )}
                        {duplicateNeeded && !status.url && (
                            <div className="mt-3 flex gap-2">
                                <button onClick={() => { setIsDuplicate(true); setDuplicateNeeded(false); setStatus({type:null, message:""}) }} className="rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700">
                                    Yes, Proceed as Duplicate
                                </button>
                                <button onClick={() => { setDuplicateNeeded(false); setStatus({type:null, message:""}) }} className="rounded bg-slate-300 px-3 py-1 text-xs font-bold text-slate-800 hover:bg-slate-400">
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 2: Fill Out Details */}
            {student && !status.url && !duplicateNeeded && (
                <form onSubmit={handleGenerate} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-12">
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                <FaUser />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">{student.name}</h3>
                                <p className="text-xs font-medium text-slate-500">
                                    {student.rollNumber} • {student.department?.code} • {student.year} Year
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Modifiable Identity Info */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Father's Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.father_name}
                                onChange={(e) => setFormData(prev => ({...prev, father_name: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Date of Birth <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                required
                                value={formData.date_of_birth}
                                onChange={(e) => setFormData(prev => ({...prev, date_of_birth: e.target.value}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Caste Category <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.caste_category}
                                onChange={(e) => setFormData(prev => ({...prev, caste_category: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Join Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                required
                                value={formData.join_date}
                                onChange={(e) => setFormData(prev => ({...prev, join_date: e.target.value}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        {/* Modifiable Demographic Fields */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Nationality <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.nationality}
                                onChange={(e) => setFormData(prev => ({...prev, nationality: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Religion <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.religion}
                                onChange={(e) => setFormData(prev => ({...prev, religion: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Subcaste Name <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                            <input
                                type="text"
                                value={formData.subcaste_name}
                                onChange={(e) => setFormData(prev => ({...prev, subcaste_name: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        {/* Explicit TC Fields */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Date of Leaving <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                required
                                value={formData.left_date}
                                onChange={(e) => setFormData(prev => ({...prev, left_date: e.target.value}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Qualified for Promotion? <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={formData.promotion}
                                onChange={(e) => setFormData(prev => ({...prev, promotion: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-semibold text-slate-700">Reason for leaving / Remarks <span className="text-red-500">*</span></label>
                            <textarea
                                required
                                rows={2}
                                value={formData.reason_remarks}
                                onChange={(e) => setFormData(prev => ({...prev, reason_remarks: e.target.value.toUpperCase()}))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 uppercase"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end">
                        <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-orange-600 px-8 py-2.5 font-bold text-white shadow-md hover:bg-orange-700 transition-colors disabled:opacity-50">
                            {loading && <LogoSpinner fullScreen={false} />}
                            {loading ? "Generating..." : "Generate Final TC"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
