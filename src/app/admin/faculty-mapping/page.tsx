"use client";

import { useState, useEffect } from "react";
import { FaSave, FaArrowLeft, FaUsers, FaSearch, FaTimes, FaUserPlus, FaTrashAlt, FaExchangeAlt, FaFilter } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { useRouter } from "next/navigation";

export default function FacultyMappingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Metadata
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [allFaculty, setAllFaculty] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);

    // Selections
    const [activeTab, setActiveTab] = useState<"section" | "open-elective">("section");
    const [selectedAy, setSelectedAy] = useState("");
    const [selectedDept, setSelectedDept] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [selectedSection, setSelectedSection] = useState("");

    // Mappings state: subjectId -> array of facultyIds
    const [mappings, setMappings] = useState<Record<string, string[]>>({});

    // Modal state
    const [modalConfig, setModalConfig] = useState({ isOpen: false, message: "", isError: false });

    // Faculty selection lookup modal state
    const [assignContext, setAssignContext] = useState<{
        subjectId: string;
        index: number;
        role: string;
        subjectName: string;
    } | null>(null);
    const [modalSearch, setModalSearch] = useState("");
    const [modalDeptFilter, setModalDeptFilter] = useState("");

    const showModal = (message: string, isError: boolean) => {
        setModalConfig({ isOpen: true, message, isError });
    };

    const closeModal = () => setModalConfig({ isOpen: false, message: "", isError: false });

    useEffect(() => {
        Promise.all([
            fetch("/api/academic-years").then(res => res.json()),
            fetch("/api/departments").then(res => res.json()),
            fetch("/api/faculty").then(res => res.json())
        ]).then(([ayData, deptData, facultyData]) => {
            setAcademicYears(ayData);
            setDepartments(deptData);
            setAllFaculty(facultyData);
            const currentAy = ayData.find((a: any) => a.isCurrent);
            if (currentAy) setSelectedAy(currentAy.id);
        });
    }, []);

    // Reset subjects and mappings on tab change
    useEffect(() => {
        setSubjects([]);
        setMappings({});
    }, [activeTab]);

    useEffect(() => {
        if (selectedDept) {
            fetch(`/api/sections?departmentId=${selectedDept}`)
                .then(res => res.json())
                .then(data => setSections(data));
        } else {
            setSections([]);
        }
        setSelectedSection("");
    }, [selectedDept]);

    const handleLoadSubjects = async () => {
        if (activeTab === "open-elective") {
            if (!selectedAy || !year || !semester) {
                showModal("Please select Academic Year, Year and Semester.", true);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/faculty-mappings/open-electives?academicYearId=${selectedAy}&year=${year}&semester=${semester}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setSubjects(data);
                    const currentMappings: Record<string, string[]> = {};
                    data.forEach(item => {
                        currentMappings[item.id] = (item.facultyIds && item.facultyIds.length > 0) ? item.facultyIds : [""];
                    });
                    setMappings(currentMappings);
                } else {
                    setSubjects([]);
                    setMappings({});
                }
            } catch (e) {
                console.error(e);
                showModal("Error loading open elective subjects.", true);
            } finally {
                setLoading(false);
            }
            return;
        }

        if (!selectedAy || !selectedDept || !year || !semester || !selectedSection) {
            showModal("Please select all fields.", true);
            return;
        }

        setLoading(true);
        try {
            // 1. Fetch Subjects for this context
            const subRes = await fetch(`/api/subjects?departmentId=${selectedDept}&year=${year}&semester=${semester}`);
            const subData = await subRes.json();
            const filteredSubs = Array.isArray(subData) ? subData.filter((s: any) => {
                const isOpenElective = s.isElective && s.electiveSlotRelation?.name && (
                    s.electiveSlotRelation.name.toUpperCase().startsWith("OE") ||
                    s.electiveSlotRelation.name.toUpperCase().startsWith("OPEN")
                );
                return !isOpenElective;
            }) : [];
            setSubjects(filteredSubs);

            // 2. Fetch existing mappings
            const mapRes = await fetch(`/api/admin/faculty-mappings?sectionId=${selectedSection}&academicYearId=${selectedAy}`);
            const mapData = await mapRes.json();
            
            const currentMappings: Record<string, string[]> = {};
            if (Array.isArray(mapData)) {
                mapData.forEach(m => {
                    if (!currentMappings[m.subjectId]) {
                        currentMappings[m.subjectId] = [];
                    }
                    currentMappings[m.subjectId].push(m.facultyId);
                });
            }
            setMappings(currentMappings);
            
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeTab === "open-elective") {
                const payload = Object.entries(mappings).map(([subjectId, facultyIds]) => ({
                    subjectId,
                    facultyIds: facultyIds.filter(Boolean)
                }));

                const res = await fetch("/api/admin/faculty-mappings/open-electives", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        academicYearId: selectedAy,
                        mappings: payload
                    })
                });

                if (res.ok) {
                    showModal("Open Elective mappings saved successfully across all sections!", false);
                } else {
                    showModal("Failed to save open elective mappings.", true);
                }
                return;
            }

            const payload: any[] = [];
            Object.entries(mappings).forEach(([subjectId, facultyIds]) => {
                facultyIds.forEach(facultyId => {
                    if (facultyId) {
                        payload.push({ subjectId, facultyId });
                    }
                });
            });

            const res = await fetch("/api/admin/faculty-mappings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sectionId: selectedSection,
                    academicYearId: selectedAy,
                    departmentId: selectedDept,
                    mappings: payload
                })
            });

            if (res.ok) {
                showModal("Mappings saved successfully!", false);
            } else {
                showModal("Failed to save mappings.", true);
            }
        } catch (e) {
            console.error(e);
            showModal("Error saving mappings.", true);
        } finally {
            setSaving(false);
        }
    };

    // Render helper for responsive faculty mapping slot
    const renderFacultySlot = (subjectId: string, index: number, role: string, subjectName: string) => {
        const assignedId = mappings[subjectId]?.[index] || "";
        const faculty = allFaculty.find(f => f.id === assignedId);

        if (faculty) {
            return (
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all">
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 text-sm truncate">{faculty.empName}</span>
                        <span className="text-xxs text-slate-500 font-medium truncate">
                            {faculty.department?.code || "N/A"} • {faculty.empCode}
                            {faculty.shortName ? ` • ${faculty.shortName}` : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setAssignContext({ subjectId, index, role, subjectName })}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors animate-in"
                            title="Change Faculty"
                        >
                            <FaExchangeAlt className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const current = [...(mappings[subjectId] || [])];
                                if (activeTab === "open-elective") {
                                    current.splice(index, 1);
                                    if (current.length === 0) {
                                        current.push("");
                                    }
                                } else {
                                    current[index] = "";
                                }
                                setMappings({ ...mappings, [subjectId]: current });
                            }}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-55 rounded-lg transition-colors animate-in"
                            title="Remove Faculty"
                        >
                            <FaTrashAlt className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <button
                type="button"
                onClick={() => setAssignContext({ subjectId, index, role, subjectName })}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-slate-500 hover:text-blue-600 text-xs font-semibold transition-all active:scale-98"
            >
                <FaUserPlus className="h-3.5 w-3.5" />
                <span>Assign {role} Faculty</span>
            </button>
        );
    };

    // Filter faculty list for modal
    const filteredFaculty = allFaculty.filter(fac => {
        if (modalDeptFilter && fac.departmentId !== modalDeptFilter) {
            return false;
        }
        if (modalSearch) {
            const query = modalSearch.toLowerCase().trim();
            const nameMatch = (fac.empName || "").toLowerCase().includes(query);
            const codeMatch = (fac.empCode || "").toLowerCase().includes(query);
            const shortMatch = (fac.shortName || "").toLowerCase().includes(query);
            const deptMatch = (fac.department?.code || "").toLowerCase().includes(query);
            return nameMatch || codeMatch || shortMatch || deptMatch;
        }
        return true;
    });

    return (
        <div className="mx-auto max-w-6xl animate-in fade-in">
            {/* Modal */}
            {modalConfig.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="text-center">
                            {modalConfig.isError ? (
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                            ) : (
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                                    <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                            <h3 className="text-xl font-bold text-slate-800 mb-2">{modalConfig.isError ? "Error" : "Success"}</h3>
                            <p className="text-slate-600 mb-6">{modalConfig.message}</p>
                            <button
                                onClick={closeModal}
                                className={`w-full rounded-xl py-3 font-bold text-white transition-all active:scale-95 ${
                                    modalConfig.isError ? "bg-red-600 hover:bg-red-700 shadow-red-200" : "bg-green-600 hover:bg-green-700 shadow-green-200"
                                } shadow-lg`}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button onClick={() => router.push("/admin")} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 mb-2">
                        <FaArrowLeft /> Back to Admin
                    </button>
                    <h1 className="flex items-center gap-2 text-3xl font-extrabold text-slate-900">
                        <FaUsers className="text-blue-600" />
                        Faculty-Subject Mapping
                    </h1>
                    <p className="mt-1 text-slate-500">Ensure faculty mark attendance and receive feedback only for their mapped subjects.</p>
                </div>
            </div>

            {/* Tab Switching Buttons */}
            <div className="mb-6 flex gap-4 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setActiveTab("section")}
                    className={`pb-2 text-sm font-semibold transition-colors ${
                        activeTab === "section"
                            ? "border-b-2 border-blue-600 text-blue-600 font-bold"
                            : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Section-wise Mapping (Core / Professional Elective)
                </button>
                <button
                    onClick={() => setActiveTab("open-elective")}
                    className={`pb-2 text-sm font-semibold transition-colors ${
                        activeTab === "open-elective"
                            ? "border-b-2 border-blue-600 text-blue-600 font-bold"
                            : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                    Open Elective Mapping (Global across Sections)
                </button>
            </div>

            <div className={`mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${
                activeTab === "open-elective" ? "md:grid-cols-3" : "md:grid-cols-5"
            }`}>
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Academic Year</label>
                    <select value={selectedAy} onChange={(e) => setSelectedAy(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">Select AY</option>
                        {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                    </select>
                </div>
                {activeTab !== "open-elective" && (
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Department</label>
                        <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">Select Dept</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Year & Sem</label>
                    <div className="flex gap-2">
                        <select value={year} onChange={(e) => setYear(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">Year</option>
                            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">Sem</option>
                            {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                {activeTab !== "open-elective" && (
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Section</label>
                        <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="">Select Section</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="flex items-end">
                    <button 
                        onClick={handleLoadSubjects}
                        disabled={loading}
                        className="w-full rounded-md bg-slate-800 px-4 py-2 font-bold text-white shadow hover:bg-slate-900 disabled:opacity-50"
                    >
                        {loading ? "Loading..." : "Load Mapping"}
                    </button>
                </div>
            </div>

            {subjects.length > 0 && (
                <div className="space-y-4">
                    {/* Desktop View: Table */}
                    <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Subject Name</th>
                                    <th className="px-6 py-4">Subject Code</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Assigned Faculty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {subjects.map(sub => (
                                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800">{sub.name}</td>
                                        <td className="px-6 py-4 font-mono text-slate-500">{sub.code}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xxs font-bold uppercase tracking-wider ${
                                                sub.type === "LAB" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                                            }`}>
                                                {sub.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 min-w-[280px]">
                                            {activeTab === "open-elective" ? (
                                                <div className="flex flex-col gap-2">
                                                    {(mappings[sub.id] || [""]).map((_, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <div className="flex-1">
                                                                {renderFacultySlot(sub.id, idx, `Faculty ${idx + 1}`, sub.name)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = [...(mappings[sub.id] || [""])];
                                                            current.push("");
                                                            setMappings({ ...mappings, [sub.id]: current });
                                                        }}
                                                        className="w-full text-left text-xs font-semibold text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1"
                                                    >
                                                        <FaUserPlus className="h-3 w-3" />
                                                        <span>Add another Faculty member</span>
                                                    </button>
                                                </div>
                                            ) : sub.type === "LAB" ? (
                                                <div className="flex flex-col gap-2">
                                                    <div>
                                                        <p className="text-xxs font-bold text-slate-400 uppercase mb-1">Primary Role</p>
                                                        {renderFacultySlot(sub.id, 0, "Primary", sub.name)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xxs font-bold text-slate-400 uppercase mb-1">Secondary Role (Optional)</p>
                                                        {renderFacultySlot(sub.id, 1, "Secondary", sub.name)}
                                                    </div>
                                                </div>
                                            ) : (
                                                renderFacultySlot(sub.id, 0, "Primary", sub.name)
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="block md:hidden space-y-4 animate-in fade-in">
                        {subjects.map(sub => (
                            <div key={sub.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-snug">{sub.name}</h4>
                                        <p className="text-xxs font-mono text-slate-400 mt-0.5">{sub.code}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xxs font-bold uppercase tracking-wider ${
                                        sub.type === "LAB" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"
                                    }`}>
                                        {sub.type}
                                    </span>
                                </div>

                                <div className="border-t border-slate-100 pt-3 space-y-3">
                                    {activeTab === "open-elective" ? (
                                        <div className="space-y-2">
                                            <p className="text-xxs font-bold text-slate-400 uppercase mb-1">Assigned Faculty</p>
                                            {(mappings[sub.id] || [""]).map((_, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        {renderFacultySlot(sub.id, idx, `Faculty ${idx + 1}`, sub.name)}
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const current = [...(mappings[sub.id] || [""])];
                                                    current.push("");
                                                    setMappings({ ...mappings, [sub.id]: current });
                                                }}
                                                className="w-full text-left text-xs font-semibold text-blue-600 hover:text-blue-800 p-1 flex items-center gap-1"
                                            >
                                                <FaUserPlus className="h-3 w-3" />
                                                <span>Add another Faculty member</span>
                                            </button>
                                        </div>
                                    ) : sub.type === "LAB" ? (
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xxs font-bold text-slate-400 uppercase mb-1">Primary Role</p>
                                                {renderFacultySlot(sub.id, 0, "Primary", sub.name)}
                                            </div>
                                            <div>
                                                <p className="text-xxs font-bold text-slate-400 uppercase mb-1">Secondary Role</p>
                                                {renderFacultySlot(sub.id, 1, "Secondary", sub.name)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-xxs font-bold text-slate-400 uppercase mb-1">Assigned Faculty</p>
                                            {renderFacultySlot(sub.id, 0, "Primary", sub.name)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Global Save Button */}
                    <div className="rounded-xl border border-slate-200 bg-white shadow-xs p-4 sm:p-6 flex justify-end">
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 px-8 py-3.5 font-bold text-white shadow-md transition-all disabled:opacity-50"
                        >
                            {saving ? <LogoSpinner fullScreen={false} /> : <FaSave />}
                            Save Mappings
                        </button>
                    </div>
                </div>
            )}

            {/* Search & Selection Modal for Faculty Lookup */}
            {assignContext && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-150 flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Assign Faculty</h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Selecting <span className="font-semibold text-blue-600">{assignContext.role}</span> faculty for <span className="font-semibold text-slate-700">{assignContext.subjectName}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => setAssignContext(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <FaTimes className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Search & Filters */}
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-3 sm:flex-row">
                            <div className="relative flex-1">
                                <FaSearch className="absolute left-3 top-3.5 text-slate-400 h-4 w-4" />
                                <input
                                    type="text"
                                    placeholder="Search by Name, Short Name or Emp ID..."
                                    value={modalSearch}
                                    onChange={(e) => setModalSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                {modalSearch && (
                                    <button
                                        onClick={() => setModalSearch("")}
                                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <FaTimes className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="sm:w-56 flex items-center gap-2">
                                <FaFilter className="text-slate-400 h-4 w-4" />
                                <select
                                    value={modalDeptFilter}
                                    onChange={(e) => setModalDeptFilter(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">All Departments</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Scrollable List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[45vh] min-h-[250px]">
                            {filteredFaculty.length > 0 ? (
                                filteredFaculty.map(fac => {
                                    const isCurrentlySelected = mappings[assignContext.subjectId]?.[assignContext.index] === fac.id;
                                    return (
                                        <div 
                                            key={fac.id} 
                                            onClick={() => {
                                                const current = [...(mappings[assignContext.subjectId] || [])];
                                                current[assignContext.index] = fac.id;
                                                setMappings({ ...mappings, [assignContext.subjectId]: current });
                                                setAssignContext(null);
                                            }}
                                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                                isCurrentlySelected 
                                                    ? "border-blue-500 bg-blue-50/50 hover:bg-blue-50" 
                                                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                    <span>{fac.empName}</span>
                                                    {fac.shortName && (
                                                        <span className="px-1.5 py-0.5 rounded text-xxs font-bold bg-slate-100 text-slate-600 uppercase border border-slate-200">
                                                            {fac.shortName}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-slate-500 font-medium mt-1">
                                                    {fac.designation} • {fac.department?.name || "N/A"}
                                                </p>
                                                <p className="text-xxs font-mono text-slate-400 mt-0.5">
                                                    ID: {fac.empCode}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                                                    isCurrentlySelected
                                                        ? "bg-blue-600 text-white shadow-sm"
                                                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                                }`}
                                            >
                                                {isCurrentlySelected ? "Selected" : "Assign"}
                                            </button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-12">
                                    <p className="text-slate-400 font-medium text-sm">No faculty members found matching your filters.</p>
                                    <button 
                                        type="button"
                                        onClick={() => { setModalSearch(""); setModalDeptFilter(""); }}
                                        className="text-blue-500 hover:text-blue-700 font-bold text-xs mt-2"
                                    >
                                        Clear Search Filters
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-155 flex flex-col sm:flex-row justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const current = [...(mappings[assignContext.subjectId] || [])];
                                    current[assignContext.index] = "";
                                    setMappings({ ...mappings, [assignContext.subjectId]: current });
                                    setAssignContext(null);
                                }}
                                className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all text-center animate-in"
                            >
                                Clear Assignment (Unassign)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssignContext(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all text-center"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
