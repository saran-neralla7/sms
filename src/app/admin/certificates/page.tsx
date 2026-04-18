"use client";

import { useState, useEffect } from "react";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useSession } from "next-auth/react";
import { FaFileAlt, FaPlus, FaSearch, FaTrash, FaDownload, FaCog } from "react-icons/fa";
import { useRouter } from "next/navigation";

export default function AdminCertificatesPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [certificates, setCertificates] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [certToDelete, setCertToDelete] = useState<any | null>(null);
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const isAdmin = (session?.user as any)?.role === "ADMIN";

    useEffect(() => {
        fetchCertificates();
    }, []);

    const fetchCertificates = async () => {
        try {
            const res = await fetch("/api/certificates");
            if (res.ok) {
                const data = await res.json();
                setCertificates(data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        setStatus({ type: null, message: "" });
        try {
            const res = await fetch("/api/certificates/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                setCertificates(prev => prev.filter(c => c.id !== id));
                setStatus({ type: "success", message: "Certificate deleted successfully." });
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to delete" });
            }
        } catch (error) {
            setStatus({ type: "error", message: "An error occurred while deleting" });
        }
        setIsDeleteModalOpen(false);
        setCertToDelete(null);
    };

    const confirmDelete = (cert: any) => {
        setCertToDelete(cert);
        setIsDeleteModalOpen(true);
    };

    const filteredCerts = certificates.filter(c => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            c.student.name.toLowerCase().includes(query) ||
            c.student.rollNumber.toLowerCase().includes(query) ||
            c.certificateNo.toString().includes(query)
        );
    });

    return (
        <div className="mx-auto max-w-7xl animate-in fade-in">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition-colors">
                        <FaFileAlt size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Certificates (TC)</h1>
                        <p className="text-sm text-slate-500">Manage, generate, and track Transfer Certificates.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button
                            onClick={() => router.push("/admin/certificates/settings")}
                            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <FaCog /> Settings
                        </button>
                    )}
                    <button
                        onClick={() => router.push("/admin/certificates/issue")}
                        className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
                    >
                        <FaPlus /> Issue New TC
                    </button>
                </div>
            </div>

            {status.message && (
                <div className={`mb-4 rounded-md p-4 text-sm font-medium ${status.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {status.message}
                </div>
            )}

            <div className="mb-6">
                <div className="relative w-full max-w-md">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by student name, roll no, or TC number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 placeholder:text-slate-400"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/50">
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Certificate No.</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Student Info</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Issued On</th>
                                <th className="whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCerts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                                        No certificates found.
                                    </td>
                                </tr>
                            ) : (
                                filteredCerts.map((cert) => (
                                    <tr key={cert.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">
                                            TC-{cert.certificateNo}
                                            {cert.isDuplicate && <span className="ml-2 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">DUP</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{cert.student.name}</div>
                                            <div className="text-xs text-slate-500">{cert.student.rollNumber} • {cert.student.department?.name || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(cert.issuedAt).toLocaleDateString()}
                                            <div className="text-xs text-slate-400">by {cert.issuedBy?.username}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <a
                                                    href={`/api/certificates/download?file=${encodeURIComponent(cert.fileUrl?.split('/').pop() || '')}`}
                                                    download
                                                    target="_blank"
                                                    className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <FaDownload size={16} />
                                                </a>
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => confirmDelete(cert)}
                                                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                        title="Delete TC"
                                                    >
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

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => certToDelete && handleDelete(certToDelete.id)}
                title="Delete Certificate"
                message={`Are you sure you want to delete TC-${certToDelete?.certificateNo} for ${certToDelete?.student?.name}? If this is the latest certificate, the counter will revert automatically.`}
                confirmText="Delete Certificate"
                isDangerous={true}
            />
        </div>
    );
}
