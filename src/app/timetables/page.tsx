"use client";

import { useState, useEffect } from "react";
import { FaCalendarAlt, FaSave, FaFilter, FaClock, FaCheck, FaExclamationTriangle, FaUtensils } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { Department, Section, Subject, Period } from "@/types";

const DAYS = [
    { id: 1, name: "Monday" },
    { id: 2, name: "Tuesday" },
    { id: 3, name: "Wednesday" },
    { id: 4, name: "Thursday" },
    { id: 5, name: "Friday" },
    { id: 6, name: "Saturday" },
];

export default function TimetablesPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);

    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [sectionId, setSectionId] = useState("");

    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    // gridData maps `${dayOfWeek}-${periodId}` to an array of blocks: [{ subjectId, labBatchId, isLunch, isLab }]
    const [gridData, setGridData] = useState<Record<string, Array<{ subjectId: string | null, labBatchId: string | null, electiveSlotId: string | null, isLunch: boolean, isLab: boolean }>>>({});
    const [labBatches, setLabBatches] = useState<any[]>([]);

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (departmentId) {
            fetchSections(departmentId);
            setSectionId("");
        } else {
            setSections([]);
        }
    }, [departmentId]);

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments");
            if (res.ok) setDepartments(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const fetchSections = async (deptId: string) => {
        try {
            const res = await fetch(`/api/sections?departmentId=${deptId}`);
            if (res.ok) setSections(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const loadConfiguration = async () => {
        if (!departmentId || !year || !semester || !sectionId) {
            setStatus({ type: "error", message: "Please select all filters." });
            return;
        }

        setLoading(true);
        setStatus({ type: null, message: "" });

        try {
            // Fetch periods, subjects, current active timetable, and lab batches in parallel
            const [periodsRes, subjectsRes, timetableRes, batchesRes] = await Promise.all([
                fetch("/api/periods"),
                fetch(`/api/subjects?departmentId=${departmentId}&year=${year}&semester=${semester}`),
                fetch(`/api/timetables?sectionId=${sectionId}`),
                fetch(`/api/sections/${sectionId}/batches?departmentId=${departmentId}&year=${year}&semester=${semester}`)
            ]);

            if (periodsRes.ok && subjectsRes.ok && timetableRes.ok) {
                const fetchedPeriods = await periodsRes.json();
                const fetchedSubjects = await subjectsRes.json();
                const fetchedTimetable = await timetableRes.json();
                
                if (batchesRes?.ok) {
                    const b = await batchesRes.json();
                    setLabBatches(b.batches || []);
                }

                // Sort periods by order
                fetchedPeriods.sort((a: any, b: any) => a.order - b.order);
                setPeriods(fetchedPeriods);
                setSubjects(fetchedSubjects);

                // Map timetable to grid UI state grouping by day-period
                const newGridData: Record<string, any[]> = {};

                fetchedTimetable.forEach((entry: any) => {
                    const key = `${entry.dayOfWeek}-${entry.periodId}`;
                    if (!newGridData[key]) {
                        newGridData[key] = [];
                    }
                    newGridData[key].push({
                        subjectId: entry.subjectId,
                        labBatchId: entry.labBatchId,
                        electiveSlotId: entry.electiveSlotId,
                        isLunch: entry.isLunch,
                        isLab: entry.isLab
                    });
                });

                setGridData(newGridData);
                setHasLoaded(true);
            } else {
                setStatus({ type: "error", message: "Failed to load data. Please try again." });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "An error occurred while loading." });
        } finally {
            setLoading(false);
        }
    };

    const handleCellChange = (day: number, periodId: string, index: number, type: "subjectId" | "labBatchId" | "isLunch" | "remove" | "add", value?: any) => {
        const key = `${day}-${periodId}`;
        setGridData((prev) => {
            const currentBlocks = prev[key] && prev[key].length > 0 
                ? [...prev[key]] 
                : [{ subjectId: "", labBatchId: "", electiveSlotId: "", isLunch: false, isLab: false }];
            
            if (type === "add") {
                currentBlocks.push({ subjectId: "", labBatchId: "", electiveSlotId: "", isLunch: false, isLab: false });
            } else if (type === "remove") {
                currentBlocks.splice(index, 1);
            } else if (currentBlocks[index]) {
                let updated = { ...currentBlocks[index] };

                if (type === "isLunch") {
                    updated.isLunch = value;
                    if (value) updated.subjectId = ""; // Clear subject if marked as lunch
                } else if (type === "subjectId") {
                    updated.subjectId = value;
                    if (value) updated.isLunch = false; // Clear lunch if subject selected
                    // Auto-flag isLab if the subject name suggests it
                    const subject = subjects.find(s => s.id === value);
                    if (subject) {
                        updated.isLab = subject.type.toUpperCase() === "LAB" || subject.name.toLowerCase().includes("lab");
                        if (!updated.isLab) updated.labBatchId = ""; // Clear lab batch if not a lab
                    }
                } else if (type === "labBatchId") {
                    updated.labBatchId = value || null;
                }

                currentBlocks[index] = updated;
            }

            return { ...prev, [key]: currentBlocks };
        });
    };

    const saveTimetable = async () => {
        setSaving(true);
        setStatus({ type: null, message: "" });

        try {
            // Map grid data into the structured payload
            const entries = [];
            for (const [key, blocks] of Object.entries(gridData)) {
                // Filter out entirely empty blocks
                const validBlocks = blocks.filter(b => b.subjectId || b.isLunch);
                if (validBlocks.length > 0) {
                    const [dayStr, periodId] = key.split("-");
                    entries.push({
                        dayOfWeek: parseInt(dayStr, 10),
                        periodId,
                        blocks: validBlocks.map(b => ({
                            subjectId: b.subjectId || null,
                            labBatchId: b.labBatchId || null,
                            electiveSlotId: b.electiveSlotId || null,
                            isLunch: b.isLunch,
                            isLab: b.isLab
                        }))
                    });
                }
            }

            const payload = {
                departmentId,
                year,
                semester,
                sectionId,
                entries
            };

            const res = await fetch("/api/timetables", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setStatus({ type: "success", message: "Timetable Updated Successfully! Previous version successfully retained in history." });
                setTimeout(() => setStatus({ type: null, message: "" }), 5000);
            } else {
                const err = await res.json();
                setStatus({ type: "error", message: err.error || "Failed to save timetable." });
            }
        } catch (error) {
            console.error(error);
            setStatus({ type: "error", message: "An error occurred while saving." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-full overflow-x-hidden pb-10">
            {/* Header */}
            <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <FaCalendarAlt size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Timetable Configuration</h1>
                    <p className="text-sm text-slate-500">Map subjects and lunch periods for specific sections.</p>
                </div>
            </div>

            {/* Status Message */}
            {status.message && (
                <div className={`mb-4 flex items-center gap-2 rounded-lg border p-4 text-sm font-semibold ${status.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {status.type === "success" ? <FaCheck /> : <FaExclamationTriangle />}
                    {status.message}
                </div>
            )}

            {/* Filters Row */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm relative z-20">
                <div className="mb-4 flex items-center gap-2 text-slate-500">
                    <FaFilter />
                    <span className="text-sm font-semibold">Select Target Section</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Department</label>
                        <select
                            value={departmentId}
                            onChange={(e) => { setDepartmentId(e.target.value); setHasLoaded(false); }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                        >
                            <option value="">Select Dept</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Year</label>
                        <select
                            value={year}
                            onChange={(e) => { setYear(e.target.value); setHasLoaded(false); }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                        >
                            <option value="">Select Year</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Semester</label>
                        <select
                            value={semester}
                            onChange={(e) => { setSemester(e.target.value); setHasLoaded(false); }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                        >
                            <option value="">Select Sem</option>
                            <option value="1">1st Sem</option>
                            <option value="2">2nd Sem</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Section</label>
                        <select
                            value={sectionId}
                            onChange={(e) => { setSectionId(e.target.value); setHasLoaded(false); }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                        >
                            <option value="">Select Section</option>
                            {sections.map((sec) => (
                                <option key={sec.id} value={sec.id}>{sec.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={loadConfiguration}
                            disabled={loading || !departmentId || !year || !semester || !sectionId}
                            className="flex h-[38px] w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50"
                        >
                            {loading ? <FaClock className="animate-spin" /> : <FaFilter />}
                            {loading ? "Loading..." : "Load Timetable"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid UI */}
            {hasLoaded && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden text-sm">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                        <div className="font-semibold text-slate-700">
                            Current Configuration
                        </div>
                        <button
                            onClick={saveTimetable}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 font-bold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
                        >
                            {saving ? <LogoSpinner /> : <FaSave />}
                            Publish New Version
                        </button>
                    </div>

                    <div className="overflow-x-auto p-6">
                        {periods.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                No periods defined. Please configure periods first.
                            </div>
                        ) : (
                            <table className="w-full border-collapse border border-slate-200 min-w-[1000px]">
                                <thead>
                                    <tr>
                                        <th className="bg-slate-100 p-3 border border-slate-200 text-left w-32 font-bold text-slate-700 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                                            Day / Period
                                        </th>
                                        {periods.map((p) => (
                                            <th key={p.id} className="bg-slate-50 p-3 border border-slate-200 text-center font-semibold text-slate-600 w-48">
                                                <div className="text-xs">{p.startTime} - {p.endTime}</div>
                                                <div className="text-purple-700">{p.name}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {DAYS.map((day) => (
                                        <tr key={day.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 border border-slate-200 font-bold text-slate-700 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                                                {day.name}
                                            </td>
                                            {periods.map((period) => {
                                                const key = `${day.id}-${period.id}`;
                                                // Default to a single empty block if no data exists
                                                const cellBlocks = gridData[key] && gridData[key].length > 0
                                                    ? gridData[key]
                                                    : [{ subjectId: "", labBatchId: "", electiveSlotId: "", isLunch: false, isLab: false }];

                                                // If any block in this cell is marked as lunch, we style the whole cell
                                                const isCellLunch = cellBlocks.some(b => b.isLunch);

                                                return (
                                                    <td key={period.id} className={`p-2 border border-slate-200 align-top min-w-[200px] ${isCellLunch ? 'bg-orange-50/50' : ''}`}>
                                                        <div className="flex flex-col gap-3">
                                                            {cellBlocks.map((block, index) => (
                                                                <div key={index} className="flex flex-col gap-1 relative rounded border border-slate-100 bg-white p-2 shadow-sm">
                                                                    
                                                                    {cellBlocks.length > 1 && (
                                                                        <button 
                                                                            title="Remove parallel subject"
                                                                            onClick={() => handleCellChange(day.id, period.id, index, "remove")}
                                                                            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full h-5 w-5 flex items-center justify-center text-[10px] hover:bg-red-200"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    )}

                                                                    <select
                                                                        className={`w-full rounded-md border text-xs outline-none focus:border-orange-500 ${block.isLunch ? 'border-orange-300 bg-orange-50 text-orange-700 font-semibold p-2' : 'border-slate-300 bg-white p-2'}`}
                                                                        value={block.isLunch ? "LUNCH" : (block.subjectId || "")}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (val === "LUNCH") {
                                                                                handleCellChange(day.id, period.id, index, "isLunch", true);
                                                                            } else {
                                                                                handleCellChange(day.id, period.id, index, "subjectId", val);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">-- Empty --</option>
                                                                        <option value="LUNCH">🍕 Lunch Break</option>
                                                                        {subjects.map((sub) => (
                                                                            <option key={sub.id} value={sub.id}>
                                                                                {sub.shortName || sub.name}
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    {block.isLab && labBatches.length > 0 && (
                                                                        <select
                                                                            className="w-full rounded-md border border-purple-200 bg-purple-50 text-xs text-purple-800 outline-none p-1.5 focus:border-purple-500 mt-1"
                                                                            value={block.labBatchId || ""}
                                                                            onChange={(e) => handleCellChange(day.id, period.id, index, "labBatchId", e.target.value)}
                                                                        >
                                                                            <option value="">All Students (Lab)</option>
                                                                            {labBatches.map(lb => (
                                                                                <option key={lb.id} value={lb.id}>{lb.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            ))}

                                                            {!isCellLunch && cellBlocks[0].subjectId !== "" && (
                                                                <button 
                                                                    onClick={() => handleCellChange(day.id, period.id, 0, "add")}
                                                                    className="text-[10px] text-slate-500 hover:text-orange-600 font-semibold text-center border border-dashed border-slate-300 rounded p-1 transition-colors"
                                                                >
                                                                    + Add Parallel Subject
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
