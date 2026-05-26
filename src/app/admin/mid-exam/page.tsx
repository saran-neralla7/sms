"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSlidersH, FaFilePdf, FaCheckCircle, FaLock, FaUnlock, FaSpinner,
  FaPlus, FaTrash, FaPen, FaClipboardList, FaDownload, FaEye, FaLayerGroup, FaCalendarAlt
} from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";

// jsPDF imports for report generation
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Scheme {
  id: string;
  name: string;
  subjectType: string;
  mid1MaxMarks: number;
  mid2MaxMarks: number;
  mid1ScaledTo: number;
  mid2ScaledTo: number;
  assignmentMax: number;
  internalMax: number;
  isDefault: boolean;
}

interface Paper {
  id: string;
  examType: string;
  totalMarks: number;
  isFrozen: boolean;
  subject: { name: string; code: string; type: string };
  section: { name: string };
  academicYear: { name: string };
  publishRecord: { isLocked: boolean; isPublished: boolean } | null;
}

export default function AdminMidExamDashboard() {
  const { data: session, status } = useSession();

  // Active Admin Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "schemes" | "publish" | "reports">("dashboard");

  // Filters
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedAY, setSelectedAY] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("1");
  const [selectedSem, setSelectedSem] = useState("1");
  const [selectedSection, setSelectedSection] = useState("");

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);

  // Scheme Modal Form
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [schemeForm, setSchemeForm] = useState({
    id: "",
    name: "",
    subjectType: "THEORY",
    mid1MaxMarks: 30,
    mid2MaxMarks: 30,
    mid1ScaledTo: 20,
    mid2ScaledTo: 20,
    assignmentMax: 10,
    internalMax: 30,
    isDefault: false
  });
  const [savingScheme, setSavingScheme] = useState(false);

  // Lock/Publish Actions Loader
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load Filters & initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/academic-years").then(r => r.json()),
      fetch("/api/departments").then(r => r.json()),
      fetch("/api/sections").then(r => r.json()),
      fetch("/api/mid-exam/scheme").then(r => r.json())
    ]).then(([ay, dept, sec, sch]) => {
      setAcademicYears(ay);
      setDepartments(dept);
      setSections(sec);
      setSchemes(sch);

      const currentAY = ay.find((y: any) => y.isCurrent)?.id || ay[0]?.id || "";
      setSelectedAY(currentAY);

      const defaultDept = dept[0]?.id || "";
      setSelectedDept(defaultDept);

      const defaultSec = sec[0]?.id || "";
      setSelectedSection(defaultSec);

      setLoading(false);
    });
  }, []);

  const loadPapers = useCallback(async () => {
    if (!selectedAY) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mid-exam/papers?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}`);
      if (res.ok) {
        setPapers(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAY, selectedDept, selectedYear, selectedSem]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // Lock / Unlock / Publish handler
  const handlePaperAction = async (paperId: string, action: "lock" | "unlock" | "publish") => {
    setActionLoading(prev => ({ ...prev, [paperId]: true }));
    try {
      const res = await fetch("/api/mid-exam/marks/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, action })
      });
      if (res.ok) {
        showToast(`Paper successfully ${action}ed!`, "success");
        await loadPapers();
      } else {
        const data = await res.json();
        showToast(data.error || "Action failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [paperId]: false }));
    }
  };

  // Scheme actions
  const handleSaveScheme = async () => {
    if (!schemeForm.name) { showToast("Name is required", "error"); return; }
    setSavingScheme(true);
    try {
      const isEdit = !!schemeForm.id;
      const url = "/api/mid-exam/scheme";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schemeForm)
      });
      if (res.ok) {
        showToast(isEdit ? "Scheme updated!" : "Scheme created!", "success");
        setShowSchemeModal(false);
        // Reload schemes
        const sch = await fetch("/api/mid-exam/scheme").then(r => r.json());
        setSchemes(sch);
      } else {
        showToast("Failed to save scheme", "error");
      }
    } finally {
      setSavingScheme(false);
    }
  };

  const handleDeleteScheme = async (id: string) => {
    if (!confirm("Are you sure you want to delete this evaluation scheme?")) return;
    try {
      const res = await fetch(`/api/mid-exam/scheme?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Scheme deleted!", "success");
        setSchemes(schemes.filter(s => s.id !== id));
      } else {
        showToast("Failed to delete", "error");
      }
    } catch (e) {
      showToast("Error occurred", "error");
    }
  };

  // Generate strict, high-alignment landscape PDF report
  const generateMemoPDF = async () => {
    if (!selectedSection) {
      showToast("Select a Section to generate reports", "error");
      return;
    }

    try {
      showToast("Generating PDF report...", "success");
      const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}`);
      if (!res.ok) {
        showToast("Failed to fetch report data", "error");
        return;
      }
      const data = await res.json();

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const meta = data.meta;
      const subjects = data.subjects || [];
      const rows = data.rows || [];

      // A4 Landscape is 297mm x 210mm
      // Margins
      const margin = 12;

      // Header Banner
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("GAYATRI VIDYA PARISHAD COLLEGE OF ENGINEERING (AUTONOMOUS)", 148, 18, { align: "center" });
      doc.setFontSize(11);
      doc.text("Madhurawada, Visakhapatnam - 530048", 148, 23, { align: "center" });
      doc.setFontSize(12);
      doc.text("DEPARTMENT OF " + (meta.department || "").toUpperCase(), 148, 29, { align: "center" });

      doc.setFontSize(11);
      doc.text(`INTERNAL ASSESSMENT MEMO - B.TECH ${meta.year} YEAR / ${meta.semester} SEMESTER`, 148, 36, { align: "center" });

      // Class details table
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Academic Year: ${meta.academicYear}`, margin, 44);
      doc.text(`Section: ${meta.section}`, 297 - margin - 40, 44);

      // Build Headers dynamically
      const headers = [["S.No", "Roll Number", "Student Name"]];
      for (const sub of subjects) {
        headers[0].push(`${sub.shortName || sub.code}\nMID I`, `${sub.shortName || sub.code}\nMID II`, `${sub.shortName || sub.code}\nASSIGN`, `${sub.shortName || sub.code}\nTOTAL`);
      }

      // Build Table Data rows
      const tableRows = rows.map((r: any, idx: number) => {
        const rowData = [
          (idx + 1).toString(),
          r.rollNumber,
          r.name
        ];

        for (const sub of subjects) {
          const marks = r.subjects[sub.id] || { mid1: null, mid2: null, assignment: null, internal: 0 };
          rowData.push(
            marks.mid1 !== null ? marks.mid1.toString() : "AB",
            marks.mid2 !== null ? marks.mid2.toString() : "AB",
            marks.assignment !== null ? marks.assignment.toString() : "0",
            marks.internal.toString()
          );
        }

        return rowData;
      });

      // AutoTable styles
      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: 48,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7.5,
          cellPadding: 1.5,
          halign: "center",
          valign: "middle",
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          font: "helvetica",
          textColor: [40, 40, 40]
        },
        headStyles: {
          fillColor: [240, 243, 246],
          textColor: [30, 41, 59],
          fontSize: 7,
          fontStyle: "bold",
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 38, halign: "left" }
        },
        theme: "grid",
        didDrawPage: (data) => {
          // Signature lines at the bottom of the final page
          const finalY = (doc as any).lastAutoTable.finalY || 160;
          const pageHeight = doc.internal.pageSize.height;

          // Check if signatures fit on current page, if not add page
          let sigY = finalY + 16;
          if (sigY > pageHeight - 20) {
            doc.addPage();
            sigY = 30;
          }

          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.line(margin, sigY, margin + 45, sigY);
          doc.text("Signature of Faculty", margin + 22, sigY + 5, { align: "center" });

          doc.line(148 - 22, sigY, 148 + 22, sigY);
          doc.text("HOD / Director", 148, sigY + 5, { align: "center" });

          doc.line(297 - margin - 45, sigY, 297 - margin, sigY);
          doc.text("Principal / Controller", 297 - margin - 22, sigY + 5, { align: "center" });
        }
      });

      doc.save(`Internal_Marks_Memo_${meta.departmentCode}_Sem${selectedSem}_Sec_${meta.section}.pdf`);
      showToast("PDF Memo generated successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("PDF generation failed", "error");
    }
  };

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">

        {/* Top Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Academic Evaluation Control Panel</h1>
            <p className="mt-1 text-slate-500">Configure evaluation schemes, publish exam marks, and print university assessment memos</p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Year</span>
              <select value={selectedAY} onChange={e => setSelectedAY(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dept</span>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Year</span>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["1", "2", "3", "4"].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sem</span>
              <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["1", "2"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="mb-8 flex gap-2 border-b border-slate-200 pb-2">
          {(["dashboard", "schemes", "publish", "reports"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="min-h-[400px]">
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Stat panel */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">Total Question Papers</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">{papers.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">Frozen & Ready</p>
                  <p className="mt-2 text-3xl font-extrabold text-amber-600">{papers.filter(p => p.isFrozen).length}</p>
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">Published to Production</p>
                  <p className="mt-2 text-3xl font-extrabold text-emerald-600">{papers.filter(p => p.publishRecord?.isPublished).length}</p>
                </div>
              </div>

              {/* Recent activity grid */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Class Question Paper Status</h3>
                {papers.length === 0 ? (
                  <p className="text-slate-400 text-sm">No question papers created in the selected semester.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                          <th className="pb-3">Subject</th>
                          <th className="pb-3">Section</th>
                          <th className="pb-3">Exam</th>
                          <th className="pb-3 text-center">Freeze Status</th>
                          <th className="pb-3 text-center">ERP Publish Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {papers.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="py-3 font-semibold text-slate-800">{p.subject.name} <span className="font-mono text-xs font-normal text-slate-400">({p.subject.code})</span></td>
                            <td className="py-3 text-slate-600">Sec {p.section.name}</td>
                            <td className="py-3 text-slate-600 font-medium">{p.examType.replace("_", " ")}</td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.isFrozen ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {p.isFrozen ? "Frozen" : "Draft"}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.publishRecord?.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {p.publishRecord?.isPublished ? "Published" : "Pending"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "schemes" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Configurable Evaluation Schemes</h3>
                  <p className="text-sm text-slate-500">Define theory, practical, or open elective internal marks formulas</p>
                </div>
                <button
                  onClick={() => {
                    setSchemeForm({
                      id: "",
                      name: "",
                      subjectType: "THEORY",
                      mid1MaxMarks: 30,
                      mid2MaxMarks: 30,
                      mid1ScaledTo: 20,
                      mid2ScaledTo: 20,
                      assignmentMax: 10,
                      internalMax: 30,
                      isDefault: false
                    });
                    setShowSchemeModal(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <FaPlus size={12} /> Add Scheme
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {schemes.map(s => (
                  <div key={s.id} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 hover:shadow-md transition-all">
                    {s.isDefault && (
                      <span className="absolute top-4 right-4 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                        Default
                      </span>
                    )}
                    <h4 className="text-lg font-bold text-slate-900">{s.name}</h4>
                    <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5">{s.subjectType}</p>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-400">MID Exams (Max Marks)</p>
                        <p className="font-bold text-slate-700">{s.mid1MaxMarks} marks</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-400">MID Scaling (Scale To)</p>
                        <p className="font-bold text-slate-700">{s.mid1ScaledTo} marks</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-400">Assignment (Max Marks)</p>
                        <p className="font-bold text-slate-700">{s.assignmentMax} marks</p>
                      </div>
                      <div className="rounded-xl bg-blue-50 p-2.5">
                        <p className="text-xs text-blue-400">Final Internal (Max Marks)</p>
                        <p className="font-bold text-blue-700">{s.internalMax} marks</p>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2 border-t border-slate-50 pt-4">
                      <button
                        onClick={() => {
                          setSchemeForm(s);
                          setShowSchemeModal(true);
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <FaPen size={12} />
                      </button>
                      {!s.isDefault && (
                        <button
                          onClick={() => handleDeleteScheme(s.id)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <FaTrash size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "publish" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Bulk Secure Marks Publish Engine</h3>
                <p className="text-sm text-slate-500">Lock faculty updates and push finalised granular assessment totals to production ERP marks matrices</p>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Section</th>
                        <th className="px-6 py-4">Exam Type</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {papers.map(p => {
                        const isLocked = p.publishRecord?.isLocked ?? false;
                        const isPublished = p.publishRecord?.isPublished ?? false;
                        const loading = actionLoading[p.id] || false;

                        return (
                          <tr key={p.id}>
                            <td className="px-6 py-4 font-semibold text-slate-800">{p.subject.name} <span className="font-mono text-xs font-normal text-slate-400">({p.subject.code})</span></td>
                            <td className="px-6 py-4 text-slate-600">Sec {p.section.name}</td>
                            <td className="px-6 py-4 text-slate-600 font-semibold">{p.examType.replace("_", " ")}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                isPublished
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isLocked
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {isPublished ? "Published" : isLocked ? "Locked" : "Open for entries"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {isLocked ? (
                                  <button
                                    onClick={() => handlePaperAction(p.id, "unlock")}
                                    disabled={loading}
                                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <FaUnlock size={10} /> Unlock
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePaperAction(p.id, "lock")}
                                    disabled={loading}
                                    className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                  >
                                    <FaLock size={10} /> Lock
                                  </button>
                                )}

                                {!isPublished && (
                                  <button
                                    onClick={() => handlePaperAction(p.id, "publish")}
                                    disabled={loading || !p.isFrozen}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                    title={!p.isFrozen ? "Paper must be frozen by faculty first" : "Publish to ERP matrices"}
                                  >
                                    {loading ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={10} />}
                                    Publish Marks
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "reports" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Academic & University Print cell Memos</h3>
                <p className="text-sm text-slate-500">Download fully compiled A4 Landscape university-formatted signature-ready internal evaluation sheets</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 max-w-xl space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Target Section *</label>
                  <select
                    value={selectedSection}
                    onChange={e => setSelectedSection(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select section...</option>
                    {sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                  </select>
                </div>

                <button
                  onClick={generateMemoPDF}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  <FaFilePdf /> Download Marks Memo PDF
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scheme Modal */}
      <Modal isOpen={showSchemeModal} onClose={() => setShowSchemeModal(false)} title={schemeForm.id ? "Edit Evaluation Scheme" : "Add Evaluation Scheme"} maxWidth="max-w-md">
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Name *</label>
            <input
              type="text"
              value={schemeForm.name}
              onChange={e => setSchemeForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Theory Scheme, Practical Scheme"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Type</label>
            <select
              value={schemeForm.subjectType}
              onChange={e => setSchemeForm(f => ({ ...f, subjectType: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="THEORY">THEORY</option>
              <option value="LAB">LAB (PRACTICAL)</option>
              <option value="OPEN_ELECTIVE">OPEN ELECTIVE</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">MID Max Marks</label>
              <input
                type="number"
                value={schemeForm.mid1MaxMarks}
                onChange={e => setSchemeForm(f => ({ ...f, mid1MaxMarks: parseFloat(e.target.value) || 0, mid2MaxMarks: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">MID Scaled To</label>
              <input
                type="number"
                value={schemeForm.mid1ScaledTo}
                onChange={e => setSchemeForm(f => ({ ...f, mid1ScaledTo: parseFloat(e.target.value) || 0, mid2ScaledTo: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Assignment Max</label>
              <input
                type="number"
                value={schemeForm.assignmentMax}
                onChange={e => setSchemeForm(f => ({ ...f, assignmentMax: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Final Internal Max</label>
              <input
                type="number"
                value={schemeForm.internalMax}
                onChange={e => setSchemeForm(f => ({ ...f, internalMax: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={schemeForm.isDefault}
              onChange={e => setSchemeForm(f => ({ ...f, isDefault: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-semibold text-slate-700">Set as Default Scheme</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowSchemeModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSaveScheme}
              disabled={savingScheme}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingScheme ? <FaSpinner className="animate-spin" /> : null}
              {savingScheme ? "Saving..." : "Save Scheme"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Popup */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
