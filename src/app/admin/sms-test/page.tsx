"use client";

import { useState } from "react";
import { FaPaperPlane, FaPlus, FaTrash, FaCheckCircle, FaTimesCircle, FaMobileAlt, FaIdCard, FaUser } from "react-icons/fa";

interface TestCase {
    id: number;
    mobile: string;
    rollNumber: string;
    name: string;
}

interface TestResult {
    mobile: string;
    rollNumber: string;
    name: string;
    success: boolean;
    response: string;
    urlSent: string;
}

export default function SMSTestPage() {
    const [selectedTemplate, setSelectedTemplate] = useState<"attendance" | "marks">("attendance");
    const [testCases, setTestCases] = useState<TestCase[]>([
        { id: Date.now(), mobile: "", rollNumber: "", name: "" }
    ]);
    const [marksFields, setMarksFields] = useState({
        studentName: "",
        rollNumber: "",
        year: "",
        semester: "",
        subject1: "", marks1: "",
        subject2: "", marks2: "",
        subject3: "", marks3: "",
        subject4: "", marks4: "",
        subject5: "", marks5: "",
    });

    // As seen in user's image, there are multiple IDs. We will let the user try them if needed.
    const [templateId, setTemplateId] = useState("1707173598509565396");

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<TestResult[] | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    const addTestCase = () => {
        setTestCases(prev => [
            ...prev,
            { id: Date.now(), mobile: "", rollNumber: "", name: "" }
        ]);
    };

    const removeTestCase = (id: number) => {
        if (testCases.length > 1) {
            setTestCases(prev => prev.filter(tc => tc.id !== id));
        }
    };

    const updateTestCase = (id: number, field: keyof TestCase, value: string) => {
        setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));
    };

    const handleTestSubmit = async () => {
        // Validation
        const validCases = testCases.filter(tc => tc.mobile.trim() !== "");
        if (validCases.length === 0) {
            setErrorMsg("Please enter at least one mobile number.");
            return;
        }

        setLoading(true);
        setErrorMsg("");
        setResults(null);

        try {
            const payload = selectedTemplate === "marks" ? {
                testCases: validCases.map(tc => ({
                    mobile: tc.mobile,
                    message: `Dear Parent,
Your ward ${marksFields.studentName || "Var1"},
${marksFields.year || "Var2"} Year ${marksFields.semester || "Var3"} sem ${marksFields.rollNumber || "Var4"} Mid
Examination marks are as
follows:
subject 1:${marksFields.subject1 || "Var5"} Marks:
${marksFields.marks1 || "Var6"}
subject 2:${marksFields.subject2 || "Var7"}
Marks: ${marksFields.marks2 || "Var8"}
subject 3:${marksFields.subject3 || "Var9"} Marks:
${marksFields.marks3 || "Var10"}
subject 4:${marksFields.subject4 || "Var11"} Marks:
${marksFields.marks4 || "Var12"}
subject 5:${marksFields.subject5 || "Var13"} Marks: ${marksFields.marks5 || "Var14"}
Please Contact HOD for any
queries.
Gayatri Vidya Parishad`
                })),
                templateId: templateId.trim()
            } : {
                testCases: validCases,
                templateId: templateId.trim()
            };

            const res = await fetch("/api/test-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                setResults(data.results);
            } else {
                setErrorMsg(data.error || "Failed to send SMS test.");
            }
        } catch (error: any) {
            setErrorMsg(error.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">PlatinumSMS API Tester</h1>
                    <p className="text-sm text-slate-500">
                        Test the specific Attendance DLT template before integrating it into bulk operations.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-blue-900 mb-4 tracking-tight">Message Configuration</h2>

                        <div className="mb-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedTemplate("attendance");
                                    setTemplateId("1707173598509565396");
                                }}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                    selectedTemplate === "attendance" ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-100/50"
                                }`}
                            >
                                Attendance Alert
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedTemplate("marks");
                                    setTemplateId("1707177545746041134");
                                }}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                    selectedTemplate === "marks" ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-100/50"
                                }`}
                            >
                                Mid Marks Alert
                            </button>
                        </div>

                        <div className="mb-6 space-y-1">
                            <label className="text-sm font-semibold text-blue-800">DLT Template ID (Optional but Recommended)</label>
                            <input
                                type="text"
                                value={templateId}
                                onChange={(e) => setTemplateId(e.target.value)}
                                placeholder="e.g. 1707173598509565396"
                                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                            <p className="text-xs text-blue-600 mt-1">If the SMS provider strictly requires this value for DLT approval.</p>
                        </div>

                        {selectedTemplate === "attendance" ? (
                            <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-inner">
                                <p className="text-sm text-slate-700 italic">
                                    "Dear Parent, Your ward Roll No: <span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{"{#var#}"}</span> Name: <span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{"{#var#}"}</span> is Absent for today's first hour. Regards, GAYATRI VIDYA PARISHAD COLLEGE"
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-inner">
                                    <p className="text-xs text-slate-700 italic whitespace-pre-wrap">
{`Dear Parent,
Your ward `}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.studentName || "Var1"}</span>{`,
`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.year || "Var2"}</span>{` Year `}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.semester || "Var3"}</span>{` sem `}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.rollNumber || "Var4"}</span>{` Mid
Examination marks are as
follows:
subject 1:`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.subject1 || "Var5"}</span>{` Marks:
`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.marks1 || "Var6"}</span>{`
subject 2:`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.subject2 || "Var7"}</span>{`
Marks: `}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.marks2 || "Var8"}</span>{`
subject 3:`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.subject3 || "Var9"}</span>{` Marks:
`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.marks3 || "Var10"}</span>{`
subject 4:`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.subject4 || "Var11"}</span>{` Marks:
`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.marks4 || "Var12"}</span>{`
subject 5:`}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.subject5 || "Var13"}</span>{` Marks: `}<span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{marksFields.marks5 || "Var14"}</span>{`
Please Contact HOD for any
queries.
Gayatri Vidya Parishad`}
                                    </p>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Student & Class Information</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Ward Name (Var 1)</label>
                                            <input
                                                type="text"
                                                value={marksFields.studentName}
                                                onChange={(e) => setMarksFields({ ...marksFields, studentName: e.target.value })}
                                                placeholder="e.g. John Doe"
                                                className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Roll Number (Var 2)</label>
                                            <input
                                                type="text"
                                                value={marksFields.rollNumber}
                                                onChange={(e) => setMarksFields({ ...marksFields, rollNumber: e.target.value })}
                                                placeholder="e.g. 22131A0501"
                                                className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Year (Var 3)</label>
                                            <input
                                                type="text"
                                                value={marksFields.year}
                                                onChange={(e) => setMarksFields({ ...marksFields, year: e.target.value })}
                                                placeholder="e.g. 1st"
                                                className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Semester (Var 4)</label>
                                            <input
                                                type="text"
                                                value={marksFields.semester}
                                                onChange={(e) => setMarksFields({ ...marksFields, semester: e.target.value })}
                                                placeholder="e.g. 2nd"
                                                className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pt-2 border-t border-slate-100">Subject Marks (Max 5)</h3>
                                    <div className="space-y-2">
                                        {[1, 2, 3, 4, 5].map((num) => {
                                            const subKey = `subject${num}` as keyof typeof marksFields;
                                            const marksKey = `marks${num}` as keyof typeof marksFields;
                                            return (
                                                <div key={num} className="grid grid-cols-3 gap-3 items-center">
                                                    <span className="text-xs font-semibold text-slate-600">Subject {num} (Vars {num*2 + 3}, {num*2 + 4})</span>
                                                    <input
                                                        type="text"
                                                        value={marksFields[subKey]}
                                                        onChange={(e) => setMarksFields({ ...marksFields, [subKey]: e.target.value })}
                                                        placeholder="Subject Name"
                                                        className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={marksFields[marksKey]}
                                                        onChange={(e) => setMarksFields({ ...marksFields, [marksKey]: e.target.value })}
                                                        placeholder="Marks"
                                                        className="w-full rounded border border-slate-300 p-1.5 text-xs outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Test Mobile Numbers</h2>
                            <button
                                onClick={addTestCase}
                                className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                                <FaPlus size={12} /> Add Row
                            </button>
                        </div>

                        <div className="space-y-3">
                            {testCases.map((tc, index) => (
                                <div key={tc.id} className="flex flex-col sm:flex-row gap-3 items-end p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                    <div className={selectedTemplate === "marks" ? "w-full" : "w-full sm:w-1/3"}>
                                        <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1"><FaMobileAlt /> Mobile No</label>
                                        <input
                                            type="text"
                                            value={tc.mobile}
                                            onChange={(e) => updateTestCase(tc.id, "mobile", e.target.value)}
                                            placeholder="Ex: 9912345678"
                                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    {selectedTemplate === "attendance" && (
                                        <>
                                            <div className="w-full sm:w-1/3">
                                                <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1"><FaIdCard /> Roll No (Var 1)</label>
                                                <input
                                                    type="text"
                                                    value={tc.rollNumber}
                                                    onChange={(e) => updateTestCase(tc.id, "rollNumber", e.target.value)}
                                                    placeholder="Ex: 22131A0501"
                                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="w-full sm:w-1/3">
                                                <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1"><FaUser /> Name (Var 2)</label>
                                                <input
                                                    type="text"
                                                    value={tc.name}
                                                    onChange={(e) => updateTestCase(tc.id, "name", e.target.value)}
                                                    placeholder="Ex: John Doe"
                                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="pb-1">
                                        <button
                                            onClick={() => removeTestCase(tc.id)}
                                            disabled={testCases.length === 1}
                                            className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                                            title="Remove Row"
                                        >
                                            <FaTrash size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {errorMsg && (
                            <div className="mt-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-100 flex items-center gap-2">
                                <FaTimesCircle /> {errorMsg}
                            </div>
                        )}

                        <div className="mt-6 border-t border-slate-100 pt-5">
                            <button
                                onClick={handleTestSubmit}
                                disabled={loading}
                                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70 transition-all"
                            >
                                {loading ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                        Sending Tests...
                                    </>
                                ) : (
                                    <>
                                        <FaPaperPlane /> Fire Test SMS
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-1">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sticky top-6 h-[calc(100vh-8rem)] flex flex-col">
                        <h2 className="text-lg font-semibold text-slate-900 mb-4 tracking-tight border-b border-slate-100 pb-3">Test Results</h2>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                            {!results && !loading && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center space-y-3 p-4">
                                    <FaMobileAlt size={32} className="opacity-50" />
                                    <p className="text-sm">Submit tests to see the gateway response here.</p>
                                </div>
                            )}

                            {loading && (
                                <div className="h-full flex flex-col items-center justify-center text-blue-500 space-y-3">
                                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                                    <p className="text-sm font-medium animate-pulse">Waiting for gateway...</p>
                                </div>
                            )}

                            {results && results.map((res, i) => (
                                <div key={i} className={`p-3 rounded-lg border text-sm ${res.success ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                            {res.success ? <FaCheckCircle className="text-green-500" /> : <FaTimesCircle className="text-red-500" />}
                                            {res.mobile}
                                        </div>
                                    </div>

                                    {selectedTemplate === "attendance" && (
                                        <div className="text-xs text-slate-600 mb-2 space-y-1">
                                            <div><span className="font-medium">Roll:</span> {res.rollNumber || "N/A"}</div>
                                            <div><span className="font-medium">Name:</span> {res.name || "N/A"}</div>
                                        </div>
                                    )}

                                    <div className="mt-2 pt-2 border-t border-black/5">
                                        <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Gateway Dump</div>
                                        <div className={`p-2 rounded bg-white/60 font-mono text-xs overflow-x-auto whitespace-pre-wrap ${res.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {res.response || "No response received"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
