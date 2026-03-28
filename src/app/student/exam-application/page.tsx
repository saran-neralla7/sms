// Rewrite of the Exam Application UI for multi-semester backlogs
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaTimesCircle, FaClock, FaDownload, FaExclamationTriangle, FaFileAlt, FaBan, FaChevronDown, FaChevronUp } from "react-icons/fa";
import jsPDF from "jspdf";

interface SemesterData {
    year: string;
    semester: string;
    subjects: any[];
    selectedSubjects: string[];
    utrNumber: string;
    amountPaid: string;
    paymentDate: string;
    isDuplicateUtr: boolean;
    error?: string;
}

export default function ExamApplicationPage() {
    const { data: session } = useSession();
    const [student, setStudent] = useState<any>(null);
    const [activeSemesters, setActiveSemesters] = useState<SemesterData[]>([]);
    const [expandedSemester, setExpandedSemester] = useState<string | null>(null);

    const [editModalAppId, setEditModalAppId] = useState<string | null>(null);
    const [editReason, setEditReason] = useState("");

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingApps, setExistingApps] = useState<any[]>([]);
    const [globalError, setGlobalError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!session) return;
        Promise.all([
            fetch("/api/students/me").then(r => r.ok ? r.json() : null),
            fetch("/api/exam-applications").then(r => r.ok ? r.json() : []),
            fetch("/api/exam-applications/settings").then(r => r.ok ? r.json() : [])
        ]).then(async ([studentData, apps, settings]) => {
            if (studentData) {
                setStudent(studentData);
                setExistingApps(apps);

                // Helper to convert year/sem to an absolute number for comparison
                const getSemNumber = (y: string, s: string) => parseInt(y) * 2 + parseInt(s);
                const currentSemNum = getSemNumber(studentData.year, studentData.semester);
                const now = new Date();

                // Filter active settings that are for the current or past semesters, and within date range
                const validSettings = (settings as any[]).filter(s => {
                    const settingSemNum = getSemNumber(s.year, s.semester);
                    return s.isActive && settingSemNum <= currentSemNum && now >= new Date(s.startDate) && now <= new Date(s.endDate);
                });

                // For each valid setting, fetch its subjects and construct the form state
                const semestersData: SemesterData[] = [];
                for (const s of validSettings) {
                    // Skip if the student already applied for this exact semester
                    if (apps.some((a: any) => a.year === s.year && a.semester === s.semester)) continue;

                    const res = await fetch(`/api/subjects?departmentId=${studentData.departmentId}&year=${s.year}&semester=${s.semester}`);
                    const subs = await res.ok ? await res.json() : [];

                    semestersData.push({
                        year: s.year,
                        semester: s.semester,
                        subjects: subs,
                        selectedSubjects: [],
                        utrNumber: "",
                        amountPaid: "",
                        paymentDate: "",
                        isDuplicateUtr: false,
                    });
                }

                // Sort by most recent first
                semestersData.sort((a, b) => getSemNumber(b.year, b.semester) - getSemNumber(a.year, a.semester));
                setActiveSemesters(semestersData);
                if (semestersData.length > 0) {
                    setExpandedSemester(`${semestersData[0].year}-${semestersData[0].semester}`);
                }
            }
            setLoading(false);
        });
    }, [session]);

    const checkUtr = async (idx: number, utr: string) => {
        if (!utr) return;
        const res = await fetch("/api/exam-applications/check-utr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ utrNumber: utr })
        });
        const data = await res.json();
        setActiveSemesters(prev => {
            const next = [...prev];
            next[idx].isDuplicateUtr = data.duplicate;
            return next;
        });
    };

    const handleSubjectToggle = (semIdx: number, subjectId: string) => {
        setActiveSemesters(prev => {
            const next = [...prev];
            const sem = next[semIdx];
            if (sem.selectedSubjects.includes(subjectId)) {
                sem.selectedSubjects = sem.selectedSubjects.filter(id => id !== subjectId);
            } else {
                sem.selectedSubjects = [...sem.selectedSubjects, subjectId];
            }
            return next;
        });
    };

    const updateSemesterField = (semIdx: number, field: "utrNumber" | "amountPaid" | "paymentDate", value: string) => {
        setActiveSemesters(prev => {
            const next = [...prev];
            if (field === "amountPaid") {
                next[semIdx][field] = value.replace(/[^0-9]/g, ""); // Digits only
            } else {
                next[semIdx][field] = value;
            }
            return next;
        });
    };

    const handleEditRequest = async (appId: string, reason: string) => {
        try {
            const res = await fetch(`/api/exam-applications/${appId}/edit-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason })
            });
            if (res.ok) {
                const data = await res.json();
                setExistingApps(prev => prev.map(a => a.id === appId ? data.application : a));
                alert("Edit request submitted successfully. Please wait for office approval.");
            } else {
                const data = await res.json();
                alert(data.error || "Failed to request edit");
            }
        } catch (err) {
            alert("Something went wrong");
        }
    };

    const generatePDF = async (submittedApps: any[]) => {
        if (!submittedApps || submittedApps.length === 0) return;
        
        try {
            const getImageType = (base64: string) => {
                if (base64.startsWith("data:image/png")) return "PNG";
                if (base64.startsWith("data:image/webp")) return "WEBP";
                return "JPEG";
            };

            let logoBase64: string | null = null;
            try {
                const res = await fetch("/logo.png");
                const blob = await res.blob();
                logoBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch(e) { console.error("Could not load logo", e); }
            
            let photoBase64: string | null = null;
            if (student?.photoUrl) {
                try {
                    const res = await fetch(student.photoUrl);
                    const blob = await res.blob();
                    photoBase64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } catch(e) { console.error("Could not load photo", e); }
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Applications per semester
            submittedApps.forEach((app, idx) => {
                if (idx > 0) doc.addPage();
                
                let y = 15;
                
                // Header
                if (logoBase64) {
                   try { doc.addImage(logoBase64, getImageType(logoBase64), 15, y, 22, 22); } catch(e) { console.warn("Failed to add logo to PDF"); }
                }
                
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(A)", 42, y + 6, { align: "left" });
                doc.setFontSize(12);
                doc.text("ENGINEERING AND TECHNOLOGY PROGRAM", 42, y + 13, { align: "left" });
                doc.text("RUSHIKONDA, VISAKHAPATNAM", 42, y + 20, { align: "left" });
                
                y += 30;
                doc.setDrawColor(200);
                doc.line(15, y, pageWidth - 15, y);
                y += 10;
                
                doc.setFontSize(14);
                doc.text("Exam Application Form", pageWidth / 2, y, { align: "center" });
                y += 15;

                // Student Info
                doc.setFontSize(11);
                
                // Photo placement
                if (photoBase64) {
                    try { doc.addImage(photoBase64, getImageType(photoBase64), pageWidth - 45, y, 30, 40); } catch(e) { console.warn("Failed to add photo to PDF"); }
                } else {
                    doc.rect(pageWidth - 45, y, 30, 40);
                    doc.setFontSize(8);
                    doc.text("Affix Photo", pageWidth - 30, y + 20, { align: "center" });
                    doc.setFontSize(11);
                }

            const addRow = (label: string, value: string) => {
                doc.setFont("helvetica", "bold");
                doc.text(label + ":", 15, y);
                doc.setFont("helvetica", "normal");
                doc.text(value, 50, y);
                y += 8;
            };

            addRow("Name", student?.name || app.rollNumber);
            addRow("Roll Number", app.rollNumber);
            addRow("Department", app.department);
            addRow("Date", new Date().toLocaleDateString("en-IN"));
            addRow("Year", app.year);
            addRow("Semester", app.semester);
            
            y = Math.max(y + 10, y - (8 * 6) + 40 + 10); // ensure we clear photo height
            
            doc.line(15, y, pageWidth - 15, y);
            y += 10;

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Payment Details", 15, y);
            y += 8;
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`UTR Number: ${app.utrNumber}`, 20, y);
            y += 6;
            doc.text(`Amount Paid: ₹${app.amountPaid || "0"}`, 20, y);
            y += 6;
            doc.text(`Payment Date: ${app.paymentDate ? new Date(app.paymentDate).toLocaleDateString("en-IN") : "—"}`, 20, y);
            y += 12;

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("Subjects Applied:", 15, y);
            y += 8;
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            (app.subjects || []).forEach((s: any) => {
                const name = s.subject?.name || s.subjectId;
                const code = s.subject?.code || "";
                doc.text(`• ${code} - ${name}`, 20, y);
                y += 6;
            });

            // Signatures at the bottom
            const pageHeight = doc.internal.pageSize.getHeight();
            y = pageHeight - 30; // 30 units from bottom
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("Signature of student", 15, y);
            doc.text("Signature of Mentor", pageWidth / 2, y, { align: "center" });
            doc.text("Signature of HOD", pageWidth - 15, y, { align: "right" });
        });

            const app1 = submittedApps[0];
            doc.save(`exam_receipt_${app1.rollNumber}.pdf`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("Failed to generate PDF. Please try again.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setGlobalError("");

        // Gather all semesters where the student has selected at least one subject
        const activeSubmissions = activeSemesters.filter(sem => sem.selectedSubjects.length > 0);

        if (activeSubmissions.length === 0) {
            setGlobalError("Please select at least one subject from any semester to apply.");
            return;
        }

        // Validate selected semesters have UTR and Amount
        let isValid = true;
        const newSemesters = [...activeSemesters];
        activeSubmissions.forEach(sub => {
            const idx = activeSemesters.findIndex(s => s.year === sub.year && s.semester === sub.semester);
            if (!sub.utrNumber.trim() || !sub.amountPaid.trim() || !sub.paymentDate.trim()) {
                newSemesters[idx].error = "UTR Number, Amount Paid, and Payment Date are required for this semester.";
                setExpandedSemester(`${sub.year}-${sub.semester}`);
                isValid = false;
            } else {
                newSemesters[idx].error = undefined;
            }
        });

        if (!isValid) {
            setActiveSemesters(newSemesters);
            return;
        }

        setSubmitting(true);

        const payload = activeSubmissions.map(sem => ({
            year: sem.year,
            semester: sem.semester,
            subjectIds: sem.selectedSubjects,
            utrNumber: sem.utrNumber.trim(),
            amountPaid: sem.amountPaid.trim(),
            paymentDate: sem.paymentDate
        }));

        const formData = new FormData();
        formData.append("applications", JSON.stringify(payload));

        try {
            const res = await fetch("/api/exam-applications", { method: "POST", body: formData });
            if (!res.ok) {
                const data = await res.json();
                setGlobalError(data.error || "Submission failed");
                setSubmitting(false);
                return;
            }
            const data = await res.json(); // This is an array of created applications
            
            // Remove submitted semesters from active list
            const submittedKeys = payload.map(p => `${p.year}-${p.semester}`);
            const remaining = activeSemesters.filter(sem => !submittedKeys.includes(`${sem.year}-${sem.semester}`));
            setActiveSemesters(remaining);
            if (remaining.length > 0) setExpandedSemester(`${remaining[0].year}-${remaining[0].semester}`);
            
            setExistingApps(prev => [...data, ...prev]);
            setSuccess(true);
            generatePDF(data);
        } catch (err) {
            setGlobalError("Something went wrong");
        }
        setSubmitting(false);
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent"></div></div>;
    }

    return (
        <div className="mx-auto max-w-3xl">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="mb-6 text-2xl font-extrabold text-slate-900">Exam Application</h1>

                {/* Submitted Applications History */}
                {existingApps.length > 0 && (
                    <div className="mb-8">
                        <h2 className="mb-4 text-lg font-bold text-slate-800">Your Applications</h2>
                        <div className="space-y-4">
                            {existingApps.map((app, i) => (
                                <div key={app.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <div className={`px-5 py-3 flex justify-between items-center ${app.status === "APPROVED" ? "bg-green-50 border-b border-green-100" : app.status === "REJECTED" ? "bg-red-50 border-b border-red-100" : "bg-yellow-50 border-b border-yellow-100"}`}>
                                        <div className="flex items-center gap-2">
                                            {app.status === "APPROVED" && <FaCheckCircle className="text-green-600" size={16} />}
                                            {app.status === "REJECTED" && <FaTimesCircle className="text-red-600" size={16} />}
                                            {app.status === "PENDING" && <FaClock className="text-yellow-600" size={16} />}
                                            <span className="font-bold text-slate-800 text-sm">Year {app.year} - Sem {app.semester}</span>
                                            {app.editRequested && (
                                                <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">Edit Requested</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs font-semibold text-slate-600">{app.status}</span>
                                            {!app.editRequested && (
                                                <button type="button" onClick={() => {
                                                    setEditReason("");
                                                    setEditModalAppId(app.id);
                                                }} className="text-xs text-slate-400 hover:text-slate-800 underline">Request Edit</button>
                                            )}
                                            <button type="button" onClick={() => generatePDF([app])} className="text-red-600 hover:text-red-800" title="Download Receipt"><FaDownload /></button>
                                        </div>
                                    </div>
                                    <div className="p-4 text-sm grid sm:grid-cols-2 gap-4">
                                        <div><span className="text-slate-500 block text-xs">UTR Number</span><span className="font-medium text-slate-800">{app.utrNumber}</span></div>
                                        <div><span className="text-slate-500 block text-xs">Amount</span><span className="font-medium text-slate-800">₹{app.amountPaid || 0}</span></div>
                                        <div><span className="text-slate-500 block text-xs">Payment Date</span><span className="font-medium text-slate-800">{app.paymentDate ? new Date(app.paymentDate).toLocaleDateString("en-IN") : "—"}</span></div>
                                        <div className="sm:col-span-2">
                                            <span className="text-slate-500 block text-xs mb-1">Subjects</span>
                                            <div className="flex flex-wrap gap-1">
                                                {(app.subjects || []).map((s: any) => (
                                                    <span key={s.id} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">{s.subject?.code}</span>
                                                ))}
                                            </div>
                                        </div>
                                        {app.remarks && (
                                            <div className="sm:col-span-2 rounded bg-red-50 p-2 text-xs text-red-700 border border-red-100">
                                                <strong>Remarks:</strong> {app.remarks}
                                            </div>
                                        )}
                                        {app.editRequested && app.editRequestReason && (
                                            <div className="sm:col-span-2 rounded bg-orange-50 p-2 text-xs text-orange-700 border border-orange-100">
                                                <strong>Edit Reason:</strong> {app.editRequestReason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* New Application Form */}
                {activeSemesters.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm block">
                        <FaBan className="mx-auto mb-4 text-slate-400" size={40} />
                        <p className="text-lg font-semibold text-slate-700">No active applications</p>
                        <p className="mt-2 text-sm text-slate-500">There are no open exam application windows for your eligible semesters.</p>
                    </div>
                ) : (
                    <div>
                        <h2 className="mb-4 text-lg font-bold text-slate-800 flex items-center justify-between">
                            New Application
                            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{activeSemesters.length} Semesters Available</span>
                        </h2>

                        {success && (
                            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                                <p className="font-semibold">Applications submitted successfully!</p>
                                <p className="text-sm">Your consolidated receipt has been downloaded.</p>
                            </div>
                        )}

                        {globalError && (
                            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
                                {globalError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {activeSemesters.map((sem, idx) => {
                                const semKey = `${sem.year}-${sem.semester}`;
                                const isExpanded = expandedSemester === semKey;
                                const isSelected = sem.selectedSubjects.length > 0;

                                return (
                                    <div key={semKey} className={`rounded-2xl border transition-colors overflow-hidden ${isSelected ? 'border-red-300 bg-white shadow-sm' : 'border-slate-200 bg-slate-50'}`}>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedSemester(isExpanded ? null : semKey)}
                                            className="w-full flex items-center justify-between p-5 text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                    {sem.year}-{sem.semester}
                                                </div>
                                                <div>
                                                    <h3 className={`font-bold ${isSelected ? 'text-red-900' : 'text-slate-700'}`}>
                                                        {sem.year === student.year && sem.semester === student.semester ? "Current Semester" : "Backlog Semester"}
                                                    </h3>
                                                    <p className="text-xs text-slate-500">{sem.selectedSubjects.length} subjects selected</p>
                                                </div>
                                            </div>
                                            <div className="text-slate-400">
                                                {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                            </div>
                                        </button>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-white border-t border-slate-100">
                                                    <div className="p-5 space-y-6">
                                                        
                                                        {/* Error specific to this semester */}
                                                        {sem.error && (
                                                            <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
                                                                {sem.error}
                                                            </div>
                                                        )}

                                                        {/* Subject Selection */}
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-800 mb-3">Select Subjects</h4>
                                                            {sem.subjects.length === 0 ? (
                                                                <p className="text-xs text-slate-500 italic">No subjects configured for this semester.</p>
                                                            ) : (
                                                                <div className="grid sm:grid-cols-2 gap-2">
                                                                    {sem.subjects.map(sub => (
                                                                        <label key={sub.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50 has-[:checked]:border-red-200 has-[:checked]:bg-red-50">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={sem.selectedSubjects.includes(sub.id)}
                                                                                onChange={() => handleSubjectToggle(idx, sub.id)}
                                                                                className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                                                                            />
                                                                            <div className="flex-1">
                                                                                <p className="text-sm font-medium text-slate-800 leading-tight mb-1">{sub.name}</p>
                                                                                <p className="text-xs text-slate-500">{sub.code}</p>
                                                                            </div>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Payment Details (Only show if at least 1 subject is selected) */}
                                                        {isSelected && (
                                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                                                                <h4 className="text-sm font-semibold text-slate-800">Payment Details for {sem.year}-{sem.semester}</h4>
                                                                <div className="grid sm:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <label className="text-xs font-medium text-slate-600 mb-1 block">UTR Number <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            value={sem.utrNumber}
                                                                            onChange={e => updateSemesterField(idx, "utrNumber", e.target.value)}
                                                                            onBlur={() => checkUtr(idx, sem.utrNumber)}
                                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                                                            placeholder="Transaction ID"
                                                                        />
                                                                        {sem.isDuplicateUtr && (
                                                                            <p className="mt-1 text-[10px] text-yellow-600 font-semibold flex items-center gap-1">
                                                                                <FaExclamationTriangle /> Warning: Duplicate UTR
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Amount Paid (₹) <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="text"
                                                                            inputMode="numeric"
                                                                            value={sem.amountPaid}
                                                                            onChange={e => updateSemesterField(idx, "amountPaid", e.target.value)}
                                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                                                            placeholder="e.g. 1400"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Payment Date <span className="text-red-500">*</span></label>
                                                                        <input
                                                                            type="date"
                                                                            max={new Date().toISOString().split("T")[0]}
                                                                            value={sem.paymentDate}
                                                                            onChange={e => updateSemesterField(idx, "paymentDate", e.target.value)}
                                                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}

                            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                                <div className="text-sm text-slate-600 bg-amber-50 border border-amber-200 p-3 rounded-xl flex-1 w-full">
                                    <strong className="text-amber-800">Note:</strong> Please submit a printed copy of the transaction screenshot for each semester in the office.
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full sm:w-auto flex-shrink-0 cursor-pointer rounded-xl bg-red-600 px-8 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-50"
                                >
                                    {submitting ? "Submitting..." : `Submit Application(s)`}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Edit Request Modal */}
                <AnimatePresence>
                    {editModalAppId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditModalAppId(null)} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                                <h3 className="mb-2 text-lg font-bold text-slate-900">Request Edit</h3>
                                <p className="mb-4 text-sm text-slate-500">Please provide a reason for editing this application.</p>
                                <textarea
                                    value={editReason}
                                    onChange={e => setEditReason(e.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                    placeholder="e.g., I selected the wrong elective subject..."
                                />
                                <div className="mt-6 flex justify-end gap-3">
                                    <button onClick={() => setEditModalAppId(null)} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (editReason.trim()) {
                                                handleEditRequest(editModalAppId, editReason);
                                                setEditModalAppId(null);
                                                setEditReason("");
                                            }
                                        }} 
                                        disabled={!editReason.trim()}
                                        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
