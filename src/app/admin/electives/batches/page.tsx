"use client";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaSave, FaLayerGroup, FaSearch, FaUserGraduate, FaCheckCircle, FaTimes, FaExchangeAlt } from "react-icons/fa";

const BC: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    "Batch 1": { bg: "bg-blue-50",    border: "border-blue-300",    text: "text-blue-800",    badge: "bg-blue-600 text-white" },
    "Batch 2": { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", badge: "bg-emerald-600 text-white" },
    "Batch 3": { bg: "bg-violet-50",  border: "border-violet-300",  text: "text-violet-800",  badge: "bg-violet-600 text-white" },
    "Batch 4": { bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-800",   badge: "bg-amber-600 text-white" },
};
const BATCHES = ["Batch 1", "Batch 2", "Batch 3", "Batch 4"];

interface Student { id: string; rollNumber: string; name: string; department?: { code: string }; section?: { name: string }; }

export default function OEBatchDivisionPage() {
    const { data: session } = useSession();
    const router = useRouter();

    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [subjectsLoading, setSubjectsLoading] = useState(true);
    const [yearFilter, setYearFilter] = useState("");
    const [semFilter, setSemFilter] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [students, setStudents] = useState<Student[]>([]);
    const [batches, setBatches] = useState<Record<string, string>>({});
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [search, setSearch] = useState("");
    const [batchFilter, setBatchFilter] = useState("All");
    const [deptFilter, setDeptFilter] = useState("All");
    const [transferStudent, setTransferStudent] = useState<Student | null>(null);
    const [transferTo, setTransferTo] = useState("");
    const [transferring, setTransferring] = useState(false);

    // Load ALL elective subjects once on mount — no year/semester filter in API
    useEffect(() => {
        (async () => {
            setSubjectsLoading(true);
            const res = await fetch("/api/subjects?onlyElectives=true&limit=-1");
            if (res.ok) {
                const j = await res.json();
                // Include all subjects marked as elective (type may be THEORY, OPEN_ELECTIVE, etc.)
                setAllSubjects(Array.isArray(j) ? j : j.data || []);
            }
            setSubjectsLoading(false);
        })();
    }, []);

    const visibleSubjects = useMemo(() =>
        allSubjects.filter(s =>
            (!yearFilter || s.year === yearFilter) &&
            (!semFilter  || s.semester === semFilter)
        ), [allSubjects, yearFilter, semFilter]);

    // If the selected subject disappears from view, clear it
    useEffect(() => {
        if (subjectId && !visibleSubjects.find(s => s.id === subjectId)) {
            setSubjectId(""); setStudents([]); setBatches({});
        }
    }, [visibleSubjects]);

    useEffect(() => {
        if (!subjectId) { setStudents([]); setBatches({}); setDeptFilter("All"); return; }
        (async () => {
            setLoadingStudents(true); setSaved(false); setDeptFilter("All");
            const [sRes, bRes] = await Promise.all([
                fetch(`/api/students?subjectId=${subjectId}&limit=-1`),
                fetch(`/api/admin/electives/batches?subjectId=${subjectId}`)
            ]);
            if (sRes.ok) {
                const j = await sRes.json();
                const raw: Student[] = j.data || j || [];
                raw.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
                setStudents(raw);
            }
            setBatches(bRes.ok ? await bRes.json() : {});
            setLoadingStudents(false);
        })();
    }, [subjectId]);

    const assign = (sid: string, b: string) => { setSaved(false); setBatches(p => p[sid] === b ? (({ [sid]: _, ...r }) => r)(p) : { ...p, [sid]: b }); };
    const clear  = (sid: string) => { setSaved(false); setBatches(p => (({ [sid]: _, ...r }) => r)(p)); };

    const handleSave = async () => {
        setSaving(true);
        const r = await fetch("/api/admin/electives/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId, studentBatches: batches }) });
        if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); } else alert("Save failed.");
        setSaving(false);
    };

    const handleTransfer = async () => {
        if (!transferStudent || !transferTo) return;
        setTransferring(true);
        const r = await fetch("/api/students/enroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: transferStudent.id, subjectId: transferTo, action: "enroll" }) });
        if (r.ok) {
            setTransferStudent(null); setTransferTo("");
            // refresh list
            const sRes = await fetch(`/api/students?subjectId=${subjectId}&limit=-1`);
            if (sRes.ok) { const j = await sRes.json(); const raw: Student[] = j.data || j || []; raw.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })); setStudents(raw); }
        } else { const e = await r.json(); alert(e.error || "Transfer failed."); }
        setTransferring(false);
    };

    const counts = useMemo(() => {
        const c: Record<string, number> = { Unassigned: 0, ...Object.fromEntries(BATCHES.map(b => [b, 0])) };
        students.forEach(s => { const b = batches[s.id]; b && BATCHES.includes(b) ? c[b]++ : c["Unassigned"]++; });
        return c;
    }, [students, batches]);

    const uniqueDepts = useMemo(() => {
        const depts = new Set<string>();
        students.forEach(s => {
            if (s.department?.code) depts.add(s.department.code);
        });
        return Array.from(depts).sort();
    }, [students]);

    const deptCounts = useMemo(() => {
        const c: Record<string, number> = {};
        students.forEach(s => {
            if (s.department?.code) {
                c[s.department.code] = (c[s.department.code] || 0) + 1;
            }
        });
        return c;
    }, [students]);

    const filtered = useMemo(() => students.filter(s => {
        const ms = !search || s.rollNumber.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase());
        const mb = batchFilter === "All" || (batches[s.id] || "Unassigned") === batchFilter;
        const md = deptFilter === "All" || s.department?.code === deptFilter;
        return ms && mb && md;
    }), [students, batches, search, batchFilter, deptFilter]);

    const selSub = allSubjects.find(s => s.id === subjectId);
    const otherSubs = allSubjects.filter(s => s.id !== subjectId);

    if (!session) return null;
    if ((session.user as any).role !== "ADMIN") return <div className="flex min-h-screen items-center justify-center text-slate-500">Unauthorized</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
            {/* Transfer Modal */}
            {transferStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <h3 className="font-bold text-slate-900">Transfer Open Elective</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{transferStudent.rollNumber} — {transferStudent.name}</p>
                            </div>
                            <button onClick={() => { setTransferStudent(null); setTransferTo(""); }} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><FaTimes size={14} /></button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Current Subject</p>
                                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-700 font-medium">{selSub?.code} — {selSub?.name}</div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Transfer To</p>
                                <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:outline-none">
                                    <option value="">Select new OE subject...</option>
                                    {otherSubs.map(s => <option key={s.id} value={s.id}>Y{s.year} S{s.semester} — {s.code} — {s.name}</option>)}
                                </select>
                            </div>
                            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                                ⚠️ This will <strong>remove</strong> the student from the current OE and <strong>enroll</strong> them in the new one automatically.
                            </div>
                        </div>
                        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                            <button onClick={() => { setTransferStudent(null); setTransferTo(""); }}
                                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                            <button onClick={handleTransfer} disabled={!transferTo || transferring}
                                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                                {transferring ? "Transferring..." : "Confirm Transfer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
                <div className="mx-auto max-w-7xl px-4 sm:px-6">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"><FaArrowLeft size={12} /> Back</button>
                            <div className="h-5 w-px bg-slate-200" />
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><FaLayerGroup size={14} /></div>
                                <div>
                                    <h1 className="text-base font-bold text-slate-900 leading-tight">OE Batch Division</h1>
                                    <p className="text-[10px] text-slate-500 leading-tight">Open Elective — Batch Allocation & Transfer</p>
                                </div>
                            </div>
                        </div>
                        {subjectId && students.length > 0 && (
                            <button onClick={handleSave} disabled={saving}
                                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold shadow-sm disabled:opacity-50 transition-all ${saved ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                                {saved ? <><FaCheckCircle /> Saved!</> : saving ? "Saving..." : <><FaSave /> Save Assignments</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                {/* Filters */}
                <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Year</label>
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none min-w-[110px]">
                            <option value="">All Years</option>
                            {["1","2","3","4"].map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Semester</label>
                        <select value={semFilter} onChange={e => setSemFilter(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none min-w-[130px]">
                            <option value="">All Semesters</option>
                            <option value="1">Semester 1</option>
                            <option value="2">Semester 2</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Open Elective Subject {subjectsLoading && <span className="normal-case font-normal text-slate-400 ml-1">Loading...</span>}
                        </label>
                        <select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={subjectsLoading || visibleSubjects.length === 0}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                            <option value="">{subjectsLoading ? "Loading..." : visibleSubjects.length === 0 ? "No OE subjects found" : "Choose a subject..."}</option>
                            {visibleSubjects.map(s => <option key={s.id} value={s.id}>Y{s.year} S{s.semester} — {s.code} — {s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Batch Summary Cards */}
                {subjectId && students.length > 0 && (
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Enrolled</p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">{students.length}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{selSub?.name}</p>
                        </div>
                        {BATCHES.map(bn => {
                            const c = BC[bn]; const isActive = batchFilter === bn;
                            return (
                                <button key={bn} onClick={() => setBatchFilter(isActive ? "All" : bn)}
                                    className={`rounded-xl border p-4 shadow-sm text-left transition-all ${isActive ? `${c.bg} ${c.border} ring-2 ring-offset-1` : "bg-white border-slate-200 hover:border-slate-300"}`}>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{bn}</p>
                                    <p className={`mt-1 text-2xl font-extrabold ${counts[bn] > 0 ? c.text : "text-slate-300"}`}>{counts[bn]}</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">students</p>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Main */}
                {loadingStudents ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-3">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                        <p className="text-sm text-slate-500">Loading enrolled students...</p>
                    </div>
                ) : !subjectId ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50"><FaLayerGroup className="h-9 w-9 text-indigo-400" /></div>
                        <h3 className="text-lg font-bold text-slate-700">Select a Subject to Begin</h3>
                        <p className="mt-2 text-sm text-slate-500 max-w-xs">Choose an open elective subject above. Year and Semester are optional filters.</p>
                        {!subjectsLoading && allSubjects.length === 0 && (
                            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 max-w-xs">
                                No elective subjects found. Create subjects with <strong>isElective = true</strong> in Subjects management first.
                            </p>
                        )}
                    </div>
                ) : students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100"><FaUserGraduate className="h-9 w-9 text-slate-400" /></div>
                        <h3 className="text-lg font-bold text-slate-700">No Students Enrolled</h3>
                        <p className="mt-2 text-sm text-slate-500 max-w-xs">No students are currently enrolled in this open elective.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Search + filters + bulk assignments */}
                        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="relative w-full md:w-80">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                    <input type="text" placeholder="Search roll no. or name..." value={search} onChange={e => setSearch(e.target.value)}
                                        className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all" />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Batch:</span>
                                    {["All", ...BATCHES, "Unassigned"].map(f => (
                                        <button key={f} onClick={() => setBatchFilter(f)}
                                            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${batchFilter === f ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                                            {f}{f !== "All" && <span className="ml-1 opacity-70">({counts[f] ?? 0})</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Department Filters */}
                            <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-3">
                                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Dept:</span>
                                <button
                                    onClick={() => setDeptFilter("All")}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${deptFilter === "All" ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                >
                                    All ({students.length})
                                </button>
                                {uniqueDepts.map(dept => (
                                    <button
                                        key={dept}
                                        onClick={() => setDeptFilter(dept)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${deptFilter === dept ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                    >
                                        {dept} ({deptCounts[dept] ?? 0})
                                    </button>
                                ))}
                            </div>

                            {/* Bulk Assignment Bar */}
                            {filtered.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50/50 border border-indigo-100 px-4 py-2 text-xs border-dashed">
                                    <span className="font-bold text-slate-700">Bulk Assign ({filtered.length} visible):</span>
                                    {BATCHES.map(bn => {
                                        const bc = BC[bn];
                                        return (
                                            <button
                                                key={bn}
                                                onClick={() => {
                                                    setSaved(false);
                                                    setBatches(prev => {
                                                        const updated = { ...prev };
                                                        filtered.forEach(s => {
                                                            updated[s.id] = bn;
                                                        });
                                                        return updated;
                                                    });
                                                }}
                                                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${bc.badge} hover:opacity-90 transition-all active:scale-95 shadow-sm`}
                                            >
                                                Assign All to {bn}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => {
                                            setSaved(false);
                                            setBatches(prev => {
                                                const updated = { ...prev };
                                                filtered.forEach(s => {
                                                    delete updated[s.id];
                                                });
                                                return updated;
                                            });
                                        }}
                                        className="rounded-lg px-2.5 py-1 text-[10px] font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition-all active:scale-95 shadow-sm"
                                    >
                                        Clear Visible
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Student Cards */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {filtered.map(student => {
                                const ab = batches[student.id] || null;
                                const col = ab ? BC[ab] : null;
                                return (
                                    <div key={student.id} className={`rounded-2xl border p-4 shadow-sm transition-all ${col ? `${col.bg} ${col.border}` : "bg-white border-slate-200 hover:border-slate-300"}`}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="min-w-0">
                                                <p className="font-mono text-sm font-bold text-slate-900 leading-tight">{student.rollNumber}</p>
                                                <p className="text-xs text-slate-600 mt-0.5 leading-tight truncate">{student.name}</p>
                                                {(student.department || student.section) && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{student.department?.code}{student.section ? `-${student.section.name}` : ""}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                                                <button onClick={() => { setTransferStudent(student); setTransferTo(""); }} title="Transfer to another OE"
                                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors">
                                                    <FaExchangeAlt size={8} />
                                                </button>
                                                {ab && (
                                                    <button onClick={() => clear(student.id)} title="Clear batch"
                                                        className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-colors">
                                                        <FaTimes size={8} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {BATCHES.map(bn => {
                                                const bc = BC[bn]; const isActive = ab === bn;
                                                return (
                                                    <button key={bn} onClick={() => assign(student.id, bn)}
                                                        className={`rounded-lg py-1 text-[11px] font-bold transition-all ${isActive ? `${bc.badge} shadow-sm scale-105` : "bg-white/80 text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-white"}`}>
                                                        {bn}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {filtered.length === 0 && <div className="py-16 text-center text-slate-400 text-sm">No students match your filter.</div>}

                        {/* Sticky Save Bar */}
                        <div className="sticky bottom-4 z-20 mt-6">
                            <div className="mx-auto max-w-md rounded-2xl border border-indigo-100 bg-white/95 backdrop-blur-md p-4 shadow-xl flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{Object.values(batches).filter(Boolean).length} of {students.length} assigned</p>
                                    <p className="text-xs text-slate-500">{counts["Unassigned"]} unassigned</p>
                                </div>
                                <button onClick={handleSave} disabled={saving}
                                    className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold shadow-md transition-all disabled:opacity-50 active:scale-95 ${saved ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                                    {saved ? <><FaCheckCircle /> Saved!</> : saving ? "Saving..." : <><FaSave /> Save Assignments</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
