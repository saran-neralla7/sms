"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { FaSave, FaCheck, FaSearch } from "react-icons/fa";

export default function ElectivesPage() {
    const { data: session } = useSession();
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

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchSubjects = async () => {
        const res = await fetch(`/api/subjects?departmentId=${departmentId}&year=${year}&semester=${semester}`);
        if (res.ok) {
            const allSubjects = await res.json();
            // Filter only ELECTIVE subjects
            setSubjects(allSubjects.filter((s: any) => s.type === "ELECTIVE"));
        }
    };

    const fetchSections = async () => {
        const res = await fetch(`/api/sections?departmentId=${departmentId}`);
        if (res.ok) setSections(await res.json());
    };

    const fetchStudentsAndEnrollment = async () => {
        setLoading(true);
        try {
            const sectionIdsStr = Array.from(selectedSectionIds).join(",");
            // Fetch All Students in sections
            const studentsRes = await fetch(`/api/students?departmentId=${departmentId}&year=${year}&semester=${semester}&sectionIds=${sectionIdsStr}&includeSubjects=true`);

            if (studentsRes.ok) {
                const studentsData = await studentsRes.json();
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
            } else {
                alert("Failed to update enrollment.");
            }
        } catch (error) {
            console.error(error);
            alert("Error saving enrollment.");
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

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="mx-auto max-w-7xl p-6 pb-32">
            <h1 className="mb-6 text-2xl font-bold text-slate-900">Elective Enrollment</h1>

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
                    <div className="mb-4 flex items-center justify-between">
                        <div className="relative w-72">
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
                            <p className="text-sm font-medium text-slate-600">
                                {enrolledStudentIds.size} Enrolled
                            </p>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white hover:bg-green-700"
                            >
                                <FaSave /> Save Enrollment
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {filteredStudents.map(student => {
                            const isEnrolled = enrolledStudentIds.has(student.id);
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
        </div>
    );
}
