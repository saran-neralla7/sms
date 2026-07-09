"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaFolder, FaBuilding, FaUserTie, FaEye, FaArrowLeft, FaCheckCircle, FaSpinner,
  FaClipboardCheck, FaCalendarAlt, FaChartLine
} from "react-icons/fa";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";
import Link from "next/link";
import LogoSpinner from "@/components/LogoSpinner";

export default function AdminCourseFilesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Selector state
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedAY, setSelectedAY] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [year, setYear] = useState("1");
  const [semester, setSemester] = useState("I");
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState("");

  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"booklets" | "attainments">("booklets");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync selected values to URL search parameters
  useEffect(() => {
    if (!isInitialized) return;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams();
      if (selectedAY) params.set("academicYearId", selectedAY);
      if (selectedDept) params.set("departmentId", selectedDept);
      if (year) params.set("year", year);
      if (semester) params.set("semester", semester);
      if (selectedSection) params.set("sectionId", selectedSection);
      params.set("view", viewMode);

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      router.replace(newUrl, { scroll: false } as any);
    }
  }, [selectedAY, selectedDept, year, semester, selectedSection, viewMode, isInitialized, router]);

  // Fetch initial Academic Years and Departments
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/academic-years").then(res => res.json()),
      fetch("/api/departments").then(res => res.json())
    ])
      .then(([years, depts]) => {
        setAcademicYears(years);
        setDepartments(depts);

        const params = new URLSearchParams(window.location.search);
        const paramAY = params.get("academicYearId");
        const paramDept = params.get("departmentId");
        const paramYear = params.get("year");
        const paramSem = params.get("semester");
        const paramView = params.get("view");

        let ayToSet = "";
        if (paramAY && years.some((ay: any) => ay.id === paramAY)) {
          ayToSet = paramAY;
        } else {
          const current = years.find((ay: any) => ay.isCurrent);
          if (current) ayToSet = current.id;
          else if (years.length > 0) ayToSet = years[0].id;
        }
        setSelectedAY(ayToSet);

        let deptToSet = "";
        if (paramDept && depts.some((d: any) => d.id === paramDept)) {
          deptToSet = paramDept;
        } else if (depts.length > 0) {
          deptToSet = depts[0].id;
        }
        setSelectedDept(deptToSet);

        if (paramYear) setYear(paramYear);
        if (paramSem) setSemester(paramSem);
        if (paramView === "attainments") setViewMode("attainments");
        else setViewMode("booklets");

        setLoading(false);

        // If no department is set, we are initialized immediately
        if (!deptToSet) {
          setIsInitialized(true);
        }
      })
      .catch(err => {
        console.error("Error fetching initial selectors:", err);
        showToast("Error loading selectors", "error");
        setLoading(false);
        setIsInitialized(true);
      });
  }, []);

  // Fetch sections when Department changes
  useEffect(() => {
    if (!selectedDept) return;
    fetch(`/api/sections?departmentId=${selectedDept}`)
      .then(res => res.json())
      .then(data => {
        setSections(data);
        
        const params = new URLSearchParams(window.location.search);
        const paramSec = params.get("sectionId");
        if (paramSec && data.some((s: any) => s.id === paramSec)) {
          setSelectedSection(paramSec);
        } else if (data.length > 0) {
          setSelectedSection(data[0].id);
        } else {
          setSelectedSection("");
        }
        
        // Sections are fetched and state set, we are now initialized!
        setIsInitialized(true);
      })
      .catch(err => {
        console.error("Error fetching sections:", err);
        showToast("Failed to load sections", "error");
        setIsInitialized(true);
      });
  }, [selectedDept]);

  // Fetch course files status overview for selected section
  const fetchOverview = () => {
    if (!selectedAY || !selectedDept || !year || !semester || !selectedSection) {
      showToast("Please select all filters to fetch details.", "error");
      return;
    }

    setFetching(true);
    fetch(
      `/api/course-files/admin?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`
    )
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSubjectsList(data.subjects || []);
        setFetching(false);
      })
      .catch(err => {
        console.error("Error loading monitor list:", err);
        showToast(err.message || "Failed to load subjects status", "error");
        setFetching(false);
      });
  };

  // Auto fetch when details change
  useEffect(() => {
    if (selectedAY && selectedDept && year && semester && selectedSection) {
      fetchOverview();
    } else {
      setSubjectsList([]);
    }
  }, [selectedAY, selectedDept, year, semester, selectedSection]);

  if (status === "loading" || loading) {
    return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-white ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
            >
              <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
              <span className="font-medium text-sm">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back navigation header */}
        <div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <FaArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Course Files &amp; Attainments</h1>
              <p className="text-xs text-slate-500 mt-1">HOD &amp; Admin Course Booklets &amp; Attainments Submission Control Panel</p>
            </div>
          </div>
          {selectedAY && selectedDept && year && semester && selectedSection && (
            <Link
              href={`/admin/course-files/rollup?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <FaChartLine className="h-4 w-4" />
              View Batch Rollup &amp; Gap Analysis
              <FaArrowUpRightFromSquare className="h-3 w-3 opacity-80" />
            </Link>
          )}
        </div>

        {/* Filter Selection Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8 grid grid-cols-1 md:grid-cols-5 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Year</label>
            <select
              value={selectedAY}
              onChange={(e) => setSelectedAY(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Select AY --</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Select Dept --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Year & Sem</label>
            <div className="flex gap-2">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="1">1st Yr</option>
                <option value="2">2nd Yr</option>
                <option value="3">3rd Yr</option>
                <option value="4">4th Yr</option>
              </select>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="I">I Sem</option>
                <option value="II">II Sem</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              disabled={sections.length === 0}
            >
              {sections.length === 0 ? (
                <option value="">No sections found</option>
              ) : (
                sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchOverview}
              disabled={fetching}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-60 flex justify-center items-center gap-2"
            >
              {fetching ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaClipboardCheck className="h-4 w-4" />}
              Fetch Status
            </button>
          </div>
        </div>

        {/* Subjects Progression Status grid */}
        {fetching ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 shadow-sm flex flex-col justify-center items-center gap-4 text-center">
            <FaSpinner className="h-8 w-8 text-teal-600 animate-spin" />
            <p className="text-slate-500 text-sm font-semibold">Loading subjects and course file compilation status...</p>
          </div>
        ) : subjectsList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm text-center text-slate-500 font-semibold">
            No subject mapping found or course status data to display. Please adjust selectors or check mappings.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* View Mode Switcher Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5">
              <button
                onClick={() => setViewMode("booklets")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                  viewMode === "booklets"
                    ? "bg-white text-teal-700 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/40"
                }`}
              >
                <FaFolder className={`h-4 w-4 ${viewMode === 'booklets' ? 'text-teal-500' : 'text-slate-400'}`} />
                Course Booklets Submission ({subjectsList.length})
              </button>
              <button
                onClick={() => setViewMode("attainments")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl transition-all ${
                  viewMode === "attainments"
                    ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/40"
                }`}
              >
                <FaChartLine className={`h-4 w-4 ${viewMode === 'attainments' ? 'text-indigo-500' : 'text-slate-400'}`} />
                Subject CO-PO Attainments ({subjectsList.length})
              </button>
            </div>

            {viewMode === "booklets" ? (
              <table className="min-w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="p-4 w-16 text-center">S.No</th>
                    <th className="p-4">Subject details</th>
                    <th className="p-4">Assigned Faculty</th>
                    <th className="p-4 w-60">Booklet completion</th>
                    <th className="p-4 w-36 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {subjectsList.map((sub, idx) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-center text-slate-500 font-bold">{idx + 1}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-slate-800 text-sm uppercase">{sub.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{sub.code}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {sub.faculty ? (
                          <div className="flex items-center gap-2 text-slate-800">
                            <FaUserTie className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-bold">{sub.faculty.name}</p>
                              <p className="text-xxs text-slate-400 font-medium">{sub.faculty.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-red-500 font-semibold text-xs bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
                            Not Assigned
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                            <span className={sub.percentage === 100 ? "text-emerald-600" : "text-teal-600"}>
                              {sub.completedCount} / {sub.totalCount} items
                            </span>
                            <span className="text-slate-500">{sub.percentage}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${sub.percentage === 100 ? "bg-gradient-to-r from-emerald-500 to-green-500" : "bg-gradient-to-r from-teal-500 to-blue-500"}`}
                              style={{ width: `${sub.percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                          <Link
                            href={`/faculty/course-files/print?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}&subjectId=${sub.id}&threshold=40`}
                            target="_blank"
                            className="inline-flex justify-center items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors shadow-sm"
                          >
                            <FaEye className="h-3.5 w-3.5 text-slate-400" /> Booklet
                          </Link>
                          <Link
                            href={`/admin/course-files/subject-attainment?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}&subjectId=${sub.id}`}
                            className="inline-flex justify-center items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors shadow-sm"
                          >
                            <FaChartLine className="h-3.5 w-3.5 text-indigo-500" /> Attainment
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="p-4 w-16 text-center">S.No</th>
                    <th className="p-4">Subject details</th>
                    <th className="p-4">Assigned Faculty</th>
                    <th className="p-4 text-center w-56">University Results</th>
                    <th className="p-4 w-40 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {subjectsList.map((sub, idx) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-center text-slate-500 font-bold">{idx + 1}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-slate-800 text-sm uppercase">{sub.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{sub.code}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {sub.faculty ? (
                          <div className="flex items-center gap-2 text-slate-800">
                            <FaUserTie className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-bold">{sub.faculty.name}</p>
                              <p className="text-xxs text-slate-400 font-medium">{sub.faculty.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-red-500 font-semibold text-xs bg-red-50 border border-red-100 rounded-lg px-2.5 py-1">
                            Not Assigned
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {sub.externalResultsAvailable ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 text-xs font-bold shadow-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50/70 border border-amber-100/70 rounded-full px-3 py-1 text-xs font-bold">
                            Not Available
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <Link
                          href={`/admin/course-files/subject-attainment?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}&subjectId=${sub.id}`}
                          className="inline-flex justify-center items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 text-xs font-bold text-indigo-700 transition-colors shadow-sm"
                        >
                          <FaChartLine className="h-3.5 w-3.5 text-indigo-500" /> View Attainment
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
