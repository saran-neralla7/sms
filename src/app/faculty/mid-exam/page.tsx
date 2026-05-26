"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FaFileAlt, FaPen, FaLock, FaUnlock, FaCheckCircle, FaClipboardList,
  FaChevronRight, FaBook, FaLayerGroup, FaCalendarAlt, FaSpinner,
  FaPlus, FaEye
} from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";

interface Mapping {
  id: string;
  subject: { id: string; name: string; code: string; type: string; year: string; semester: string };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
}

interface Paper {
  id: string;
  examType: string;
  isFrozen: boolean;
  totalMarks: number;
  subjectId: string;
  sectionId: string;
  publishRecord: { isLocked: boolean; isPublished: boolean } | null;
  _count?: { marksEntries: number };
}

export default function FacultyMidExamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; isCurrent: boolean }[]>([]);
  const [selectedAY, setSelectedAY] = useState("");
  const [creating, setCreating] = useState(false);

  // Create paper modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    mappingId: "",
    examType: "MID_I",
    totalMarks: 30,
  });
  const [createError, setCreateError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async (ayId: string) => {
    setLoading(true);
    try {
      const [mappingsRes, papersRes] = await Promise.all([
        fetch(`/api/faculty-mappings?academicYearId=${ayId}`),
        fetch(`/api/mid-exam/papers?academicYearId=${ayId}`)
      ]);
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      if (papersRes.ok) setPapers(await papersRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/academic-years")
      .then(r => r.json())
      .then(data => {
        setAcademicYears(data);
        const current = data.find((y: any) => y.isCurrent);
        const ay = current?.id || data[0]?.id || "";
        setSelectedAY(ay);
        if (ay) loadData(ay);
      });
  }, [loadData]);

  useEffect(() => {
    if (selectedAY) loadData(selectedAY);
  }, [selectedAY, loadData]);

  const getSelectedMapping = () => mappings.find(m => m.id === createForm.mappingId);

  const handleCreatePaper = async () => {
    const mapping = getSelectedMapping();
    if (!mapping) { setCreateError("Select a subject-section mapping."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/mid-exam/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: mapping.academicYear.id,
          departmentId: (session?.user as any).departmentId,
          year: mapping.subject.year,
          semester: mapping.subject.semester,
          sectionId: mapping.section.id,
          subjectId: mapping.subject.id,
          examType: createForm.examType,
          totalMarks: createForm.totalMarks,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.paperId) {
          setShowCreateModal(false);
          router.push(`/faculty/mid-exam/paper/${data.paperId}`);
          return;
        }
        setCreateError(data.error || "Failed to create paper");
        return;
      }
      setShowCreateModal(false);
      showToast("Question paper created!", "success");
      router.push(`/faculty/mid-exam/paper/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const getPaperForMapping = (mapping: Mapping, examType: string) =>
    papers.find(p => p.subjectId === mapping.subject.id && p.sectionId === mapping.section.id && p.examType === examType);

  const role = (session?.user as any)?.role;

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;

  // Group mappings by subject
  const uniqueSubjects = Array.from(new Map(
    mappings.map(m => [m.subject.id + m.section.id, m])
  ).values());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">MID Examination</h1>
            <p className="mt-1 text-slate-500">Build question papers, enter marks, manage assessments</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedAY}
              onChange={e => setSelectedAY(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {academicYears.map(ay => (
                <option key={ay.id} value={ay.id}>{ay.name}{ay.isCurrent ? " ✓" : ""}</option>
              ))}
            </select>
            <button
              onClick={() => { setCreateForm({ mappingId: mappings[0]?.id || "", examType: "MID_I", totalMarks: 30 }); setShowCreateModal(true); }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <FaPlus size={12} /> New Paper
            </button>
          </div>
        </div>

        {/* Quick stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "My Subjects", value: uniqueSubjects.length, icon: <FaBook />, color: "blue" },
            { label: "Papers Created", value: papers.length, icon: <FaFileAlt />, color: "indigo" },
            { label: "Frozen", value: papers.filter(p => p.isFrozen).length, icon: <FaLock />, color: "amber" },
            { label: "Published", value: papers.filter(p => p.publishRecord?.isPublished).length, icon: <FaCheckCircle />, color: "emerald" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
        ) : uniqueSubjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-100">
            <FaBook className="mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-semibold text-slate-600">No subjects assigned</p>
            <p className="text-sm text-slate-400">Contact admin to assign subjects for this academic year</p>
          </div>
        ) : (
          <div className="space-y-4">
            {uniqueSubjects.map((mapping, i) => {
              const mid1Paper = getPaperForMapping(mapping, "MID_I");
              const mid2Paper = getPaperForMapping(mapping, "MID_II");

              return (
                <motion.div
                  key={mapping.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
                >
                  {/* Subject Header */}
                  <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                        <FaBook />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{mapping.subject.name}</h3>
                        <p className="text-sm text-slate-500">
                          {mapping.subject.code} · Year {mapping.subject.year} · Sem {mapping.subject.semester} ·
                          <span className="ml-1 inline-flex items-center gap-1"><FaLayerGroup className="h-3 w-3" /> Section {mapping.section.name}</span>
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        mapping.subject.type?.toUpperCase() === "LAB"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {mapping.subject.type}
                      </span>
                    </div>
                  </div>

                  {/* MID I and MID II Cards */}
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                    {(["MID_I", "MID_II"] as const).map(examType => {
                      const paper = examType === "MID_I" ? mid1Paper : mid2Paper;
                      const label = examType === "MID_I" ? "MID - I" : "MID - II";

                      return (
                        <div
                          key={examType}
                          className={`rounded-xl border-2 p-4 transition-all ${
                            paper
                              ? paper.publishRecord?.isPublished
                                ? "border-emerald-200 bg-emerald-50"
                                : paper.isFrozen
                                ? "border-amber-200 bg-amber-50"
                                : "border-blue-200 bg-blue-50"
                              : "border-dashed border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{label}</span>
                            {paper && (
                              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                paper.publishRecord?.isPublished
                                  ? "bg-emerald-100 text-emerald-700"
                                  : paper.isFrozen
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {paper.publishRecord?.isPublished ? <><FaCheckCircle /> Published</> :
                                 paper.isFrozen ? <><FaLock size={10} /> Frozen</> :
                                 <><FaPen size={10} /> Draft</>}
                              </span>
                            )}
                          </div>

                          {paper ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-600">Max Marks: <strong>{paper.totalMarks}</strong></p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => router.push(`/faculty/mid-exam/paper/${paper.id}`)}
                                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
                                >
                                  <FaPen size={10} /> {paper.isFrozen ? "View Paper" : "Edit Paper"}
                                </button>
                                {paper.isFrozen && (
                                  <button
                                    onClick={() => router.push(`/faculty/mid-exam/marks/${paper.id}`)}
                                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                                  >
                                    <FaClipboardList size={10} /> Enter Marks
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-3">
                              <p className="mb-2 text-xs text-slate-500">No paper created yet</p>
                              <button
                                onClick={() => {
                                  setCreateForm({ mappingId: mapping.id, examType, totalMarks: 30 });
                                  setShowCreateModal(true);
                                }}
                                className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
                              >
                                <FaPlus size={10} /> Create Paper
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Assignment marks link */}
                  <div className="border-t border-slate-100 px-6 py-3">
                    <button
                      onClick={() => router.push(`/faculty/mid-exam/assignment?subjectId=${mapping.subject.id}&sectionId=${mapping.section.id}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&ayId=${selectedAY}`)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <FaClipboardList size={12} /> Assignment Marks
                      <FaChevronRight size={10} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Admin link */}
        {["ADMIN", "HOD", "DIRECTOR"].includes(role) && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => router.push("/admin/mid-exam")}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
            >
              <FaEye /> Admin Control Panel
            </button>
          </div>
        )}
      </div>

      {/* Create Paper Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Question Paper" maxWidth="max-w-md">
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject & Section</label>
            <select
              value={createForm.mappingId}
              onChange={e => setCreateForm(f => ({ ...f, mappingId: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select subject...</option>
              {mappings.map(m => (
                <option key={m.id} value={m.id}>
                  {m.subject.code} - {m.subject.name} (Section {m.section.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam Type</label>
            <div className="flex gap-3">
              {["MID_I", "MID_II"].map(et => (
                <button
                  key={et}
                  onClick={() => setCreateForm(f => ({ ...f, examType: et }))}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    createForm.examType === et
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {et.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
            <input
              type="number"
              value={createForm.totalMarks}
              onChange={e => setCreateForm(f => ({ ...f, totalMarks: Number(e.target.value) }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={1}
              max={100}
            />
          </div>

          {createError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setShowCreateModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleCreatePaper}
              disabled={creating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? <FaSpinner className="animate-spin" /> : <FaPlus />}
              {creating ? "Creating..." : "Create Paper"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
