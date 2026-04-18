"use client";

import { useState, useEffect } from "react";
import { FaUpload, FaHashtag, FaArrowLeft, FaFileWord } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function CertificatesSettingsPage() {
    const router = useRouter();
    const [currentNumber, setCurrentNumber] = useState(0);
    const [newStartingNumber, setNewStartingNumber] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [hasTemplate, setHasTemplate] = useState(false);
    
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCounter();
        checkTemplate();
    }, []);

    const fetchCounter = async () => {
        const res = await fetch("/api/certificates/counter?type=TC");
        if (res.ok) {
            const data = await res.json();
            setCurrentNumber(data.currentNumber);
            setNewStartingNumber(data.currentNumber.toString());
        }
    };

    const checkTemplate = async () => {
        const res = await fetch("/api/certificates/template");
        if (res.ok) {
            const data = await res.json();
            setHasTemplate(data.exists);
        }
    };

    const handleUpdateCounter = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: "" });
        
        try {
            const res = await fetch("/api/certificates/counter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "TC", startingNumber: parseInt(newStartingNumber, 10) })
            });
            if (res.ok) {
                setStatus({ type: "success", message: "Starting counter updated successfully!" });
                fetchCounter();
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to update counter" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error saving counter." });
        }
    };

    const handleUploadTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setLoading(true);
        setStatus({ type: null, message: "" });

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/certificates/template", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Template uploaded and activated successfully!" });
                setFile(null);
                checkTemplate();
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to upload template" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error uploading file." });
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
                <h1 className="text-2xl font-bold text-slate-900">Certificate Settings</h1>
                <p className="mt-1 text-sm text-slate-500">Configure Transfer Certificate base numbers and template formats.</p>
            </div>

            {status.message && (
                <div className={`mb-6 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="space-y-6">
                {/* Counter Configuration */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <FaHashtag size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Starting Number</h2>
                            <p className="text-xs text-slate-500">The counter from which new TCs will begin incrementing.</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateCounter} className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="w-full sm:w-64 space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Latest Issued Number</label>
                            <input
                                type="number"
                                required
                                value={newStartingNumber}
                                onChange={(e) => setNewStartingNumber(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                            />
                        </div>
                        <button type="submit" className="rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
                            Update Counter
                        </button>
                    </form>
                    <div className="mt-3 text-xs text-slate-400">
                        Current recorded baseline: <strong className="text-slate-700">{currentNumber}</strong>. The next TC generated will be TC-{currentNumber + 1}.
                    </div>
                </div>

                {/* Template Upload */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                            <FaFileWord size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">TC Word Template</h2>
                            <p className="text-xs text-slate-500">Upload a `.docx` file containing variables like {'{{student_name}}'}.</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${hasTemplate ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {hasTemplate ? "✓ Template Currently Active" : "No Template Uploaded"}
                        </span>
                    </div>

                    <form onSubmit={handleUploadTemplate} className="space-y-4">
                        <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50 transition-colors">
                            <input
                                type="file"
                                id="templateFile"
                                className="hidden"
                                accept=".docx"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                            />
                            <label htmlFor="templateFile" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                                <FaUpload className="text-slate-400" size={24} />
                                <span className="text-sm font-medium text-slate-700">
                                    {file ? file.name : "Click to select a .docx template file"}
                                </span>
                            </label>
                        </div>

                        <div className="flex justify-end">
                            <button 
                                type="submit" 
                                disabled={!file || loading}
                                className="rounded-lg bg-orange-600 px-6 py-2 font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? "Uploading..." : "Save Template"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
