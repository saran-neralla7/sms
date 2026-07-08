"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSearch, FaDownload, FaArrowLeft, FaFilter, FaUsers, FaBookOpen, FaRegClipboard } from "react-icons/fa";

interface SubjectChoice {
    id: string;
    code: string;
    name: string;
}

interface StudentReportRow {
    id: string;
    rollNumber: string;
    name: string;
    department: string;
    section: string;
    choices: Record<string, SubjectChoice>;
}

export default function ElectiveReportPage() {
    const { data: session } = useSession();
    const router = useRouter();

    // Data lists for filters
    const [batches, setBatches] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [academicYears, setAcademicYears] = useState<any[]>([]);

    // Filter values
    const [batchId, setBatchId] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [slotType, setSlotType] = useState("OE"); // "OE" | "PE" | "ALL"

    // Fetched report data
    const [students, setStudents] = useState<StudentReportRow[]>([]);
    const [electiveSlots, setElectiveSlots] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchFilterOptions();
    }, []);

    // Refetch data when filters change
    useEffect(() => {
        fetchReportData();
    }, [batchId, departmentId, year, semester, slotType]);

    const fetchFilterOptions = async () => {
        try {
            const [batchesRes, deptsRes, yearsRes] = await Promise.all([
                fetch("/api/batches"),
                fetch("/api/departments"),
                fetch("/api/academic-years")
            ]);

            if (batchesRes.ok) setBatches(await batchesRes.json());
            if (deptsRes.ok) {
                const deptsJson = await deptsRes.json();
                setDepartments(Array.isArray(deptsJson) ? deptsJson : (deptsJson.data || []));
            }
            if (yearsRes.ok) setAcademicYears(await yearsRes.json());
        } catch (error) {
            console.error("Failed to load filter options", error);
        }
    };

    const fetchReportData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (batchId) params.append("batchId", batchId);
            if (departmentId) params.append("departmentId", departmentId);
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            params.append("slotType", slotType);

            const res = await fetch(`/api/reports/open-electives?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                setStudents(json.students || []);
                setElectiveSlots(json.electiveSlots || []);
            }
        } catch (error) {
            console.error("Failed to fetch report data", error);
        } finally {
            setLoading(false);
        }
    };

    // Client-side search filter
    const filteredStudents = students.filter(student => {
        const name = student.name || "";
        const roll = student.rollNumber || "";
        const searchTerm = search.toLowerCase();
        return name.toLowerCase().includes(searchTerm) || roll.toLowerCase().includes(searchTerm);
    });

    // Subject statistics counter
    const getSubjectStats = () => {
        const stats: Record<string, { code: string; name: string; count: number }> = {};
        students.forEach(student => {
            Object.values(student.choices).forEach(subj => {
                if (!stats[subj.id]) {
                    stats[subj.id] = { code: subj.code, name: subj.name, count: 0 };
                }
                stats[subj.id].count += 1;
            });
        });
        return Object.values(stats).sort((a, b) => b.count - a.count);
    };

    const subjectStats = getSubjectStats();

    // Excel/CSV Export
    const handleExportCSV = () => {
        if (filteredStudents.length === 0) return;

        const headers = ["Roll Number", "Name", "Department", "Section", ...electiveSlots];
        const rows = filteredStudents.map(student => {
            const row = [
                student.rollNumber,
                student.name,
                student.department,
                student.section
            ];
            electiveSlots.forEach(slot => {
                const choice = student.choices[slot];
                row.push(choice ? `${choice.code} - ${choice.name}` : "Not Opted");
            });
            return row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
        });

        const csvString = [headers.join(","), ...rows].join("\r\n");
        const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${slotType}_Elective_Choices_Report_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mx-auto max-w-7xl p-6 pb-32">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button
                        onClick={() => router.push("/admin/electives")}
                        className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <FaArrowLeft /> Back to Enrollment Manager
                    </button>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                        Elective Choices Report
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        View and export student choices across open and professional elective slots.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredStudents.length === 0}
                        className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all ${
                            filteredStudents.length === 0
                                ? "bg-slate-300 cursor-not-allowed"
                                : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                        }`}
                    >
                        <FaDownload /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filter Dashboard Card */}
            <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-md p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b pb-2">
                    <FaFilter className="text-blue-500" /> Filters
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Batch
                        </label>
                        <select
                            value={batchId}
                            onChange={(e) => setBatchId(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        >
                            <option value="">All Batches</option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Department
                        </label>
                        <select
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Year
                        </label>
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        >
                            <option value="">All Years</option>
                            {["1", "2", "3", "4"].map(y => (
                                <option key={y} value={y}>
                                    Year {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Semester
                        </label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        >
                            <option value="">All Semesters</option>
                            <option value="1">Semester 1</option>
                            <option value="2">Semester 2</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Elective Type
                        </label>
                        <select
                            value={slotType}
                            onChange={(e) => setSlotType(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        >
                            <option value="OE">Open Elective (OE)</option>
                            <option value="PE">Professional Elective (PE)</option>
                            <option value="ALL">All Electives</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Quick Stats Summary */}
            {subjectStats.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-4 text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FaBookOpen className="text-violet-500" /> Choices Statistics Summary
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {subjectStats.map(stat => (
                            <div
                                key={stat.code}
                                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors"
                            >
                                <p className="text-xs font-bold text-slate-400 font-mono">{stat.code}</p>
                                <h4 className="text-sm font-bold text-slate-800 line-clamp-1 mt-0.5">{stat.name}</h4>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs text-slate-500 font-medium">Opted Count</span>
                                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-extrabold text-violet-600">
                                        {stat.count} {stat.count === 1 ? "student" : "students"}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Students Table Section */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
                    <div className="relative w-full sm:w-72">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by Roll No or Name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-full border border-slate-200 bg-white py-1.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                        />
                    </div>
                    <span className="text-sm text-slate-500 font-semibold flex items-center gap-1.5">
                        <FaUsers className="text-slate-400" /> Total Mapped: {filteredStudents.length} of {students.length} students
                    </span>
                </div>

                {loading ? (
                    <div className="py-24 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                        <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></span>
                        <p className="text-sm font-semibold mt-2">Loading choices report...</p>
                    </div>
                ) : filteredStudents.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <th className="p-4">Roll Number</th>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Department</th>
                                    <th className="p-4">Section</th>
                                    {electiveSlots.map(slot => (
                                        <th key={slot} className="p-4">
                                            {slot}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="p-4 font-mono font-bold text-slate-900">{student.rollNumber}</td>
                                        <td className="p-4 text-slate-700 font-medium">{student.name}</td>
                                        <td className="p-4 text-slate-500 font-medium">{student.department}</td>
                                        <td className="p-4 text-slate-500 font-medium">{student.section}</td>
                                        {electiveSlots.map(slot => {
                                            const choice = student.choices[slot];
                                            return (
                                                <td key={slot} className="p-4">
                                                    {choice ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-xs font-bold text-indigo-600">
                                                                {choice.code}
                                                            </span>
                                                            <span className="text-xs text-slate-600 font-medium mt-0.5 line-clamp-1 max-w-[200px]">
                                                                {choice.name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic font-normal">
                                                            Not Opted
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-24 text-center text-slate-500">
                        <FaRegClipboard size={40} className="mx-auto text-slate-300 mb-3" />
                        <p className="font-semibold text-slate-600">No student records found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting the filter options above.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
