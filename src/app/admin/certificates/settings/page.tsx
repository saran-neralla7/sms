"use client";

import { useState, useEffect } from "react";
import { FaUpload, FaHashtag, FaArrowLeft, FaFileWord } from "react-icons/fa";
import { useRouter } from "next/navigation";

type CertType = "TC" | "SC";

interface TypeConfig {
    label: string;
    fullLabel: string;
    color: string;
}

const TYPE_CONFIG: Record<CertType, TypeConfig> = {
    TC: { label: "TC", fullLabel: "Transfer Certificate", color: "orange" },
    SC: { label: "SC", fullLabel: "Study Certificate", color: "blue" },
};

export default function CertificatesSettingsPage() {
    const router = useRouter();

    // TC state
    const [tcNumber, setTcNumber] = useState(0);
    const [newTcNumber, setNewTcNumber] = useState("");
    const [tcFile, setTcFile] = useState<File | null>(null);
    const [hasTcTemplate, setHasTcTemplate] = useState(false);

    // SC state
    const [scNumber, setScNumber] = useState(0);
    const [newScNumber, setNewScNumber] = useState("");
    const [scFile, setScFile] = useState<File | null>(null);
    const [hasScTemplate, setHasScTemplate] = useState(false);

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCounter("TC");
        fetchCounter("SC");
        checkTemplate("TC");
        checkTemplate("SC");
    }, []);

    const fetchCounter = async (type: CertType) => {
        const res = await fetch(`/api/certificates/counter?type=${type}`);
        if (res.ok) {
            const data = await res.json();
            if (type === "TC") {
                setTcNumber(data.currentNumber);
                setNewTcNumber(data.currentNumber.toString());
            } else {
                setScNumber(data.currentNumber);
                setNewScNumber(data.currentNumber.toString());
            }
        }
    };

    const checkTemplate = async (type: CertType) => {
        const res = await fetch(`/api/certificates/template?type=${type}`);
        if (res.ok) {
            const data = await res.json();
            if (type === "TC") setHasTcTemplate(data.exists);
            else setHasScTemplate(data.exists);
        }
    };

    const handleUpdateCounter = async (type: CertType) => {
        setStatus({ type: null, message: "" });
        const num = type === "TC" ? newTcNumber : newScNumber;

        try {
            const res = await fetch("/api/certificates/counter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, startingNumber: parseInt(num, 10) })
            });
            if (res.ok) {
                setStatus({ type: "success", message: `${type} counter updated successfully!` });
                fetchCounter(type);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to update counter" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "Network error saving counter." });
        }
    };

    const handleUploadTemplate = async (type: CertType) => {
        const file = type === "TC" ? tcFile : scFile;
        if (!file) return;

        setLoading(true);
        setStatus({ type: null, message: "" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);

        try {
            const res = await fetch("/api/certificates/template", {
                method: "POST",
                body: formData
            });

            if (res.ok) {
                setStatus({ type: "success", message: `${TYPE_CONFIG[type].fullLabel} template uploaded successfully!` });
                if (type === "TC") setTcFile(null);
                else setScFile(null);
                checkTemplate(type);
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

    const renderCounterSection = (type: CertType) => {
        const config = TYPE_CONFIG[type];
        const currentNum = type === "TC" ? tcNumber : scNumber;
        const newNum = type === "TC" ? newTcNumber : newScNumber;
        const setNewNum = type === "TC" ? setNewTcNumber : setNewScNumber;

        return (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${type === "TC" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                        <FaHashtag size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{config.label} Starting Number</h2>
                        <p className="text-xs text-slate-500">Counter for {config.fullLabel}s.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="w-full sm:w-64 space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Latest Issued Number</label>
                        <input
                            type="number"
                            required
                            value={newNum}
                            onChange={(e) => setNewNum(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                        />
                    </div>
                    <button
                        onClick={() => handleUpdateCounter(type)}
                        className={`rounded-lg px-6 py-2 font-semibold text-white shadow-sm transition-colors ${type === "TC" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
                    >
                        Update Counter
                    </button>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                    Current baseline: <strong className="text-slate-700">{currentNum}</strong>. Next {config.label} will be {config.label}-{currentNum + 1}.
                </div>
            </div>
        );
    };

    const renderTemplateSection = (type: CertType) => {
        const config = TYPE_CONFIG[type];
        const hasTemplate = type === "TC" ? hasTcTemplate : hasScTemplate;
        const file = type === "TC" ? tcFile : scFile;
        const setFile = type === "TC" ? setTcFile : setScFile;
        const inputId = `templateFile_${type}`;

        return (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${type === "TC" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                        <FaFileWord size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">{config.fullLabel} Template</h2>
                        <p className="text-xs text-slate-500">Upload a <code>.docx</code> file with {'{{placeholder}}'} variables.</p>
                    </div>
                </div>

                <div className="mb-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${hasTemplate ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {hasTemplate ? "✓ Template Active" : "No Template Uploaded"}
                    </span>
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50 transition-colors">
                        <input
                            type="file"
                            id={inputId}
                            className="hidden"
                            accept=".docx"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor={inputId} className="cursor-pointer flex flex-col items-center justify-center gap-2">
                            <FaUpload className="text-slate-400" size={24} />
                            <span className="text-sm font-medium text-slate-700">
                                {file ? file.name : "Click to select a .docx template file"}
                            </span>
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={() => handleUploadTemplate(type)}
                            disabled={!file || loading}
                            className={`rounded-lg px-6 py-2 font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${type === "TC" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
                        >
                            {loading ? "Uploading..." : "Save Template"}
                        </button>
                    </div>
                </div>
            </div>
        );
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
                <p className="mt-1 text-sm text-slate-500">Configure counters and templates for all certificate types.</p>
            </div>

            {status.message && (
                <div className={`mb-6 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="space-y-6">
                {/* TC Section */}
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span>
                    Transfer Certificate (TC)
                </h2>
                {renderCounterSection("TC")}
                {renderTemplateSection("TC")}

                {/* SC Section */}
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mt-8">
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
                    Study Certificate (SC)
                </h2>
                {renderCounterSection("SC")}
                {renderTemplateSection("SC")}
            </div>
        </div>
    );
}
