
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import LogoSpinner from "@/components/LogoSpinner";
import { FaLayerGroup, FaPlus, FaTrash, FaUserCheck, FaSave, FaUsers, FaArrowRight } from "react-icons/fa";

interface Student {
    id: string;
    rollNumber: string;
    name: string;
    labBatchId: string | null;
}

interface LabBatch {
    id: string;
    name: string;
    _count: { students: number };
}

export default function LabBatchesPage() {
    const { data: session, status } = useSession();

    // Filters
    const [departments, setDepartments] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [selectedDept, setSelectedDept] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [selectedSection, setSelectedSection] = useState("");

    // Data
    const [batches, setBatches] = useState<LabBatch[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);

    // Actions
    const [newBatchName, setNewBatchName] = useState("");
    const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
    const [targetBatchId, setTargetBatchId] = useState("");

    useEffect(() => {
        fetch("/api/departments").then(res => res.json()).then(setDepartments);
    }, []);

    useEffect(() => {
        if (selectedDept) {
            fetch(`/api/sections?departmentId=${selectedDept}`).then(res => res.json()).then(setSections);
        }
    }, [selectedDept]);

    const fetchData = async () => {
        if (!selectedSection) return;
        setLoading(true);
        try {
            // Fetch Batches
            const batchRes = await fetch(`/api/sections/${selectedSection}/batches?departmentId=${selectedDept}&year=${year}&semester=${semester}`);
            const batchData = await batchRes.json();
            setBatches(batchData.batches || []);

            // Fetch Students (Need all students in section)
            const studentRes = await fetch(`/api/students?departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}&limit=-1`);
            const studentData = await studentRes.json();
            setStudents(studentData.data || []);

            setSelectedStudents(new Set()); // Reset selection
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedSection) fetchData();
        else {
            setBatches([]);
            setStudents([]);
        }
    }, [selectedSection, year, semester, selectedDept]); // Re-fetch if context changes

    const createBatch = async () => {
        if (!newBatchName.trim()) return;
        try {
            const res = await fetch(`/api/sections/${selectedSection}/batches`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newBatchName,
                    departmentId: selectedDept,
                    year,
                    semester
                })
            });
            if (res.ok) {
                setNewBatchName("");
                fetchData();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (e) { console.error(e); }
    };

    const deleteBatch = async (id: string) => {
        if (!confirm("Delete this batch? Students will be unassigned.")) return;
        try {
            const res = await fetch(`/api/sections/${selectedSection}/batches/${id}`, { method: "DELETE" });
            if (res.ok) fetchData();
        } catch (e) { console.error(e); }
    };

    const assignStudents = async () => {
        if (selectedStudents.size === 0) return;
        // targetBatchId can be "" (Unassign) or specific ID

        try {
            const res = await fetch(`/api/sections/${selectedSection}/batches/assign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentIds: Array.from(selectedStudents),
                    labBatchId: targetBatchId || null
                })
            });
            if (res.ok) {
                alert("Students updated successfully!");
                fetchData();
            } else {
                alert("Failed to update");
            }
        } catch (e) { console.error(e); }
    };

    const toggleStudent = (id: string) => {
        const newSet = new Set(selectedStudents);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedStudents(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedStudents.size === students.length) {
            setSelectedStudents(new Set());
        } else {
            setSelectedStudents(new Set(students.map(s => s.id)));
        }
    };

    if (status === "loading") return <LogoSpinner />;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="mb-6 text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FaLayerGroup className="text-violet-600" /> Lab Batch Management
            </h1>

            {/* SELECTION BAR */}
            <div className="grid gap-4 md:grid-cols-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Department</label>
                    <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="w-full mt-1 border rounded-md p-2 text-sm">
                        <option value="">Select Dept</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Year</label>
                    <select value={year} onChange={e => setYear(e.target.value)} className="w-full mt-1 border rounded-md p-2 text-sm">
                        <option value="">Select Year</option>
                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Semester</label>
                    <select value={semester} onChange={e => setSemester(e.target.value)} className="w-full mt-1 border rounded-md p-2 text-sm">
                        <option value="">Select Sem</option>
                        {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Section</label>
                    <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="w-full mt-1 border rounded-md p-2 text-sm">
                        <option value="">Select Section</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedSection && (
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* BATCH LIST */}
                    <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                        <h2 className="font-bold text-lg mb-4 text-slate-800">Batches</h2>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="New Batch Name"
                                value={newBatchName}
                                onChange={e => setNewBatchName(e.target.value)}
                                className="flex-1 border rounded-md px-3 py-2 text-sm"
                            />
                            <button onClick={createBatch} className="bg-violet-600 text-white rounded-md px-3 hover:bg-violet-700">
                                <FaPlus />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {batches.length === 0 && <p className="text-xs text-slate-400 italic">No batches created.</p>}
                            {batches.map(b => (
                                <div key={b.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div>
                                        <p className="font-semibold text-sm text-slate-800">{b.name}</p>
                                        <p className="text-xs text-slate-500">{b._count.students} assigned</p>
                                    </div>
                                    <button onClick={() => deleteBatch(b.id)} className="text-red-500 hover:text-red-700 text-sm">
                                        <FaTrash />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ASSIGNMENT AREA */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg text-slate-800">Assign Students</h2>
                            <div className="flex items-center gap-2">
                                <select
                                    value={targetBatchId}
                                    onChange={e => setTargetBatchId(e.target.value)}
                                    className="border rounded-md px-3 py-2 text-sm min-w-[150px]"
                                >
                                    <option value="">Unassign / No Batch</option>
                                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <button
                                    onClick={assignStudents}
                                    disabled={selectedStudents.size === 0}
                                    className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                                >
                                    Move Selected <FaArrowRight />
                                </button>
                            </div>
                        </div>

                        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                            <input type="checkbox" checked={selectedStudents.size === students.length && students.length > 0} onChange={toggleSelectAll} id="selectAll" />
                            <label htmlFor="selectAll">Select All</label>
                            <span className="ml-4">{selectedStudents.size} selected</span>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                                    <tr>
                                        <th className="p-3 w-10"></th>
                                        <th className="p-3">Roll Number</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Current Batch</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-4 text-center text-slate-500">Loading...</td></tr>
                                    ) : (
                                        students.map(s => {
                                            const batchName = batches.find(b => b.id === s.labBatchId)?.name;
                                            return (
                                                <tr key={s.id} className="hover:bg-slate-50">
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudents.has(s.id)}
                                                            onChange={() => toggleStudent(s.id)}
                                                        />
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-700">{s.rollNumber}</td>
                                                    <td className="p-3 text-slate-600">{s.name}</td>
                                                    <td className="p-3">
                                                        {batchName ? (
                                                            <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded textxs font-bold">{batchName}</span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">-</span>
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
                </div>
            )}
        </div>
    );
}
