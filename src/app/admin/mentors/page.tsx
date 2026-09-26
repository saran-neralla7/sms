"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaUserTie,
  FaArrowLeft,
  FaCheckCircle,
  FaUserGraduate,
  FaSearch,
  FaSync,
  FaTrash,
  FaLayerGroup,
  FaRandom,
  FaFilter,
  FaTimes
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

interface FacultyMember {
  id: string;
  empCode: string;
  empName: string;
  designation: string;
  department: { id: string; name: string; code: string };
  _count: { mentees: number };
}

interface StudentItem {
  id: string;
  rollNumber: string;
  name: string;
  year: string;
  semester: string;
  department: { id: string; name: string; code: string };
  section: { id: string; name: string };
  mentor?: { id: string; empName: string; empCode: string; designation: string } | null;
}

export default function AdminMentorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);

  // Filters
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");
  const [selectedSem, setSelectedSem] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Allocation forms
  const [allocationMode, setAllocationMode] = useState<"RANGE" | "SELECTION" | "AUTO">("RANGE");
  const [targetMentorId, setTargetMentorId] = useState("");
  const [fromRoll, setFromRoll] = useState("");
  const [toRoll, setToRoll] = useState("");
  const [autoMentorIds, setAutoMentorIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const user = session?.user as any;
  const isAllowed = user?.role === "ADMIN" || user?.role === "DIRECTOR" || user?.role === "PRINCIPAL" || user?.role === "HOD";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && !isAllowed) {
      router.push("/dashboard");
    }
  }, [status, isAllowed, router]);

  useEffect(() => {
    if (isAllowed) {
      fetchMeta();
    }
  }, [isAllowed]);

  useEffect(() => {
    if (isAllowed) {
      fetchStudents();
    }
  }, [isAllowed, selectedDept, selectedYear, selectedSem, selectedSection, filterType]);

  const fetchMeta = async () => {
    try {
      const [deptRes, secRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/sections")
      ]);
      const depts = await deptRes.json();
      const secs = await secRes.json();
      if (Array.isArray(depts)) setDepartments(depts);
      if (Array.isArray(secs)) setSections(secs);
    } catch (err) {
      console.error("Failed to load meta:", err);
    }
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDept !== "ALL") params.set("departmentId", selectedDept);
      if (selectedYear !== "ALL") params.set("year", selectedYear);
      if (selectedSem !== "ALL") params.set("semester", selectedSem);
      if (selectedSection !== "ALL") params.set("sectionId", selectedSection);
      if (filterType !== "ALL") params.set("filter", filterType);

      const res = await fetch(`/api/admin/mentors?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setStudents(json.students || []);
        setFacultyList(json.facultyList || []);
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAssignRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMentorId || !fromRoll.trim() || !toRoll.trim()) {
      setActionMessage({ type: "error", text: "Please select a mentor and enter both From and To roll numbers." });
      return;
    }

    try {
      setSubmitting(true);
      setActionMessage(null);
      const res = await fetch("/api/admin/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "RANGE",
          mentorId: targetMentorId,
          fromRoll,
          toRoll,
          departmentId: selectedDept,
          sectionId: selectedSection,
          year: selectedYear
        })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: json.message });
        setFromRoll("");
        setToRoll("");
        fetchStudents();
      } else {
        setActionMessage({ type: "error", text: json.error || "Failed to assign mentors" });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "An error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSelected = async () => {
    if (!targetMentorId || selectedStudentIds.length === 0) {
      setActionMessage({ type: "error", text: "Please select a mentor and at least one student." });
      return;
    }

    try {
      setSubmitting(true);
      setActionMessage(null);
      const res = await fetch("/api/admin/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "SELECTION",
          mentorId: targetMentorId,
          studentIds: selectedStudentIds
        })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: json.message });
        setSelectedStudentIds([]);
        fetchStudents();
      } else {
        setActionMessage({ type: "error", text: json.error || "Failed to assign mentors" });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "An error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (autoMentorIds.length === 0 || selectedStudentIds.length === 0) {
      setActionMessage({ type: "error", text: "Please select at least one mentor and students to distribute." });
      return;
    }

    try {
      setSubmitting(true);
      setActionMessage(null);
      const res = await fetch("/api/admin/mentors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "AUTO_DISTRIBUTE",
          mentorIds: autoMentorIds,
          studentIds: selectedStudentIds
        })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: json.message });
        setSelectedStudentIds([]);
        setAutoMentorIds([]);
        fetchStudents();
      } else {
        setActionMessage({ type: "error", text: json.error || "Failed to auto-distribute" });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "An error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to unassign mentor from ${ids.length} student(s)?`)) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/mentors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: ids })
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: json.message });
        setSelectedStudentIds(prev => prev.filter(x => !ids.includes(x)));
        fetchStudents();
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading && students.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  // Filtered students by search
  const filteredStudents = students.filter(st => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const rollMatch = st.rollNumber.toLowerCase().includes(q);
      const nameMatch = st.name.toLowerCase().includes(q);
      const mentorMatch = (st.mentor?.empName || "").toLowerCase().includes(q);
      return rollMatch || nameMatch || mentorMatch;
    }
    return true;
  });

  const totalAssigned = students.filter(s => Boolean(s.mentor)).length;
  const totalUnassigned = students.length - totalAssigned;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title="Back to Admin Dashboard"
              >
                <FaArrowLeft size={14} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                    Mentor-Mentee Allocation Desk
                  </h1>
                  <span className="rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    Proctoring Control
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign faculty mentors to students by roll number range, selection, or equal distribution.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchStudents}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
              >
                <FaSync className={loading ? "animate-spin text-indigo-600" : ""} /> Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Filtered Students</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{students.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Assigned to Mentors</span>
            <p className="text-2xl font-black text-emerald-800 mt-1">{totalAssigned}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Unassigned</span>
            <p className="text-2xl font-black text-amber-800 mt-1">{totalUnassigned}</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {/* Department */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Semester</label>
              <select
                value={selectedSem}
                onChange={(e) => setSelectedSem(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Semesters</option>
                <option value="1">1st Semester</option>
                <option value="2">2nd Semester</option>
              </select>
            </div>

            {/* Section */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Allocation Status</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All Students</option>
                <option value="UNASSIGNED">Unassigned Only</option>
                <option value="ASSIGNED">Assigned Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            className={`rounded-xl p-3 text-xs flex items-center justify-between border ${
              actionMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">
              <FaTimes />
            </button>
          </div>
        )}

        {/* Allocation Action Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">
                <FaUserTie />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Allocation Tools</h3>
                <p className="text-[11px] text-slate-500">Choose an allocation method below to assign mentees</p>
              </div>
            </div>

            {/* Tabs for Mode */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setAllocationMode("RANGE")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  allocationMode === "RANGE" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                }`}
              >
                Range Allocation
              </button>
              <button
                onClick={() => setAllocationMode("SELECTION")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  allocationMode === "SELECTION" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                }`}
              >
                Selected ({selectedStudentIds.length})
              </button>
              <button
                onClick={() => setAllocationMode("AUTO")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  allocationMode === "AUTO" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-600"
                }`}
              >
                Auto-Distribute
              </button>
            </div>
          </div>

          {/* MODE 1: RANGE ALLOCATION */}
          {allocationMode === "RANGE" && (
            <form onSubmit={handleAssignRange} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Select Mentor Faculty</label>
                <select
                  value={targetMentorId}
                  onChange={(e) => setTargetMentorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">-- Choose Faculty --</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.empName} ({f.designation} - {f._count.mentees} mentees)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">From Roll Number</label>
                <input
                  type="text"
                  value={fromRoll}
                  onChange={(e) => setFromRoll(e.target.value)}
                  placeholder="e.g. 22B91A0501"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">To Roll Number</label>
                <input
                  type="text"
                  value={toRoll}
                  onChange={(e) => setToRoll(e.target.value)}
                  placeholder="e.g. 22B91A0520"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-mono outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 py-2 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-2xs"
                >
                  {submitting ? "Assigning..." : "Assign Range"}
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: SELECTION ALLOCATION */}
          {allocationMode === "SELECTION" && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <select
                  value={targetMentorId}
                  onChange={(e) => setTargetMentorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Target Mentor Faculty --</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.empName} ({f.designation} - {f._count.mentees} mentees)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAssignSelected}
                  disabled={submitting || selectedStudentIds.length === 0 || !targetMentorId}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-2xs"
                >
                  {submitting ? "Assigning..." : `Assign (${selectedStudentIds.length}) Selected`}
                </button>

                {selectedStudentIds.length > 0 && (
                  <button
                    onClick={() => handleUnassign(selectedStudentIds)}
                    disabled={submitting}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                  >
                    Unassign Selected
                  </button>
                )}
              </div>
            </div>
          )}

          {/* MODE 3: AUTO DISTRIBUTE */}
          {allocationMode === "AUTO" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Select one or more faculty mentors to equally divide the <span className="font-bold">{selectedStudentIds.length} selected students</span> among them.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                {facultyList.map((f) => {
                  const isChecked = autoMentorIds.includes(f.id);
                  return (
                    <label key={f.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setAutoMentorIds(prev =>
                            isChecked ? prev.filter(x => x !== f.id) : [...prev, f.id]
                          )
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">{f.empName}</span>
                    </label>
                  );
                })}
              </div>

              <button
                onClick={handleAutoDistribute}
                disabled={submitting || selectedStudentIds.length === 0 || autoMentorIds.length === 0}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-2xs flex items-center gap-1.5"
              >
                <FaRandom size={11} />
                <span>Distribute Evenly ({selectedStudentIds.length} students &rarr; {autoMentorIds.length} mentors)</span>
              </button>
            </div>
          )}
        </div>

        {/* Student Table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Students List ({filteredStudents.length})
              </span>
              {selectedStudentIds.length > 0 && (
                <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5">
                  {selectedStudentIds.length} selected
                </span>
              )}
            </div>

            <div className="relative max-w-xs w-full">
              <FaSearch className="absolute left-3 top-2.5 text-slate-400 text-xs" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roll no, name, mentor..."
                className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Assigned Mentor</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                      No students found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => {
                    const isSelected = selectedStudentIds.includes(st.id);
                    return (
                      <tr key={st.id} className={`hover:bg-slate-50/80 transition ${isSelected ? "bg-indigo-50/20" : ""}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStudent(st.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{st.rollNumber}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{st.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {st.department.code} &bull; {st.year}th Yr &bull; Sec {st.section.name}
                        </td>
                        <td className="px-4 py-3">
                          {st.mentor ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                              <FaCheckCircle className="text-emerald-600 text-[10px]" />
                              {st.mentor.empName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {st.mentor && (
                            <button
                              onClick={() => handleUnassign([st.id])}
                              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition"
                              title="Unassign mentor"
                            >
                              Unassign
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
