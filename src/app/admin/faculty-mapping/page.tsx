"use client";

import { useState, useEffect } from "react";
import { FaSave, FaArrowLeft, FaUsers } from "react-icons/fa";
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
    const [selectedAy, setSelectedAy] = useState("");
    const [selectedDept, setSelectedDept] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [selectedSection, setSelectedSection] = useState("");

    // Mappings state: subjectId -> array of facultyIds
    const [mappings, setMappings] = useState<Record<string, string[]>>({});

    // Modal state
    const [modalConfig, setModalConfig] = useState({ isOpen: false, message: "", isError: false });

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
        if (!selectedAy || !selectedDept || !year || !semester || !selectedSection) {
            showModal("Please select all fields.", true);
            return;
        }

        setLoading(true);
        try {
            // 1. Fetch Subjects for this context
            const subRes = await fetch(`/api/subjects?departmentId=${selectedDept}&year=${year}&semester=${semester}`);
            const subData = await subRes.json();
            setSubjects(subData || []);

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

            <div className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-5">
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Academic Year</label>
                    <select value={selectedAy} onChange={(e) => setSelectedAy(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">Select AY</option>
                        {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Department</label>
                    <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">Select Dept</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
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
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Section</label>
                    <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className="block w-full rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">Select Section</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
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
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
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
                                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{sub.type}</td>
                                    <td className="px-6 py-4">
                                        {sub.type === "LAB" ? (
                                            <div className="flex flex-col gap-2">
                                                <select 
                                                    value={mappings[sub.id]?.[0] || ""}
                                                    onChange={(e) => {
                                                        const current = mappings[sub.id] || [];
                                                        setMappings({ ...mappings, [sub.id]: [e.target.value, current[1] || ""] });
                                                    }}
                                                    className="w-full min-w-[250px] rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                >
                                                    <option value="">-- Primary Faculty --</option>
                                                    {allFaculty.map(fac => (
                                                        <option key={fac.id} value={fac.id}>
                                                            {fac.empName} ({fac.department.code}) - {fac.empCode}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select 
                                                    value={mappings[sub.id]?.[1] || ""}
                                                    onChange={(e) => {
                                                        const current = mappings[sub.id] || [];
                                                        setMappings({ ...mappings, [sub.id]: [current[0] || "", e.target.value] });
                                                    }}
                                                    className="w-full min-w-[250px] rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                >
                                                    <option value="">-- Secondary Faculty (Optional) --</option>
                                                    {allFaculty.map(fac => (
                                                        <option key={fac.id} value={fac.id}>
                                                            {fac.empName} ({fac.department.code}) - {fac.empCode}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <select 
                                                value={mappings[sub.id]?.[0] || ""}
                                                onChange={(e) => setMappings({ ...mappings, [sub.id]: [e.target.value] })}
                                                className="w-full min-w-[250px] rounded-md border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="">-- No Faculty Assigned --</option>
                                                {allFaculty.map(fac => (
                                                    <option key={fac.id} value={fac.id}>
                                                        {fac.empName} ({fac.department.code}) - {fac.empCode}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="bg-slate-50 p-6 flex justify-end border-t border-slate-200">
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? <LogoSpinner fullScreen={false} /> : <FaSave />}
                            Save Mappings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
