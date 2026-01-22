"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import { FaFileUpload, FaDownload, FaFilter, FaSearch, FaExclamationTriangle, FaTimes, FaCheckSquare, FaSquare } from "react-icons/fa";

export default function ResultsPage() {
    const { data: session } = useSession();
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [departments, setDepartments] = useState<any[]>([]);
    const [regulations, setRegulations] = useState<any[]>([]);

    // Template Modal State
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [isPastResults, setIsPastResults] = useState(false);
    const [templateCtx, setTemplateCtx] = useState({
        departmentId: "", year: "", semester: "", studentYear: "", regulation: "", sectionIds: [] as string[]
    });
    const [availableSections, setAvailableSections] = useState<any[]>([]);

    useEffect(() => {
        if (templateCtx.departmentId) {
            fetch(`/api/sections?departmentId=${templateCtx.departmentId}`)
                .then(res => res.json())
                .then(data => setAvailableSections(data));
        } else {
            setAvailableSections([]);
        }
    }, [templateCtx.departmentId]);

    // Upload State
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [uploadData, setUploadData] = useState<any[]>([]);
    const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    useEffect(() => {
        if (session?.user.role === "ADMIN") {
            fetchDepartments();
            fetchRegulations();
        }
    }, [session]);

    const fetchRegulations = async () => {
        try {
            const res = await fetch("/api/regulations");
            if (res.ok) setRegulations(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!isUploadMode) {
            fetchResults();
        }
    }, [year, semester, departmentId, isUploadMode]);

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchResults = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (departmentId) params.append("departmentId", departmentId);

            const res = await fetch(`/api/results?${params}`);
            if (res.ok) setResults(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            processUploadData(data);
        };
        reader.readAsBinaryString(file);
    };

    const processUploadData = (data: any[]) => {
        // Expected columns: "Roll Number", "SGPA", "CGPA", ...Subjects (Codes)
        // We need to transform this into the JSON structure expected by API
        // grades: [{ subjectCode: "CS101", grade: "O" }]

        const processed = data.map((row: any) => {
            const rollNumber = row["Roll Number"] || row["RollNumber"] || row["Roll No"];
            if (!rollNumber) return null;

            const sgpa = row["SGPA"];
            const cgpa = row["CGPA"];

            // Extract grades (keys that are NOT Roll Number, SGPA, CGPA, Name)
            const grades: any[] = [];
            Object.keys(row).forEach(key => {
                const upperKey = key.toUpperCase();
                if (["ROLL NUMBER", "ROLL NO", "ROLLNUMBER", "NAME", "STUDENT NAME", "SGPA", "CGPA", "S.NO"].includes(upperKey)) {
                    return;
                }
                // Assume Column Name IS Subject Code
                grades.push({
                    subjectCode: key,
                    grade: row[key] // The value at that cell is the grade
                });
            });

            return {
                rollNumber,
                year, // Taken from filter context (User must select Year/Sem before upload to be safe)
                semester,
                sgpa: String(sgpa || ""),
                cgpa: String(cgpa || ""),
                grades
            };
        }).filter(Boolean);

        setUploadData(processed);
        setIsUploadMode(true);
    };

    const handleUploadSubmit = async () => {
        if (!year || !semester) {
            alert("Please select Year and Semester context for this upload.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(uploadData.map(d => ({ ...d, year, semester })))
            });

            const result = await res.json();
            if (result.success !== undefined) {
                setUploadStatus({ type: "success", message: `Uploaded ${result.success} records. ${result.failed} failed.` });
                setTimeout(() => {
                    setIsUploadMode(false);
                    setUploadData([]);
                    setUploadStatus({ type: null, message: "" });
                    fetchResults();
                }, 2000);
            } else {
                setUploadStatus({ type: "error", message: "Upload failed." });
            }
        } catch (e) {
            setUploadStatus({ type: "error", message: "Error uploading." });
        } finally {
            setLoading(false);
        }
    };

    const generateSmartTemplate = async () => {
        if (!templateCtx.departmentId || !templateCtx.year || !templateCtx.semester) {
            alert("Please select Department, Year and Semester");
            return;
        }

        if (isPastResults && !templateCtx.studentYear) {
            alert("Please select the 'Target Student Batch' (Current Year of the students).");
            return;
        }

        const params = new URLSearchParams();
        params.set("departmentId", templateCtx.departmentId);
        params.set("year", templateCtx.year);
        params.set("semester", templateCtx.semester);
        params.set("regulation", templateCtx.regulation);
        if (templateCtx.sectionIds.length > 0) {
            params.set("sectionIds", templateCtx.sectionIds.join(","));
        }
        if (isPastResults && templateCtx.studentYear) {
            params.set("studentYear", templateCtx.studentYear);
        }

        try {
            const res = await fetch(`/api/results/template?${params}`);
            if (!res.ok) throw new Error("Failed to generate");

            const data = await res.json();

            const ws = XLSX.utils.json_to_sheet(data.rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Marks");
            XLSX.writeFile(wb, `Results_Template_${templateCtx.year}_${templateCtx.semester}.xlsx`);

            setShowTemplateModal(false);
        } catch (e) {
            alert("Failed to generate template");
        }
    };

    const exportData = () => {
        if (results.length === 0) return;

        const rows = results.map(r => {
            const row: any = {
                "Roll Number": r.student?.rollNumber,
                "Name": r.student?.name,
                "Year": r.year,
                "Semester": r.semester,
                "SGPA": r.sgpa,
                "CGPA": r.cgpa
            };
            (r.grades as any[]).forEach((g: any) => {
                row[g.subjectCode] = g.grade;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, `Results_${year || 'All'}_${semester || 'All'}.xlsx`);
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Semester Results</h1>
                    <p className="text-slate-500">Upload and manage student results.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportData} disabled={results.length === 0} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        <FaDownload /> Export Data
                    </button>
                    <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <FaDownload /> Template
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-md transition-all">
                        <FaFileUpload /> Upload Excel
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                    <FaFilter /> <span className="text-sm font-medium">Filter:</span>
                </div>
                {session?.user.role === "ADMIN" && (
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                )}
                <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                    <option value="">Select Year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                    <option value="">Select Sem</option>
                    <option value="1">1st Sem</option>
                    <option value="2">2nd Sem</option>
                </select>
            </div>

            {uploadStatus.message && (
                <div className={`mb-6 rounded-lg p-4 text-sm font-medium ${uploadStatus.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {uploadStatus.message}
                </div>
            )}

            {isUploadMode ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-bold text-blue-900">Review Upload ({uploadData.length} records)</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsUploadMode(false)} className="px-4 py-2 text-sm text-blue-600 hover:underline">Cancel</button>
                            <button onClick={handleUploadSubmit} disabled={loading} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                {loading ? "Uploading..." : "Confirm Upload"}
                            </button>
                        </div>
                    </div>

                    {!year || !semester ? (
                        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded border border-amber-200 mb-4">
                            <FaExclamationTriangle /> Please select Year and Semester from the filters above to assign context to these results.
                        </div>
                    ) : null}

                    <div className="max-h-96 overflow-auto rounded-lg border border-blue-200 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-700">Roll No</th>
                                    <th className="p-3 font-semibold text-slate-700">SGPA</th>
                                    <th className="p-3 font-semibold text-slate-700">CGPA</th>
                                    <th className="p-3 font-semibold text-slate-700">Subjects Found</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {uploadData.slice(0, 50).map((row, i) => (
                                    <tr key={i}>
                                        <td className="p-3">{row.rollNumber}</td>
                                        <td className="p-3 font-mono">{row.sgpa}</td>
                                        <td className="p-3 font-mono">{row.cgpa}</td>
                                        <td className="p-3 text-xs text-slate-500">
                                            {row.grades.map((g: any) => g.subjectCode).join(", ")}
                                        </td>
                                    </tr>
                                ))}
                                {uploadData.length > 50 && (
                                    <tr><td colSpan={4} className="p-3 text-center text-slate-500">...and {uploadData.length - 50} more</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Results View */
                <div className="space-y-6">
                    {loading ? (
                        <div className="py-12 text-center text-slate-500">Loading results...</div>
                    ) : results.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">No results found for selected filters.</div>
                    ) : (

                        // Summary Cards by Section
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from(new Set(results.map(r => r.student?.section?.name || "Unknown"))).sort().map(sectionName => {
                                const sectionResults = results.filter(r => (r.student?.section?.name || "Unknown") === sectionName);
                                const avgSGPA = (sectionResults.reduce((acc, r) => acc + (Number(r.sgpa) || 0), 0) / sectionResults.length).toFixed(2);

                                // get batch and department from first student in this section
                                const batchString = sectionResults[0]?.student?.batch || "Unknown Batch";
                                const deptName = sectionResults[0]?.student?.department?.name || "Unknown Dept"; // Get Dept Name

                                // Get Exam Context from result data (fallback if filters are empty)
                                const resultYear = sectionResults[0]?.year || year || "?";
                                const resultSem = sectionResults[0]?.semester || semester || "?";
                                const formattedYear = resultYear === "1" ? "1st" : resultYear === "2" ? "2nd" : resultYear === "3" ? "3rd" : resultYear + "th";
                                const formattedSem = resultSem === "1" ? "1st" : resultSem === "2" ? "2nd" : resultSem + "th";

                                return (
                                    <div key={sectionName} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex flex-col mb-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-bold text-slate-800">Section {sectionName} <span className="text-sm font-medium text-slate-500">({deptName})</span></h3>
                                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{sectionResults.length} Students</span>
                                            </div>
                                            <p className="text-xs font-medium text-slate-500 mt-1">
                                                {batchString} Batch • {formattedYear} Year {formattedSem} Sem
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => document.getElementById(`results-table-${sectionName}`)?.classList.toggle("hidden")}
                                            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                        >
                                            View / Hide Results
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Collapsible Tables per Section */}
                    {Array.from(new Set(results.map(r => r.student?.section?.name || "Unknown"))).sort().map(sectionName => (
                        <div id={`results-table-${sectionName}`} key={sectionName} className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-4">
                            <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
                                <h4 className="font-bold text-slate-700">Section {sectionName} Results</h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                        <tr>
                                            <th className="p-4 font-semibold">Roll Number</th>
                                            <th className="p-4 font-semibold">Name</th>
                                            <th className="p-4 font-semibold">SGPA</th>
                                            <th className="p-4 font-semibold">CGPA</th>
                                            <th className="p-4 font-semibold text-right">Grades</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {results.filter(r => (r.student?.section?.name || "Unknown") === sectionName).map((res) => (
                                            <tr key={res.id} className="hover:bg-slate-50/50">
                                                <td className="p-4 font-medium text-slate-900">{res.student?.rollNumber}</td>
                                                <td className="p-4 text-slate-600">{res.student?.name}</td>
                                                <td className="p-4 font-mono font-bold text-slate-800">{Number(res.sgpa).toFixed(2)}</td>
                                                <td className="p-4 font-mono text-slate-800">{Number(res.cgpa).toFixed(2)}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-1 flex-wrap">
                                                        {(res.grades as any[]).map((g: any, i: number) => (
                                                            <span key={i} className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">
                                                                <span className="font-bold mr-1">{g.subjectCode}:</span> {g.grade}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {/* Template Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Download Smart Template</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><FaTimes /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    value={templateCtx.departmentId}
                                    onChange={e => setTemplateCtx({ ...templateCtx, departmentId: e.target.value })}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        value={templateCtx.year}
                                        onChange={e => setTemplateCtx({ ...templateCtx, year: e.target.value })}
                                    >
                                        <option value="">Select Year</option>
                                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        value={templateCtx.semester}
                                        onChange={e => setTemplateCtx({ ...templateCtx, semester: e.target.value })}
                                    >
                                        <option value="">Select Sem</option>
                                        {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Regulation</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    value={templateCtx.regulation}
                                    onChange={e => setTemplateCtx({ ...templateCtx, regulation: e.target.value })}
                                >
                                    <option value="">Select Regulation</option>
                                    {regulations.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Past Results Toggle */}
                        <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <label className="flex items-center gap-2 text-sm font-semibold text-amber-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-amber-600 rounded"
                                    checked={isPastResults}
                                    onChange={e => setIsPastResults(e.target.checked)}
                                />
                                Is this for Past Results / Backlogs?
                            </label>
                        </div>

                        {/* Conditionally Show Student Year */}
                        {isPastResults && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Target Student Batch (Current Year)</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-amber-50/50"
                                    value={templateCtx.studentYear}
                                    onChange={e => setTemplateCtx({ ...templateCtx, studentYear: e.target.value })}
                                >
                                    <option value="">Select Current Student Year</option>
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">E.g., Select '3' if you want 3rd years to take a 2nd year exam.</p>
                            </div>
                        )}

                        {/* Section Multi-Select */}
                        {availableSections.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sections (Select Specific or All)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            if (templateCtx.sectionIds.length === availableSections.length) {
                                                setTemplateCtx({ ...templateCtx, sectionIds: [] });
                                            } else {
                                                setTemplateCtx({ ...templateCtx, sectionIds: availableSections.map(s => s.id) });
                                            }
                                        }}
                                        className="mr-2 text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                        {templateCtx.sectionIds.length === availableSections.length ? "Deselect All" : "Select All"}
                                    </button>
                                    {availableSections.map(sec => {
                                        const isSelected = templateCtx.sectionIds.includes(sec.id);
                                        return (
                                            <button
                                                key={sec.id}
                                                onClick={() => {
                                                    const newIds = isSelected
                                                        ? templateCtx.sectionIds.filter(id => id !== sec.id)
                                                        : [...templateCtx.sectionIds, sec.id];
                                                    setTemplateCtx({ ...templateCtx, sectionIds: newIds });
                                                }}
                                                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm border ${isSelected ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                                            >
                                                {isSelected ? <FaCheckSquare className="text-blue-500" /> : <FaSquare className="text-slate-300" />}
                                                {sec.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-2">
                            <button onClick={() => setShowTemplateModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button
                                onClick={generateSmartTemplate}
                                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                            >
                                Download Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* End Template Modal */}
        </div >
    );
}
