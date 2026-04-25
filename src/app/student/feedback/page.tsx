"use client";

import { useState, useEffect } from "react";
import { FaCheckCircle, FaChevronRight, FaChevronLeft, FaPaperPlane, FaExclamationCircle, FaUserTie, FaExclamationTriangle } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

const RATING_COLORS: Record<number, { label: string }> = {
    1: { label: "Poor" },
    2: { label: "Below Average" },
    3: { label: "Average" },
    4: { label: "Good" },
    5: { label: "Excellent" },
};

const FILL_COLORS: Record<number, string> = {
    1: "#ef4444",
    2: "#f97316",
    3: "#eab308",
    4: "#84cc16",
    5: "#22c55e",
};

function RatingButton({ value, selected, hasError, onClick }: { value: number; selected: number; hasError?: boolean; onClick: () => void }) {
    const isActive = selected >= value;
    const color = isActive ? FILL_COLORS[selected] : undefined;

    return (
        <button
            type="button"
            onClick={onClick}
            className="relative flex flex-col items-center gap-1 group"
        >
            <div
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all duration-200 shadow-sm"
                style={isActive ? {
                    backgroundColor: color,
                    borderColor: color,
                    color: "#fff",
                    transform: selected === value ? "scale(1.18)" : "scale(1)",
                    boxShadow: selected === value ? `0 0 0 4px ${color}33` : undefined,
                } : {
                    backgroundColor: hasError ? "#fef2f2" : "#f8fafc",
                    borderColor: hasError ? "#fca5a5" : "#cbd5e1",
                    color: hasError ? "#ef4444" : "#64748b",
                }}
            >
                {value}
            </div>
            {selected === value && (
                <span className="absolute -bottom-5 text-[10px] font-semibold whitespace-nowrap" style={{ color }}>
                    {RATING_COLORS[value]?.label}
                </span>
            )}
        </button>
    );
}

export default function StudentFeedbackPage() {
    const [loading, setLoading] = useState(true);
    const [forms, setForms] = useState<any[]>([]);
    const [studentInfo, setStudentInfo] = useState<any>({});
    const [academicYear, setAcademicYear] = useState("");
    const [answers, setAnswers] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);

    // Per-form pagination state
    const [pageIndex, setPageIndex] = useState<Record<string, number>>({});
    // Track which question IDs have errors (unanswered on submit attempt)
    const [errorQuestions, setErrorQuestions] = useState<Record<string, Set<string>>>({});

    useEffect(() => {
        fetch("/api/student/feedback")
            .then(res => res.json())
            .then(data => {
                if (data.forms) setForms(data.forms);
                if (data.studentInfo) setStudentInfo(data.studentInfo);
                if (data.academicYear) setAcademicYear(data.academicYear);
                setLoading(false);
            })
            .catch(console.error);
    }, []);

    const handleRatingChange = (formId: string, mappingKey: string, questionId: string, value: any) => {
        setAnswers((prev: any) => {
            const current = { ...prev };
            if (!current[formId]) current[formId] = {};
            if (!current[formId][mappingKey]) current[formId][mappingKey] = { ratings: {}, comments: "" };
            current[formId][mappingKey].ratings[questionId] = value;
            return current;
        });
        // Clear error for this question
        setErrorQuestions(prev => {
            const errKey = `${formId}_${mappingKey}`;
            if (prev[errKey]) {
                const newSet = new Set(prev[errKey]);
                newSet.delete(questionId);
                return { ...prev, [errKey]: newSet };
            }
            return prev;
        });
    };

    const handleCommentChange = (formId: string, mappingKey: string, value: string) => {
        setAnswers((prev: any) => {
            const current = { ...prev };
            if (!current[formId]) current[formId] = {};
            if (!current[formId][mappingKey]) current[formId][mappingKey] = { ratings: {}, comments: "" };
            current[formId][mappingKey].comments = value;
            return current;
        });
    };

    const getCurrentPage = (formId: string) => pageIndex[formId] ?? 0;
    const getMappingKey = (mapping: any) => `${mapping.facultyId}_${mapping.subjectId}`;

    // Check if all required questions (scale + text) are answered for a mapping
    const isMappingComplete = (formId: string, mappingKey: string, questions: any[]) => {
        const requiredQuestions = questions.filter((q: any) => q.type !== "TEXT" || /* TEXT type from template is required */ true);
        const scaleQs = questions.filter((q: any) => q.type !== "TEXT");
        const textQs = questions.filter((q: any) => q.type === "TEXT");
        const ratings = answers[formId]?.[mappingKey]?.ratings || {};

        const scaleOk = scaleQs.every((q: any) => ratings[q.id] !== undefined && ratings[q.id] !== "");
        const textOk = textQs.every((q: any) => ratings[q.id] !== undefined && String(ratings[q.id]).trim() !== "");
        return scaleOk && textOk;
    };

    // Get list of unanswered question IDs for a mapping
    const getUnansweredQuestions = (formId: string, mappingKey: string, questions: any[]) => {
        const unanswered: string[] = [];
        const ratings = answers[formId]?.[mappingKey]?.ratings || {};
        for (const q of questions) {
            if (q.type === "TEXT") {
                if (!ratings[q.id] || String(ratings[q.id]).trim() === "") unanswered.push(q.id);
            } else {
                if (ratings[q.id] === undefined) unanswered.push(q.id);
            }
        }
        return unanswered;
    };

    const goNext = (formId: string, mappingKey: string, questions: any[]) => {
        const unanswered = getUnansweredQuestions(formId, mappingKey, questions);
        if (unanswered.length > 0) {
            setErrorQuestions(prev => ({ ...prev, [`${formId}_${mappingKey}`]: new Set(unanswered) }));
            document.getElementById(`q_error_${formId}`)?.scrollIntoView({ behavior: "smooth" });
            return;
        }
        setErrorQuestions(prev => ({ ...prev, [`${formId}_${mappingKey}`]: new Set() }));
        setPageIndex(prev => ({ ...prev, [formId]: (prev[formId] ?? 0) + 1 }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goBack = (formId: string) => {
        setPageIndex(prev => ({ ...prev, [formId]: Math.max(0, (prev[formId] ?? 0) - 1) }));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSubmit = async (form: any) => {
        const isGeneral = form.template?.type === "GENERAL";
        const formAnswers = answers[form.id];
        const expectedMappings = isGeneral ? ["GENERAL_0"] : form.mappings.map((m: any) => getMappingKey(m));

        // Check all mappings and collect errors
        let firstErrorMapping: string | null = null;
        let firstErrorPage: number | null = null;
        const allErrors: Record<string, Set<string>> = {};

        for (let i = 0; i < expectedMappings.length; i++) {
            const key = expectedMappings[i];
            const unanswered = getUnansweredQuestions(form.id, key, form.questions);
            if (unanswered.length > 0) {
                allErrors[`${form.id}_${key}`] = new Set(unanswered);
                if (firstErrorMapping === null) {
                    firstErrorMapping = key;
                    firstErrorPage = i;
                }
            }
        }

        if (firstErrorPage !== null) {
            setErrorQuestions(prev => ({ ...prev, ...allErrors }));
            setPageIndex(prev => ({ ...prev, [form.id]: firstErrorPage! }));
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        if (!confirm("Are you sure? Feedback is anonymous and cannot be changed once submitted.")) return;

        setSubmitting(true);
        try {
            const payload = {
                formId: form.id,
                responses: expectedMappings.map((key: string) => {
                    const ans = formAnswers?.[key] || { ratings: {}, comments: "" };
                    if (isGeneral) {
                        return { ratings: ans.ratings, comments: ans.comments || "" };
                    } else {
                        const [facultyId, subjectId] = key.split("_");
                        return { facultyId, subjectId, ratings: ans.ratings, comments: ans.comments || "" };
                    }
                })
            };

            const res = await fetch("/api/student/feedback/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Thank you! Your feedback has been submitted anonymously.");
                window.location.reload();
            } else {
                const err = await res.json();
                alert(`Failed to submit: ${err.error || "Please try again."}`);
            }
        } catch (e) {
            console.error(e);
            alert("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <LogoSpinner fullScreen={false} />
            </div>
        );
    }

    if (forms.length === 0) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-20 text-center">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-12">
                    <FaCheckCircle className="mx-auto h-16 w-16 text-green-400 mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">No Pending Feedback</h2>
                    <p className="text-slate-500">There are currently no active feedback forms for your section.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-6 animate-in fade-in">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Student Feedback</h1>

            {forms.map((form) => {
                if (form.submitted) {
                    return (
                        <div key={form.id} className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white text-center">
                                <h2 className="text-2xl font-bold">{form.title}</h2>
                            </div>
                            <div className="p-12 text-center">
                                <FaCheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
                                <h3 className="text-xl font-bold text-slate-800">Feedback Submitted</h3>
                                <p className="text-slate-500 mt-2">Thank you for your anonymous response.</p>
                            </div>
                        </div>
                    );
                }

                const isGeneral = form.template?.type === "GENERAL";
                const mappings: any[] = isGeneral ? [{ key: "GENERAL_0" }] : form.mappings;

                if (!isGeneral && mappings.length === 0) {
                    return (
                        <div key={form.id} className="mb-6 rounded-2xl bg-white border border-slate-200 shadow-sm p-12 text-center text-slate-500">
                            <FaExclamationCircle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
                            No faculty mapped to your section yet.
                        </div>
                    );
                }

                const currentPage = getCurrentPage(form.id);
                const currentMapping = mappings[currentPage];
                const mappingKey = isGeneral ? "GENERAL_0" : getMappingKey(currentMapping);
                const errKey = `${form.id}_${mappingKey}`;
                const currentErrors = errorQuestions[errKey] || new Set<string>();

                const scaleQuestions = form.questions.filter((q: any) => q.type !== "TEXT");
                const textQuestions = form.questions.filter((q: any) => q.type === "TEXT");
                const isLast = currentPage === mappings.length - 1;
                const isFirst = currentPage === 0;

                // Count completed mappings for summary on last page
                const completedCount = mappings.filter((_: any, i: number) => {
                    const mk = isGeneral ? "GENERAL_0" : getMappingKey(mappings[i]);
                    return isMappingComplete(form.id, mk, form.questions);
                }).length;

                const currentComplete = isMappingComplete(form.id, mappingKey, form.questions);

                return (
                    <div key={form.id} className="mb-8 rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
                        {/* Form Header */}
                        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 px-8 py-6 text-white">
                            <h2 className="text-2xl font-extrabold tracking-tight">{form.title}</h2>
                            <p className="text-violet-200 text-sm mt-1">Deadline: {new Date(form.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>

                        {/* Progress Bar */}
                        <div className="px-8 pt-4 pb-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    Subject {currentPage + 1} of {mappings.length}
                                </span>
                                <span className="text-xs font-bold text-violet-600">
                                    {completedCount}/{mappings.length} completed
                                </span>
                            </div>
                            <div className="flex gap-1">
                                {mappings.map((_: any, i: number) => {
                                    const mk = isGeneral ? "GENERAL_0" : getMappingKey(mappings[i]);
                                    const done = isMappingComplete(form.id, mk, form.questions);
                                    const errK = `${form.id}_${mk}`;
                                    const hasErr = (errorQuestions[errK]?.size ?? 0) > 0;
                                    return (
                                        <div
                                            key={i}
                                            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                                                i === currentPage ? "bg-violet-500" :
                                                done ? "bg-green-400" :
                                                hasErr ? "bg-red-400" :
                                                "bg-slate-200"
                                            }`}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Instruction Banner */}
                        <div className="mx-8 my-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
                            <FaExclamationCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-amber-800">
                                Please rate the following faculty impartially. Responses are <strong>strictly anonymous</strong>. Rating: <strong>1 = Poor</strong> to <strong>5 = Excellent</strong>. All questions marked <span className="text-red-600">*</span> are required.
                            </p>
                        </div>

                        {/* Error summary */}
                        {currentErrors.size > 0 && (
                            <div id={`q_error_${form.id}`} className="mx-8 mb-4 rounded-xl bg-red-50 border border-red-300 px-4 py-3 flex items-center gap-3">
                                <FaExclamationTriangle className="h-4 w-4 text-red-600 shrink-0" />
                                <p className="text-sm font-semibold text-red-700">
                                    Please answer all required questions before proceeding. ({currentErrors.size} unanswered)
                                </p>
                            </div>
                        )}

                        {/* Faculty Card */}
                        {!isGeneral && (
                            <div className="mx-8 mb-6 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                                    <div className="shrink-0">
                                        {currentMapping.faculty?.photoUrl ? (
                                            <img
                                                src={currentMapping.faculty.photoUrl}
                                                alt={currentMapping.faculty.empName}
                                                className="w-32 h-32 object-cover rounded-xl border-4 border-white/20 shadow-xl"
                                            />
                                        ) : (
                                            <div className="w-32 h-32 rounded-xl bg-violet-700 flex items-center justify-center border-4 border-white/20 shadow-xl">
                                                <FaUserTie className="text-white text-5xl" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 text-center sm:text-left">
                                        <h3 className="text-2xl font-extrabold text-white leading-tight">{currentMapping.faculty?.empName}</h3>
                                        <p className="text-violet-300 font-semibold text-base mt-1">{currentMapping.faculty?.department?.code} Department</p>
                                        <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                                            <span className="bg-violet-600/80 text-white text-sm font-bold px-3 py-1 rounded-full">
                                                {currentMapping.subject?.name}
                                            </span>
                                            <span className="bg-white/10 text-slate-200 text-sm font-semibold px-3 py-1 rounded-full">
                                                {currentMapping.subject?.code}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                                            <span className="text-xs bg-white/10 text-slate-300 px-3 py-1 rounded-full font-semibold">📅 {academicYear}</span>
                                            <span className="text-xs bg-white/10 text-slate-300 px-3 py-1 rounded-full font-semibold">Year {studentInfo.year} · Sem {studentInfo.semester}</span>
                                            <span className="text-xs bg-white/10 text-slate-300 px-3 py-1 rounded-full font-semibold">Batch: {studentInfo.batch}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Questions */}
                        <div className="px-8 pb-2 space-y-4">
                            {scaleQuestions.map((q: any, idx: number) => {
                                const selected = answers[form.id]?.[mappingKey]?.ratings?.[q.id] ?? 0;
                                const hasError = currentErrors.has(q.id);
                                return (
                                    <div
                                        key={q.id}
                                        className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border px-5 py-4 transition-colors ${
                                            hasError
                                                ? "border-red-300 bg-red-50"
                                                : selected > 0
                                                ? "border-green-200 bg-green-50/30"
                                                : "border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/30"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <span className={`shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 ${hasError ? "bg-red-100 text-red-700" : "bg-violet-100 text-violet-700"}`}>
                                                {idx + 1}
                                            </span>
                                            <p className="text-sm font-semibold text-slate-800 leading-snug">
                                                {q.text} <span className="text-red-500">*</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 pl-10 sm:pl-0 pb-6 sm:pb-0">
                                            {[1, 2, 3, 4, 5].map(v => (
                                                <RatingButton
                                                    key={v}
                                                    value={v}
                                                    selected={selected}
                                                    hasError={hasError && selected === 0}
                                                    onClick={() => handleRatingChange(form.id, mappingKey, q.id, v)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Text Questions (required) */}
                            {textQuestions.map((q: any) => {
                                const val = answers[form.id]?.[mappingKey]?.ratings?.[q.id] || "";
                                const hasError = currentErrors.has(q.id);
                                return (
                                    <div key={q.id} className={`rounded-xl border px-5 py-4 ${hasError ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                                        <p className="text-sm font-semibold text-slate-800 mb-3">
                                            {q.text} <span className="text-red-500">*</span>
                                        </p>
                                        <textarea
                                            className={`w-full rounded-xl border p-3 text-sm outline-none resize-none shadow-inner bg-white transition-colors ${
                                                hasError ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20" : "border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                                            }`}
                                            rows={3}
                                            placeholder={hasError ? "⚠ This field is required" : "Your answer here..."}
                                            value={val}
                                            onChange={(e) => handleRatingChange(form.id, mappingKey, q.id, e.target.value)}
                                        />
                                    </div>
                                );
                            })}


                        </div>

                        {/* Navigation */}
                        <div className="px-8 py-6 flex items-center justify-between border-t border-slate-100 mt-4">
                            {/* Back button */}
                            <button
                                onClick={() => goBack(form.id)}
                                disabled={isFirst}
                                className="flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <FaChevronLeft /> Previous
                            </button>

                            <div className="text-sm text-center">
                                {currentComplete ? (
                                    <span className="text-green-600 font-semibold flex items-center gap-1">
                                        <FaCheckCircle /> All answered
                                    </span>
                                ) : (
                                    <span className="text-amber-600 font-semibold text-xs">Answer all required fields</span>
                                )}
                            </div>

                            {!isLast ? (
                                <button
                                    onClick={() => goNext(form.id, mappingKey, form.questions)}
                                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-bold text-white shadow-md hover:bg-violet-700 transition-all active:scale-95"
                                >
                                    Next <FaChevronRight />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleSubmit(form)}
                                    disabled={submitting}
                                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-3 font-bold text-white shadow-md hover:from-green-700 hover:to-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {submitting ? <LogoSpinner fullScreen={false} /> : <FaPaperPlane />}
                                    Submit Feedback
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
