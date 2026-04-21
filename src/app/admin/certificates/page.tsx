"use client";

import { useState, useEffect } from "react";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useSession } from "next-auth/react";
import { FaFileAlt, FaPlus, FaSearch, FaTrash, FaDownload, FaCog, FaGraduationCap } from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";

type CertTab = "TC" | "SC";

export default function AdminCertificatesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session } = useSession();
    const basePath = pathname?.startsWith("/office") ? "/office" : "/admin";
    const [activeTab, setActiveTab] = useState<CertTab>("TC");
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

    // Filter by active tab AND search query
    const filteredCerts = certificates.filter(c => {
        if (c.certificateType !== activeTab) return false;
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            c.student.name.toLowerCase().includes(query) ||
            c.student.rollNumber.toLowerCase().includes(query) ||
            c.certificateNo.toString().includes(query)
        );
    });

    const tabConfig = {
        TC: {
            label: "Transfer Certificate",
            shortLabel: "TC",
            icon: <FaFileAlt size={18} />,
            issueRoute: `${basePath}/certificates/issue`,
            issueLabel: "Issue New TC",
            prefix: "TC",
            description: "Manage, generate, and track Transfer Certificates.",
            color: "orange"
        },
        SC: {
            label: "Study Certificate",
            shortLabel: "SC",
            icon: <FaGraduationCap size={18} />,
            issueRoute: `${basePath}/certificates/issue-sc`,
            issueLabel: "Issue New SC",
            prefix: "SC",
            description: "Manage, generate, and track Study Certificates.",
            color: "blue"
        }
    };

    const tab = tabConfig[activeTab];

    return (
        <div className="mx-auto max-w-7xl animate-in fade-in">
            {/* Tab Switcher */}
            <div className="mb-6 flex border-b border-slate-200">
                {(["TC", "SC"] as CertTab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => { setActiveTab(t); setSearchQuery(""); }}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === t
                                ? `border-${tabConfig[t].color}-600 text-${tabConfig[t].color}-600`
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                        style={activeTab === t ? { 
                            borderBottomColor: t === "TC" ? "#ea580c" : "#2563eb",
                            color: t === "TC" ? "#ea580c" : "#2563eb"
                        } : {}}
                    >
                        {tabConfig[t].icon}
                        {tabConfig[t].label}
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            activeTab === t 
                                ? (t === "TC" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700")
                                : "bg-slate-100 text-slate-500"
                        }`}>
                            {certificates.filter(c => c.certificateType === t).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${activeTab === "TC" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
                        {tab.icon}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Certificates ({tab.shortLabel})</h1>
                        <p className="text-sm text-slate-500">{tab.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <button
                            onClick={() => router.push(`${basePath}/certificates/settings`)}
                            className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                            <FaCog /> Settings
                        </button>
                    )}
                    <button
                        onClick={() => router.push(tab.issueRoute)}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors ${activeTab === "TC" ? "bg-orange-600 hover:bg-orange-700" : "bg-blue-600 hover:bg-blue-700"}`}
                    >
                        <FaPlus /> {tab.issueLabel}
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
                        placeholder={`Search by student name, roll no, or ${tab.shortLabel} number...`}
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
                                        No {tab.label.toLowerCase()}s found.
                                    </td>
                                </tr>
                            ) : (
                                filteredCerts.map((cert) => (
                                    <tr key={cert.id} className="group hover:bg-slate-50/80 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">
                                            {tab.prefix}-{cert.certificateNo}
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
                                                        title={`Delete ${tab.shortLabel}`}
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
                message={`Are you sure you want to delete ${tab.prefix}-${certToDelete?.certificateNo} for ${certToDelete?.student?.name}?`}
                confirmText="Delete Certificate"
                isDangerous={true}
            />
        </div>
    );
}
