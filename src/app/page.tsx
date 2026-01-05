"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaUserGraduate, FaDownload, FaCheck, FaSearch, FaSave, FaTimes } from "react-icons/fa";
import Modal from "@/components/Modal";

export default function Home() {
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [section, setSection] = useState(""); // Kept for potential future use or verify if unused
  const [sectionId, setSectionId] = useState("");
  // Admin specific
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);

  const [sections, setSections] = useState<any[]>([]);

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"mark_absent" | "mark_present">("mark_absent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveStep, setSaveStep] = useState<"verify" | "success">("verify");
  const [saveStats, setSaveStats] = useState({ present: 0, absent: 0, total: 0 });

  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session?.user.role === "ADMIN") {
      fetchDepartments();
    }
  }, [session]);

  // Derived Department ID (Admin's selection OR HOD's assigned)
  const effectiveDepartmentId = session?.user.role === "ADMIN" ? departmentId : (session?.user as any)?.departmentId;

  // Re-fetch sections whenever the effective department changes
  useEffect(() => {
    if (session) {
      if (session.user.role === "ADMIN" && !departmentId) {
        setSections([]); // Clear sections if no department selected
      } else {
        fetchSections(effectiveDepartmentId);
      }
    }
  }, [effectiveDepartmentId, session]);

  const fetchSections = async (deptId?: string) => {
    let url = "/api/sections";
    if (deptId) {
      url += `?departmentId=${deptId}`;
    }
    const res = await fetch(url);
    if (res.ok) setSections(await res.json());
  };

  const fetchDepartments = async () => {
    const res = await fetch("/api/departments");
    if (res.ok) setDepartments(await res.json());
  };

  useEffect(() => {
    if (session?.user.role === "HOD") {
      router.replace("/attendance/history");
    }
  }, [session, router]);

  // Prevent flash content for HOD (Optional, but better UX)
  if (session?.user.role === "HOD") {
    return null;
  }

  useEffect(() => {
    // Only fetch if required fields are selected
    const isAdmin = session?.user.role === "ADMIN";

    if (year && semester && sectionId) {
      if (isAdmin && !departmentId) {
        return;
      }
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [year, semester, sectionId, departmentId, session]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let url = `/api/students?year=${year}&semester=${semester}&sectionId=${sectionId}`;
      if (departmentId) {
        url += `&departmentId=${departmentId}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const calculateAbsentees = () => {
    if (mode === "mark_absent") {
      return students.filter((s) => selectedIds.has(s.id));
    } else {
      return students.filter((s) => !selectedIds.has(s.id));
    }
  };

  const onSaveClick = () => {
    if (!year || !semester || !sectionId) {
      alert("Please select Year, Semester, and Section first.");
      return;
    }

    // Calculate stats upon clicking save
    let present = 0;
    let absent = 0;

    students.forEach(s => {
      const isSelected = selectedIds.has(s.id);
      let status = "Present";
      if (mode === "mark_absent") {
        status = isSelected ? "Absent" : "Present";
      } else {
        status = isSelected ? "Present" : "Absent";
      }

      if (status === "Present") present++;
      else absent++;
    });

    setSaveStats({ present, absent, total: students.length });
    setSaveStep("verify");
    setIsSaveModalOpen(true);
  };

  const executeSave = async () => {
    const fullData = students.map((s) => {
      const isSelected = selectedIds.has(s.id);
      let status = "Present";
      if (mode === "mark_absent") {
        status = isSelected ? "Absent" : "Present";
      } else {
        status = isSelected ? "Present" : "Absent";
      }
      return {
        "Roll Number": s.rollNumber,
        "Name": s.name,
        "Mobile": s.mobile,
        "Status": status
      };
    });

    const derivedDepartmentId = (session?.user as any).departmentId || departmentId || students[0]?.departmentId || "";
    if (!derivedDepartmentId) {
      alert("Error: Department not found.");
      return;
    }

    try {
      await fetch("/api/attendance/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          semester,
          sectionId,
          departmentId: derivedDepartmentId,
          status: "Saved",
          fileName: "Attendance Report",
          date: new Date().toISOString(),
          details: JSON.stringify(fullData)
        }),
      });
      setSaveStep("success");
    } catch (e) {
      console.error(e);
      alert("Failed to save attendance.");
      setIsSaveModalOpen(false);
    }
  };

  const handleDownloadAbsentees = async () => {
    const absentees = calculateAbsentees();
    const absenteeData = absentees.map((s) => ({
      "Roll Number": s.rollNumber,
      "Name": s.name,
      "Mobile": s.mobile,
      "Status": "Absent"
    }));

    if (absenteeData.length === 0) {
      if (!confirm("No absentees found. Download empty list?")) return;
    }

    const date = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(/[\/\,\s\:]/g, "-").replace(/--/g, "_");

    const sectionName = sections.find(s => s.id === sectionId)?.name || "Unknown";
    const filename = `${date}_${year}_${sectionName}_Absentees.xlsx`;

    const ws = XLSX.utils.json_to_sheet(absenteeData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absentees");
    XLSX.writeFile(wb, filename);
  };

  const handleDownloadFullReport = async () => {
    const fullData = students.map((s) => {
      const isSelected = selectedIds.has(s.id);
      let status = "Present";
      if (mode === "mark_absent") {
        status = isSelected ? "Absent" : "Present";
      } else {
        status = isSelected ? "Present" : "Absent";
      }
      return {
        "Roll Number": s.rollNumber,
        "Name": s.name,
        "Mobile": s.mobile,
        "Status": status
      };
    });

    const date = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(/[\/\,\s\:]/g, "-").replace(/--/g, "_");

    const sectionName = sections.find(s => s.id === sectionId)?.name || "Unknown";
    const filename = `${date}_${year}_${sectionName}_FullReport.xlsx`;

    const ws = XLSX.utils.json_to_sheet(fullData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, filename);
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8">
      {/* Class Selection Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <FaUserGraduate size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Class Selection</h2>
              <p className="text-sm text-slate-500">Choose class details to load student data</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-4">
          {session?.user.role === "ADMIN" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="">Select Department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Academic Year</label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Select Year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Select Semester</option>
              <option value="1">1st Semester</option>
              <option value="2">2nd Semester</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Select Section</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>Section {sec.name}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {students.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Action Bar */}
            <div className="sticky top-20 z-30 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between">
              {/* Mode Toggle */}
              <div className="flex w-full rounded-lg bg-slate-100 p-1 md:w-auto">
                <button
                  onClick={() => { setMode("mark_absent"); setSelectedIds(new Set()); }}
                  className={`flex-1 rounded-md px-6 py-2 text-sm font-semibold transition-all ${mode === "mark_absent"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  Mark Absent
                </button>
                <button
                  onClick={() => { setMode("mark_present"); setSelectedIds(new Set()); }}
                  className={`flex-1 rounded-md px-6 py-2 text-sm font-semibold transition-all ${mode === "mark_present"
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  Mark Present
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full md:w-72">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or roll..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              {/* Save Button (Top) */}
              <button
                onClick={onSaveClick}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-900 hover:shadow-lg active:scale-95"
              >
                <FaSave /> Save
              </button>
            </div>

            <div className="flex items-end justify-between px-1">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Student List</h3>
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900">{filteredStudents.length}</span> students found •
                  <span className={`ml-1 font-bold ${mode === 'mark_absent' ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedIds.size} Marked
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                {/* Save Button (Bottom) */}
                <button
                  onClick={onSaveClick}
                  className="flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-900 hover:shadow-lg active:scale-95"
                >
                  <FaSave /> Save
                </button>
              </div>
            </div>

            {/* Student Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStudents.map((student) => {
                const isSelected = selectedIds.has(student.id);

                // Dynamic styles based on mode and selection
                let cardClasses = "relative cursor-pointer overflow-hidden rounded-xl border p-5 transition-all duration-200 ";
                let activeColor = "";

                if (isSelected) {
                  if (mode === 'mark_absent') {
                    cardClasses += "bg-red-50 border-red-200 shadow-md ring-1 ring-red-500 scale-[1.02] ";
                    activeColor = "text-red-700";
                  } else {
                    cardClasses += "bg-green-50 border-green-200 shadow-md ring-1 ring-green-500 scale-[1.02] ";
                    activeColor = "text-green-700";
                  }
                } else {
                  cardClasses += "bg-white border-slate-200 hover:border-blue-300 hover:shadow-md ";
                }

                return (
                  <motion.div
                    key={student.id}
                    layoutId={student.id}
                    onClick={() => toggleSelection(student.id)}
                    whileTap={{ scale: 0.98 }}
                    className={cardClasses}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className={`text-lg font-bold font-mono ${isSelected ? activeColor : 'text-slate-900'}`}>{student.rollNumber}</h4>
                        <span className={`mt-1 inline-block text-sm font-medium ${isSelected ? 'text-slate-700' : 'text-slate-500'}`}>
                          {student.name}
                        </span>
                      </div>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${isSelected
                        ? (mode === 'mark_absent' ? "border-red-500 bg-red-500 text-white" : "border-green-500 bg-green-500 text-white")
                        : "border-slate-200 bg-slate-50 text-transparent"
                        }`}>
                        <FaCheck size={12} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                      <div className={`h-1.5 w-1.5 rounded-full ${isSelected ? (mode === 'mark_absent' ? "bg-red-400" : "bg-green-400") : "bg-slate-300"}`} />
                      {student.mobile}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {filteredStudents.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-slate-500">
                No students found matching your criteria.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Save Attendance">
        <div className="p-4">
          {saveStep === "verify" ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500 text-xs uppercase font-bold">Class</span>
                    <span className="font-medium text-slate-900">Year {year} - Sem {semester} - Sec {sections.find(s => s.id === sectionId)?.name}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs uppercase font-bold">Total Students</span>
                    <span className="font-medium text-slate-900">{saveStats.total}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs uppercase font-bold">Present</span>
                    <span className="font-bold text-green-600">{saveStats.present}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs uppercase font-bold">Absent</span>
                    <span className="font-bold text-red-600">{saveStats.absent}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
                  Cancel
                </button>
                <button onClick={executeSave} className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Confirm Save
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <FaCheck size={24} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Attendance Saved!</h3>
                <p className="text-sm text-slate-500">The attendance record has been successfully saved.</p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDownloadFullReport}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <FaDownload /> Download Full Report
                </button>
                <button
                  onClick={handleDownloadAbsentees}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700"
                >
                  <FaDownload /> Download Absentees
                </button>
              </div>

              <button onClick={() => setIsSaveModalOpen(false)} className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline">
                Close
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
