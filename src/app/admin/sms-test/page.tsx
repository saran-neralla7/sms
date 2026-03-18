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
    const [testCases, setTestCases] = useState<TestCase[]>([
        { id: Date.now(), mobile: "", rollNumber: "", name: "" }
    ]);

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
            const res = await fetch("/api/test-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testCases: validCases,
                    templateId: templateId.trim()
                })
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

                        <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-inner">
                            <p className="text-sm text-slate-700 italic">
                                "Dear Parent, Your ward Roll No: <span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{"{#var#}"}</span> Name: <span className="font-semibold text-blue-600 bg-blue-50 px-1 rounded">{"{#var#}"}</span> is Absent for today's first hour. Regards, GAYATRI VIDYA PARISHAD COLLEGE"
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Test Subjects</h2>
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
                                    <div className="w-full sm:w-1/3">
                                        <label className="mb-1 block text-xs font-semibold text-slate-600 flex items-center gap-1"><FaMobileAlt /> Mobile No</label>
                                        <input
                                            type="text"
                                            value={tc.mobile}
                                            onChange={(e) => updateTestCase(tc.id, "mobile", e.target.value)}
                                            placeholder="Ex: 9912345678"
                                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
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

                                    <div className="text-xs text-slate-600 mb-2 space-y-1">
                                        <div><span className="font-medium">Roll:</span> {res.rollNumber || "N/A"}</div>
                                        <div><span className="font-medium">Name:</span> {res.name || "N/A"}</div>
                                    </div>

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
