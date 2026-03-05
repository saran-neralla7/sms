"use client";

import { useState, useEffect } from "react";
import { Student } from "@/types";
import { FaGraduationCap, FaArrowRight, FaCheckSquare, FaSquare, FaFilter, FaSearch, FaExchangeAlt, FaArrowLeft } from "react-icons/fa";
import ConfirmationModal from "@/components/ConfirmationModal";



interface FilterState {
    batchId: string;
    departmentId: string;
    sectionId: string;
    year: string;
    semester: string;
}

export default function PromotePageRedesign() {
    // --- State ---
    const [batches, setBatches] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    // Source Filters & Data
    const [sourceFilters, setSourceFilters] = useState<FilterState>({ batchId: "", departmentId: "", sectionId: "", year: "", semester: "" });
    const [sourceStudents, setSourceStudents] = useState<Student[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
    const [loadingSource, setLoadingSource] = useState(false);

    // Destination Filters & Pending List
    const [destFilters, setDestFilters] = useState<FilterState>({ batchId: "", departmentId: "", sectionId: "", year: "", semester: "" });
    const [pendingStudents, setPendingStudents] = useState<Student[]>([]); // Students moved to right box
    const [selectedDestIds, setSelectedDestIds] = useState<Set<string>>(new Set());

    const [status, setStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [promoting, setPromoting] = useState(false);

    // --- Effects ---
    useEffect(() => {
        fetchMetadata();
    }, []);

    // Fetch Source Students when filters change
    useEffect(() => {
        if (sourceFilters.batchId && sourceFilters.departmentId) {
            fetchSourceStudents();
        } else {
            setSourceStudents([]);
        }
    }, [sourceFilters]);

    // --- Actions ---
    const fetchMetadata = async () => {
        try {
            const [batchRes, deptRes] = await Promise.all([
                fetch("/api/batches"),
                fetch("/api/departments")
            ]);

            if (batchRes.ok) setBatches(await batchRes.json());
            if (deptRes.ok) setDepartments(await deptRes.json());
        } catch (e) { console.error(e); }
    };

    const fetchSourceStudents = async () => {
        setLoadingSource(true);
        try {
            // Build query params
            const params = new URLSearchParams();
            if (sourceFilters.batchId) params.append("batchId", sourceFilters.batchId);
            if (sourceFilters.departmentId) params.append("departmentId", sourceFilters.departmentId); // Note: API needs to support this
            if (sourceFilters.year) params.append("year", sourceFilters.year);
            if (sourceFilters.semester) params.append("semester", sourceFilters.semester);
            if (sourceFilters.sectionId) params.append("sectionId", sourceFilters.sectionId); // Mapping section ID or Name?
            // Assuming simplified API for now. If API expects IDs, we need to map. 
            // For now, let's assume filtering happens nicely or we iterate.

            // FETCH ALL STUDENTS (Disable Pagination)
            params.append("limit", "-1");

            const res = await fetch(`/api/students?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                const students = Array.isArray(result) ? result : (result.data || []);

                // Filter out students already in Pending List to avoid duplicates
                const pendingIds = new Set(pendingStudents.map(s => s.id));
                setSourceStudents(students.filter((s: Student) => !pendingIds.has(s.id)));
                setSelectedSourceIds(new Set());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingSource(false);
        }
    };

    // Move Left -> Right
    const moveToDestination = () => {
        const toMove = sourceStudents.filter(s => selectedSourceIds.has(s.id));
        setPendingStudents(prev => [...prev, ...toMove]);
        setSourceStudents(prev => prev.filter(s => !selectedSourceIds.has(s.id)));
        setSelectedSourceIds(new Set());
    };

    // Move Right -> Left (Undo)
    const moveToSource = () => {
        const toReturn = pendingStudents.filter(s => selectedDestIds.has(s.id));
        // If they match current source filters, return them to source list. 
        // Otherwise just remove them (they "disappear" back to their original state which isn't currently viewed)
        // For simplicity, we just add them back to source view if they match, or just clear them.
        // Actually, better to just put them back in Source list regardless, user can refresh source if needed.
        setSourceStudents(prev => [...prev, ...toReturn]);
        setPendingStudents(prev => prev.filter(s => !selectedDestIds.has(s.id)));
        setSelectedDestIds(new Set());
    };

    const handlePromote = async () => {
        if (pendingStudents.length === 0) return;
        setPromoting(true);

        try {
            // We reuse the existing endpoint but payload might need adjustment
            // Or create a new one. `api/students/promote` seems flexible.
            // Payload: studentIds, targetYear, targetSemester, targetBatchId?

            const payload = {
                studentIds: pendingStudents.map(s => s.id),
                targetYear: destFilters.year, // "2"
                targetSemester: destFilters.semester, // "1"
                targetBatchId: destFilters.batchId, // Move to this batch
                isAlumni: destFilters.year === "Alumni" // Special case
            };

            const res = await fetch("/api/students/promote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setStatus({ type: "success", message: `Successfully moved ${pendingStudents.length} students!` });
                setPendingStudents([]);
                fetchSourceStudents(); // Refresh source
                setTimeout(() => setStatus({ type: null, message: "" }), 3000);
            } else {
                const data = await res.json();
                setStatus({ type: "error", message: data.error || "Failed to promote." });
            }
        } catch (e) {
            setStatus({ type: "error", message: "Error processing request." });
        } finally {
            setPromoting(false);
            setIsConfirmOpen(false);
        }
    };

    // --- Selection Helpers ---
    const toggleSource = (id: string) => {
        const next = new Set(selectedSourceIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedSourceIds(next);
    }
    const selectAllSource = () => {
        if (selectedSourceIds.size === sourceStudents.length) setSelectedSourceIds(new Set());
        else setSelectedSourceIds(new Set(sourceStudents.map(s => s.id)));
    }

    const toggleDest = (id: string) => {
        const next = new Set(selectedDestIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedDestIds(next);
    }
    const selectAllDest = () => {
        if (selectedDestIds.size === pendingStudents.length) setSelectedDestIds(new Set());
        else setSelectedDestIds(new Set(pendingStudents.map(s => s.id)));
    }

    // --- Render Helpers ---
    const FilterPanel = ({ title, filters, setFilters, batches, departments }: { title: string, filters: FilterState, setFilters: (f: FilterState) => void, batches: any[], departments: any[] }) => {
        const selectedDepartment = departments?.find(d => d.id === filters.departmentId);
        const sections = selectedDepartment?.sections || [];

        return (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="flex items-center gap-2 font-bold text-slate-700">
                    <FaFilter className="text-slate-400" /> {title}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-500">Batch</label>
                        <select value={filters.batchId} onChange={(e) => setFilters({ ...filters, batchId: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500">
                            <option value="">Select Batch</option>
                            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500">Dept</label>
                        <select value={filters.departmentId} onChange={e => setFilters({ ...filters, departmentId: e.target.value, sectionId: "" })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                            <option value="">Select</option>
                            {(departments || []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500">Section</label>
                        <select value={filters.sectionId} onChange={e => setFilters({ ...filters, sectionId: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                            <option value="">Any</option>
                            {sections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500">Year</label>
                        <select value={filters.year} onChange={e => setFilters({ ...filters, year: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                            <option value="">Any</option>
                            <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500">Sem</label>
                        <select value={filters.semester} onChange={e => setFilters({ ...filters, semester: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                            <option value="">Any</option>
                            <option value="1">1</option><option value="2">2</option>
                        </select>
                    </div>
                </div>
            </div>
        )
    };

    return (
        <div className="mx-auto max-w-[1400px]">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Student Transfer & Promotion</h1>
                    <p className="text-sm text-slate-500">Move students between batches, years, or semesters.</p>
                </div>
                {status.message && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-bold ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {status.message}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                {/* --- Left Column: Source --- */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <FilterPanel title="Source Details" filters={sourceFilters} setFilters={setSourceFilters} batches={batches} departments={departments} />

                    <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col min-h-[500px]">
                        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Students ({sourceStudents.length})</span>
                            <button onClick={selectAllSource} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                                {selectedSourceIds.size === sourceStudents.length ? "Deselect All" : "Select All"}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 max-h-[600px]">
                            {loadingSource ? (
                                <div className="flex h-40 items-center justify-center text-slate-400">Loading...</div>
                            ) : sourceStudents.length === 0 ? (
                                <div className="flex h-40 items-center justify-center text-sm text-slate-400">No students found</div>
                            ) : (
                                <div className="space-y-1">
                                    {sourceStudents.map(s => (
                                        <div key={s.id}
                                            onClick={() => toggleSource(s.id)}
                                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-all ${selectedSourceIds.has(s.id) ? "border-blue-200 bg-blue-50" : "border-slate-100 hover:bg-slate-50"}`}
                                        >
                                            <div className={`flex h-5 w-5 items-center justify-center rounded border ${selectedSourceIds.has(s.id) ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 bg-white"}`}>
                                                {selectedSourceIds.has(s.id) && <FaCheckSquare size={12} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-mono text-xs font-bold text-slate-600">{s.rollNumber}</p>
                                                <p className="text-sm font-medium text-slate-900">{s.name}</p>
                                            </div>
                                            <div className="text-xs text-slate-400">{s.year}-{s.semester}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Middle: Controls --- */}
                <div className="lg:col-span-2 flex lg:flex-col gap-4 items-center justify-center py-10">
                    <button
                        onClick={moveToDestination}
                        disabled={selectedSourceIds.size === 0}
                        className="flex h-12 w-12 lg:h-14 lg:w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-blue-700 disabled:bg-slate-300 disabled:scale-100 disabled:shadow-none"
                    >
                        <FaArrowRight className="hidden lg:block text-xl" />
                        <FaArrowRight className="lg:hidden rotate-90 text-xl" />
                    </button>

                    <button
                        onClick={moveToSource}
                        disabled={selectedDestIds.size === 0}
                        className="flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-full bg-slate-200 text-slate-600 shadow-md transition-transform hover:scale-110 hover:bg-slate-300 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                    >
                        <FaArrowLeft className="hidden lg:block text-lg" />
                        <FaArrowLeft className="lg:hidden rotate-90 text-lg" />
                    </button>

                    <div className="bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-500">
                        {pendingStudents.length} Pending
                    </div>
                </div>

                {/* --- Right Column: Destination --- */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                    <FilterPanel title="Target Details" filters={destFilters} setFilters={setDestFilters} batches={batches} departments={departments} />

                    <div className="flex-1 rounded-xl border border-green-200 bg-green-50/30 shadow-sm flex flex-col min-h-[500px]">
                        <div className="border-b border-green-100 bg-green-50 px-4 py-3 flex justify-between items-center">
                            <span className="font-semibold text-green-800">Ready to Move ({pendingStudents.length})</span>
                            <button onClick={selectAllDest} className="text-xs font-medium text-green-700 hover:text-green-800">
                                {selectedDestIds.size === pendingStudents.length ? "Deselect All" : "Select All"}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 max-h-[600px]">
                            {pendingStudents.length === 0 ? (
                                <div className="flex h-40 flex-col items-center justify-center text-slate-400 gap-2">
                                    <FaExchangeAlt className="text-2xl opacity-20" />
                                    <span className="text-sm">Select students from left to move here</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {pendingStudents.map(s => (
                                        <div key={s.id}
                                            onClick={() => toggleDest(s.id)}
                                            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-all ${selectedDestIds.has(s.id) ? "border-red-200 bg-red-50" : "border-green-200 bg-white"}`}
                                        >
                                            <div className={`flex h-5 w-5 items-center justify-center rounded border ${selectedDestIds.has(s.id) ? "border-red-500 bg-red-500 text-white" : "border-slate-300 bg-white"}`}>
                                                {selectedDestIds.has(s.id) && <FaCheckSquare size={12} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-mono text-xs font-bold text-slate-600">{s.rollNumber}</p>
                                                <p className="text-sm font-medium text-slate-900">{s.name}</p>
                                            </div>
                                            {/* Show badge for source -> target change? */}
                                            <div className="text-xs font-bold text-green-600">
                                                &rarr; {destFilters.year}-{destFilters.semester}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-green-100">
                            <button
                                onClick={() => setIsConfirmOpen(true)}
                                disabled={pendingStudents.length === 0 || !destFilters.batchId || !destFilters.year || !destFilters.semester}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-bold text-white shadow-md transition-all hover:bg-green-700 disabled:bg-slate-300 disabled:shadow-none"
                            >
                                <FaCheckSquare /> Confirm Move ({pendingStudents.length})
                            </button>
                            {!destFilters.batchId && pendingStudents.length > 0 && (
                                <p className="text-xs text-red-500 text-center mt-2">Select Target Batch details to proceed</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handlePromote}
                title="Confirm Student Transfer"
                message={`Are you sure you want to move ${pendingStudents.length} students to Batch {id} (Year ${destFilters.year}, Sem ${destFilters.semester})?`}
                confirmText={promoting ? "Processing..." : "Yes, Transfer"}
                isDangerous={false} // Blue button
            />
        </div>
    );
}
