"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSave, FaCheck, FaSearch } from "react-icons/fa";

export default function ElectivesPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [departments, setDepartments] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);

    // Filters
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());

    const [enrolledStudentIds, setEnrolledStudentIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    // Tabs & Cross-Departmental Enrollments
    const [activeTab, setActiveTab] = useState<"enroll" | "view">("enroll");
    const [crossEnrolledStudents, setCrossEnrolledStudents] = useState<any[]>([]);
    const [crossSearch, setCrossSearch] = useState("");
    const [studentBatches, setStudentBatches] = useState<Record<string, string>>({});
    const [savingBatches, setSavingBatches] = useState(false);

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (departmentId && year && semester) {
            fetchSubjects();
            fetchSections();
        } else {
            setSubjects([]);
            setSections([]);
        }
    }, [departmentId, year, semester]);

    // Load enrolled students when subject/sections change
    useEffect(() => {
        if (subjectId && selectedSectionIds.size > 0) {
            fetchStudentsAndEnrollment();
        } else {
            setStudents([]);
        }
    }, [subjectId, selectedSectionIds]);

    // Load cross-departmental enrolled students when subject changes
    useEffect(() => {
        fetchCrossEnrolledStudents();
        setActiveTab("enroll");
    }, [subjectId]);

    const fetchCrossEnrolledStudents = async () => {
        if (!subjectId) {
            setCrossEnrolledStudents([]);
            setStudentBatches({});
            return;
        }
        try {
            const res = await fetch(`/api/students?subjectId=${subjectId}&limit=-1`);
            if (res.ok) {
                const json = await res.json();
                setCrossEnrolledStudents(json.data || json || []);
            }

            // Fetch batches
            const batchRes = await fetch(`/api/admin/electives/batches?subjectId=${subjectId}`);
            if (batchRes.ok) {
                const batchesJson = await batchRes.json();
                setStudentBatches(batchesJson);
            } else {
                setStudentBatches({});
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveBatches = async () => {
        if (!subjectId) return;
        setSavingBatches(true);
        try {
            const res = await fetch("/api/admin/electives/batches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subjectId,
                    studentBatches
                })
            });
            if (res.ok) {
                alert("Batch assignments saved successfully!");
            } else {
                alert("Failed to save batch assignments.");
            }
        } catch (error) {
            console.error(error);
            alert("Error saving batch assignments.");
        } finally {
            setSavingBatches(false);
        }
    };

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) {
            const json = await res.json();
            setDepartments(Array.isArray(json) ? json : (json.data || []));
        }
    };

    const fetchSubjects = async () => {
        const res = await fetch(`/api/subjects?departmentId=${departmentId}&year=${year}&semester=${semester}&limit=-1`);
        if (res.ok) {
            const json = await res.json();
            const allSubjects = Array.isArray(json) ? json : (json.data || []);
            // Filter all ELECTIVE types
            setSubjects(allSubjects.filter((s: any) =>
                ["ELECTIVE", "PROFESSIONAL_ELECTIVE", "OPEN_ELECTIVE"].includes(s.type)
            ));
        }
    };

    const fetchSections = async () => {
        const res = await fetch(`/api/sections?departmentId=${departmentId}&limit=-1`);
        if (res.ok) {
            const json = await res.json();
            setSections(Array.isArray(json) ? json : (json.data || []));
        }
    };

    const fetchStudentsAndEnrollment = async () => {
        setLoading(true);
        try {
            const sectionIdsStr = Array.from(selectedSectionIds).join(",");
            // Fetch All Students in sections
            const studentsRes = await fetch(`/api/students?departmentId=${departmentId}&year=${year}&semester=${semester}&sectionIds=${sectionIdsStr}&includeSubjects=true&limit=-1`);

            if (studentsRes.ok) {
                const resJson = await studentsRes.json();
                const studentsData = Array.isArray(resJson) ? resJson : (resJson.data || []);
                setStudents(studentsData);

                // Determine who is already enrolled in THIS subject
                const enrolled = new Set<string>();
                studentsData.forEach((s: any) => {
                    const isEnrolled = s.subjects?.some((sub: any) => sub.id === subjectId);
                    if (isEnrolled) enrolled.add(s.id);
                });
                setEnrolledStudentIds(enrolled);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!subjectId) return;
        try {
            const res = await fetch("/api/students/enroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subjectId,
                    studentIds: Array.from(enrolledStudentIds),
                    // We need to know which students were potentially removed, 
                    // simpler approach: The API should "set" the list, replacing old enrollment for this subject,
                    // BUT only for the students we are currently viewing/managing? 
                    // Actually standard way: Simple "Sync" or "Add/Remove".
                    // Let's send ALL ids meant to be enrolled. The server will handle updating relations.
                    // Ideally we should limited scope to the students fetched.
                    allFetchedStudentIds: students.map(s => s.id)
                })
            });

            if (res.ok) {
                alert("Enrollment updated successfully!");
                fetchCrossEnrolledStudents();
            } else {
                alert("Failed to update enrollment.");
            }
        } catch (error) {
            console.error(error);
            alert("Error saving enrollment.");
        }
    };

    const handleUnenrollCross = async (studentId: string) => {
        if (!confirm("Are you sure you want to unenroll this student from this elective?")) return;
        try {
            const res = await fetch("/api/students/enroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    subjectId,
                    studentIds: [],
                    allFetchedStudentIds: [studentId]
                })
            });

            if (res.ok) {
                alert("Student unenrolled successfully!");
                fetchCrossEnrolledStudents();
                // If the student's section is currently loaded in the enrollment tab, update local set
                const newEnrolled = new Set(enrolledStudentIds);
                newEnrolled.delete(studentId);
                setEnrolledStudentIds(newEnrolled);
            } else {
                alert("Failed to unenroll student.");
            }
        } catch (error) {
            console.error(error);
            alert("Error unenrolling student.");
        }
    };

    const toggleEnrollment = (studentId: string) => {
        const newSet = new Set(enrolledStudentIds);
        if (newSet.has(studentId)) {
            newSet.delete(studentId);
        } else {
            newSet.add(studentId);
        }
        setEnrolledStudentIds(newSet);
    };

    const [showEnrolledOnly, setShowEnrolledOnly] = useState(false);

    // ... (fetch logic)

    const handleSelectAll = () => {
        // Only select from the CURRENTLY filtered view (to avoid selecting hidden students if safe)
        // Or select ALL visible? 
        // Best UX: Select all displayed students.
        const newSet = new Set(enrolledStudentIds);
        filteredStudents.forEach(s => newSet.add(s.id));
        setEnrolledStudentIds(newSet);
    };

    const handleClearAll = () => {
        if (!confirm("Are you sure you want to clear/delete the list of enrolled students?")) return;
        setEnrolledStudentIds(new Set());
    };

    const filteredStudents = students.filter(s => {
        const name = s.name || "";
        const roll = s.rollNumber || "";
        const searchTerm = search.toLowerCase();
        const matchesSearch = name.toLowerCase().includes(searchTerm) ||
            roll.toLowerCase().includes(searchTerm);
        const matchesEnrollment = showEnrolledOnly ? enrolledStudentIds.has(s.id) : true;
        return matchesSearch && matchesEnrollment;
    });

    const filteredCrossStudents = crossEnrolledStudents.filter(s => {
        const name = s.name || "";
        const roll = s.rollNumber || "";
        const dept = s.department?.name || s.department?.code || "";
        const sec = s.section?.name || "";
        const term = crossSearch.toLowerCase();
        return name.toLowerCase().includes(term) ||
            roll.toLowerCase().includes(term) ||
            dept.toLowerCase().includes(term) ||
            sec.toLowerCase().includes(term);
    });

    return (
        <div className="mx-auto max-w-7xl p-6 pb-32">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Elective Enrollment</h1>
                <button
                    onClick={() => router.push("/admin/electives/report")}
                    className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
                >
                    View Choices Report
                </button>
            </div>

            <div className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-4">
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Department</label>
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-full rounded-lg border p-2">
                        <option value="">Select Dept</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Year</label>
                    <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full rounded-lg border p-2">
                        <option value="">Select Year</option>
                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border p-2">
                        <option value="">Select Sem</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Elective Subject</label>
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full rounded-lg border p-2">
                        <option value="">Select Elective</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                    </select>
                </div>
            </div>

            {/* Tab switchers if subjectId is selected */}
            {subjectId && (
                <div className="mb-6 flex gap-4 border-b border-slate-200 pb-2">
                    <button
                        onClick={() => setActiveTab("enroll")}
                        className={`pb-2 text-sm font-semibold transition-colors ${activeTab === "enroll" ? "border-b-2 border-blue-600 text-blue-600 font-bold" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Enrollment Manager (Section-wise)
                    </button>
                    <button
                        onClick={() => setActiveTab("view")}
                        className={`pb-2 text-sm font-semibold transition-colors ${activeTab === "view" ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Enrolled Students ({crossEnrolledStudents.length} - Cross-Departmental)
                    </button>
                </div>
            )}

            {activeTab === "enroll" && (
                <>
                    <div className="mb-6">
                        <label className="mb-2 block text-sm font-semibold text-slate-700">Select Source Sections</label>
                        <div className="flex flex-wrap gap-2">
                            {sections.map(sec => (
                                <button
                                    key={sec.id}
                                    onClick={() => {
                                        const newSet = new Set(selectedSectionIds);
                                        if (newSet.has(sec.id)) newSet.delete(sec.id);
                                        else newSet.add(sec.id);
                                        setSelectedSectionIds(newSet);
                                    }}
                                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${selectedSectionIds.has(sec.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                >
                                    {sec.name}
                                </button>
                            ))}
                        </div>
                        {selectedSectionIds.size === 0 && <p className="mt-1 text-xs text-slate-500">Select sections to load students</p>}
                    </div>

                    {loading ? (
                        <div className="py-20 text-center text-slate-500">Loading students...</div>
                    ) : students.length > 0 ? (
                        <>
                            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="relative w-full sm:w-72">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full rounded-full border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={showEnrolledOnly}
                                            onChange={(e) => setShowEnrolledOnly(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Show Enrolled Only
                                    </label>
                                </div>
                            </div>

                            <div className="mb-4 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        onClick={handleClearAll}
                                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                                    >
                                        Clear All (Delete List)
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <p className="text-sm font-medium text-slate-600">
                                        <span className="font-bold text-slate-900">{enrolledStudentIds.size}</span> Enrolled
                                    </p>
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white hover:bg-green-700 shadow-sm"
                                    >
                                        <FaSave /> Save Changes
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {filteredStudents.map(student => {
                                    const isEnrolled = enrolledStudentIds.has(student.id);
                                    const selectedSub = subjects.find(s => s.id === subjectId);
                                    const otherElective = !isEnrolled && selectedSub?.electiveSlotId
                                        ? student.subjects?.find((sub: any) => sub.electiveSlotId === selectedSub.electiveSlotId && sub.id !== subjectId)
                                        : null;
                                    return (
                                        <div
                                            key={student.id}
                                            onClick={() => toggleEnrollment(student.id)}
                                            className={`cursor-pointer rounded-xl border p-4 transition-all ${isEnrolled
                                                ? "border-green-200 bg-green-50 ring-1 ring-green-500"
                                                : "border-slate-200 bg-white hover:border-blue-300"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-mono font-bold text-slate-900">{student.rollNumber}</p>
                                                    <p className="text-sm text-slate-600">{student.name}</p>
                                                    <p className="text-xs text-slate-400 mt-1">Sec: {student.section?.name}</p>
                                                    {otherElective && (
                                                        <div className="mt-2">
                                                             <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                                                 Enrolled: {otherElective.code} (Auto-shifts)
                                                             </span>
                                                        </div>
                                                    )}
                                                </div>
                                                {isEnrolled && <FaCheck className="text-green-600" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        subjectId && selectedSectionIds.size > 0 && <div className="py-20 text-center text-slate-500">No students found.</div>
                    )}
                </>
            )}

            {activeTab === "view" && subjectId && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="relative w-full sm:w-72">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search enrolled students..."
                                    value={crossSearch}
                                    onChange={(e) => setCrossSearch(e.target.value)}
                                    className="w-full rounded-full border border-slate-200 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                            <button
                                onClick={handleSaveBatches}
                                disabled={savingBatches}
                                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                            >
                                {savingBatches ? "Saving..." : "Save Batch Assignments"}
                            </button>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                            Showing {filteredCrossStudents.length} of {crossEnrolledStudents.length} enrolled students
                        </p>
                    </div>

                    {filteredCrossStudents.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="p-3">Roll Number</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Department</th>
                                        <th className="p-3">Section</th>
                                        <th className="p-3">Batch Allocation</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredCrossStudents.map(student => (
                                        <tr key={student.id} className="hover:bg-slate-50/50">
                                            <td className="p-3 font-mono font-bold text-slate-900">{student.rollNumber}</td>
                                            <td className="p-3 text-slate-700 font-medium">{student.name}</td>
                                            <td className="p-3 text-slate-500">{student.department?.code || student.department?.name || "N/A"}</td>
                                            <td className="p-3 text-slate-500">{student.section?.name || "N/A"}</td>
                                            <td className="p-3">
                                                <select
                                                    value={studentBatches[student.id] || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setStudentBatches(prev => ({
                                                            ...prev,
                                                            [student.id]: val
                                                        }));
                                                    }}
                                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">None (All)</option>
                                                    <option value="Batch 1">Batch 1</option>
                                                    <option value="Batch 2">Batch 2</option>
                                                    <option value="Batch 3">Batch 3</option>
                                                    <option value="Batch 4">Batch 4</option>
                                                </select>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleUnenrollCross(student.id)}
                                                    className="rounded bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-slate-500">No enrolled students found matching search.</div>
                    )}
                </div>
            )}
        </div>
    );
}
