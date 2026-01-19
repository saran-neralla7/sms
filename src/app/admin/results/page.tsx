"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import { FaFileUpload, FaDownload, FaFilter, FaSearch, FaExclamationTriangle } from "react-icons/fa";

export default function ResultsPage() {
    const { data: session } = useSession();
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [departments, setDepartments] = useState<any[]>([]);

    // Upload State
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [uploadData, setUploadData] = useState<any[]>([]);
    const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    useEffect(() => {
        if (session?.user.role === "ADMIN") {
            fetchDepartments();
        }
    }, [session]);

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

    const downloadTemplate = () => {
        const rows = [
            { "Roll Number": "3111XXXXX", "Name": "Student Name", "CS4101": "O", "CS4102": "A+", "SGPA": "9.5", "CGPA": "8.8" },
            { "Roll Number": "3111XXXXY", "Name": "Another Student", "CS4101": "A", "CS4102": "A", "SGPA": "8.5", "CGPA": "8.0" }
        ];
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "Results_Template.xlsx");
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
                    <button onClick={downloadTemplate} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="py-12 text-center text-slate-500">Loading results...</div>
                    ) : results.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">No results found for selected filters.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="p-4 font-semibold text-slate-700">Roll Number</th>
                                        <th className="p-4 font-semibold text-slate-700">Name</th>
                                        <th className="p-4 font-semibold text-slate-700">SGPA</th>
                                        <th className="p-4 font-semibold text-slate-700">CGPA</th>
                                        <th className="p-4 font-semibold text-slate-700 text-right">Grades</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {results.map((res) => (
                                        <tr key={res.id} className="hover:bg-slate-50/50">
                                            <td className="p-4 font-medium text-slate-900">{res.student?.rollNumber}</td>
                                            <td className="p-4 text-slate-600">{res.student?.name}</td>
                                            <td className="p-4 font-mono font-bold text-slate-800">{res.sgpa}</td>
                                            <td className="p-4 font-mono text-slate-800">{res.cgpa}</td>
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
                    )}
                </div>
            )}
        </div>
    );
}
