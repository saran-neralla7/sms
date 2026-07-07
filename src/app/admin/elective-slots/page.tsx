"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaTrash, FaPlus, FaCloudUploadAlt, FaFileDownload, FaSpinner, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";

export default function ElectiveSlotsPage() {
    const { data: session } = useSession();
    const [slots, setSlots] = useState<any[]>([]);
    const [newSlotName, setNewSlotName] = useState("");
    const [loading, setLoading] = useState(false);

    // Upload state variables
    const [uploading, setUploading] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadResult, setUploadResult] = useState<any | null>(null);

    useEffect(() => {
        fetchSlots();
    }, []);

    const fetchSlots = async () => {
        try {
            const res = await fetch("/api/elective-slots");
            if (res.ok) setSlots(await res.json());
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/elective-slots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newSlotName })
            });

            if (res.ok) {
                setNewSlotName("");
                fetchSlots();
            } else {
                alert("Failed to create slot");
            }
        } catch (error) {
            alert("Error creating slot");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete slot "${name}"?`)) return;
        try {
            const res = await fetch(`/api/elective-slots/${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchSlots();
            } else {
                const data = await res.json();
                alert(data.error || "Failed to delete");
            }
        } catch (error) {
            alert("Error deleting slot");
        }
    };

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!uploadFile) return;

        setUploading(true);
        setUploadResult(null);

        const formData = new FormData();
        formData.append("file", uploadFile);

        try {
            const res = await fetch("/api/elective-slots/upload", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setUploadResult({
                    success: true,
                    message: data.message || "File uploaded successfully",
                    report: data.report
                });
                fetchSlots(); // Slots/subjects might have been updated/created
            } else {
                setUploadResult({
                    success: false,
                    message: data.error || "Failed to upload file"
                });
            }
        } catch (error) {
            setUploadResult({
                success: false,
                message: "Error connecting to upload API"
            });
        } finally {
            setUploading(false);
        }
    };

    if (!session || (session.user as any).role !== "ADMIN") {
        return <div className="p-8 text-center text-red-500">Unauthorized</div>;
    }

    return (
        <div className="mx-auto max-w-6xl p-6">
            <h1 className="mb-6 text-3xl font-bold text-slate-900">Manage Elective Slots</h1>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 mb-8">
                {/* Manual Add Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <FaPlus className="text-blue-500" /> Add Slot Manually
                    </h2>
                    <form onSubmit={handleCreate} className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Slot Name (e.g., PE-1, OE-1)"
                            value={newSlotName}
                            onChange={(e) => setNewSlotName(e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            required
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                            {loading ? <FaSpinner className="animate-spin" /> : "Add"}
                        </button>
                    </form>
                </div>

                {/* Excel Import Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                            <FaCloudUploadAlt className="text-emerald-500" /> Bulk Import Selections
                        </h2>
                        <a
                            href="/api/elective-slots/template"
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md transition"
                        >
                            <FaFileDownload /> Get Template
                        </a>
                    </div>
                    <form onSubmit={handleFileUpload} className="space-y-4">
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                className="flex-1 text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                                required
                            />
                            <button
                                type="submit"
                                disabled={uploading || !uploadFile}
                                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                                {uploading ? <FaSpinner className="animate-spin" /> : "Upload"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Upload Result / Report Area */}
            {uploadResult && (
                <div className={`mb-8 p-6 rounded-xl border ${uploadResult.success ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        {uploadResult.success ? (
                            <FaCheckCircle className="text-2xl text-emerald-600" />
                        ) : (
                            <FaExclamationTriangle className="text-2xl text-red-600" />
                        )}
                        <h3 className="text-lg font-bold text-slate-800">{uploadResult.message}</h3>
                    </div>
                    {uploadResult.report && (
                        <div className="mt-4 text-sm text-slate-700 space-y-1">
                            <p>Total processed rows: <span className="font-semibold">{uploadResult.report.totalRowsProcessed}</span></p>
                            <p className="text-emerald-700">Successfully mapped: <span className="font-semibold">{uploadResult.report.successCount}</span></p>
                            {uploadResult.report.errors.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-red-700 font-semibold mb-1 flex items-center gap-1">
                                        <FaExclamationTriangle /> Errors encountered ({uploadResult.report.errors.length}):
                                    </p>
                                    <div className="max-h-40 overflow-y-auto bg-white border border-red-100 rounded-lg p-3 space-y-1 font-mono text-xs text-red-600 shadow-inner">
                                        {uploadResult.report.errors.map((err: string, index: number) => (
                                            <p key={index}>{err}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* List */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700 font-semibold uppercase">
                        <tr>
                            <th className="px-6 py-3">Slot Name</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {slots.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="px-6 py-8 text-center text-slate-500">No slots found. Add one above.</td>
                            </tr>
                        ) : (
                            slots.map((slot) => (
                                <tr key={slot.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{slot.name}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDelete(slot.id, slot.name)}
                                            className="rounded p-2 text-red-500 hover:bg-red-50 transition"
                                            title="Delete"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

