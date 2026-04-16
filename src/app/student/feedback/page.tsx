"use client";

import { useState, useEffect } from "react";
import { FaCheckCircle, FaStar, FaExclamationCircle } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

export default function StudentFeedbackPage() {
    const [loading, setLoading] = useState(true);
    const [forms, setForms] = useState<any[]>([]);
    
    // State to hold answers
    // Structure: { formId: { facultyId_subjectId: { questionId: number, comments: string } } }
    const [answers, setAnswers] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch("/api/student/feedback")
            .then(res => res.json())
            .then(data => {
                if (data.forms) setForms(data.forms);
                setLoading(false);
            })
            .catch(console.error);
    }, []);

    const handleRatingChange = (formId: string, facultyId: string, subjectId: string, questionId: string, value: number) => {
        setAnswers((prev: any) => {
            const current = { ...prev };
            if (!current[formId]) current[formId] = {};
            const key = `${facultyId}_${subjectId}`;
            if (!current[formId][key]) current[formId][key] = { ratings: {}, comments: "" };
            
            current[formId][key].ratings[questionId] = value;
            return current;
        });
    };

    const handleCommentChange = (formId: string, facultyId: string, subjectId: string, value: string) => {
        setAnswers((prev: any) => {
            const current = { ...prev };
            if (!current[formId]) current[formId] = {};
            const key = `${facultyId}_${subjectId}`;
            if (!current[formId][key]) current[formId][key] = { ratings: {}, comments: "" };
            
            current[formId][key].comments = value;
            return current;
        });
    };

    const handleSubmit = async (form: any) => {
        const formAnswers = answers[form.id];
        if (!formAnswers) {
            alert("Please answer the questions before submitting.");
            return;
        }

        // Validate all questions for all mappings are answered
        let isValid = true;
        for (const mapping of form.mappings) {
            const key = `${mapping.facultyId}_${mapping.subjectId}`;
            const facAnswers = formAnswers[key]?.ratings;
            
            if (!facAnswers || Object.keys(facAnswers).length !== form.questions.length) {
                isValid = false;
                break;
            }
        }

        if (!isValid) {
            alert("Please complete the rating for all subjects before submitting.");
            return;
        }

        if (!confirm("Are you sure? Feedback is anonymous and cannot be changed once submitted.")) return;

        setSubmitting(true);
        try {
            const payload = {
                formId: form.id,
                responses: form.mappings.map((m: any) => {
                    const key = `${m.facultyId}_${m.subjectId}`;
                    return {
                        facultyId: m.facultyId,
                        subjectId: m.subjectId,
                        ratings: formAnswers[key].ratings,
                        comments: formAnswers[key].comments || ""
                    };
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
                alert("Failed to submit feedback.");
            }
        } catch (e) {
            console.error(e);
            alert("Error submitting feedback.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><LogoSpinner fullScreen={false} /></div>;

    if (forms.length === 0) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-8 animate-in fade-in">
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <FaCheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">No Pending Feedback</h2>
                    <p className="mt-2 text-slate-500">There are currently no active feedback forms for your section.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-8 animate-in fade-in">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-6 drop-shadow-sm">Faculty Feedback</h1>
            
            {forms.map(form => (
                <div key={form.id} className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white text-center">
                        <h2 className="text-2xl font-bold">{form.title}</h2>
                        {form.description && <p className="mt-2 text-violet-100 opacity-90">{form.description}</p>}
                        <div className="mt-4 flex justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-200">
                            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-sm shadow-sm">Deadline: {new Date(form.endDate).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {form.submitted ? (
                        <div className="p-12 text-center">
                            <FaCheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4 drop-shadow-md" />
                            <h3 className="text-xl font-bold text-slate-800">Feedback Submitted</h3>
                            <p className="mt-2 text-slate-500">Thank you for your anonymous response.</p>
                        </div>
                    ) : form.mappings?.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <FaExclamationCircle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
                            No faculty mapped to your section yet.
                        </div>
                    ) : (
                        <div className="p-6">
                            <p className="mb-6 rounded-lg bg-orange-50 p-4 text-sm font-medium text-orange-800 border border-orange-200 shadow-sm flex items-start gap-3">
                                <FaExclamationCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                Please rate the following faculty impartially. Your responses are strictly <strong>Anonymous</strong> and cannot be traced back to you. The rating scale is from 1 (Poor) to 5 (Excellent).
                            </p>

                            <div className="space-y-10">
                                {form.mappings.map((mapping: any, idx: number) => {
                                    const key = `${mapping.facultyId}_${mapping.subjectId}`;
                                    const facAnswers = answers[form.id]?.[key] || { ratings: {} };

                                    return (
                                        <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                            {/* Decorative Number */}
                                            <div className="absolute -top-4 -right-4 text-[100px] font-black text-slate-200 opacity-50 select-none z-0">
                                                {idx + 1}
                                            </div>
                                            
                                            <div className="relative z-10">
                                                <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-slate-800">{mapping.faculty.empName}</h3>
                                                        <p className="text-sm font-semibold text-violet-600">{mapping.subject.name} ({mapping.subject.code})</p>
                                                    </div>
                                                </div>

                                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                                    {form.questions.map((q: any) => (
                                                        <div key={q.id} className="rounded-lg bg-white p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                                                            <p className="text-sm font-medium text-slate-700 leading-relaxed mb-3">{q.text}</p>
                                                            <div className="flex gap-2">
                                                                {[1, 2, 3, 4, 5].map(val => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => handleRatingChange(form.id, mapping.facultyId, mapping.subjectId, q.id, val)}
                                                                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition-all shadow-sm ${
                                                                            facAnswers.ratings[q.id] === val 
                                                                                ? "bg-violet-600 text-white border-violet-600" 
                                                                                : "bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100"
                                                                        }`}
                                                                        title={["Poor", "Fair", "Good", "Very Good", "Excellent"][val - 1]}
                                                                    >
                                                                        {val}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="mt-6">
                                                    <label className="text-sm font-semibold text-slate-600 mb-2 block">Additional Comments (Optional):</label>
                                                    <textarea 
                                                        className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 resize-none shadow-inner"
                                                        rows={2}
                                                        placeholder="Constructive feedback is appreciated..."
                                                        value={facAnswers.comments || ""}
                                                        onChange={(e) => handleCommentChange(form.id, mapping.facultyId, mapping.subjectId, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-10 flex justify-end">
                                <button 
                                    onClick={() => handleSubmit(form)}
                                    disabled={submitting}
                                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-10 py-4 font-bold text-white shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-transform active:scale-95"
                                >
                                    {submitting ? <LogoSpinner fullScreen={false} /> : <FaStar />}
                                    Submit Anonymous Feedback
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
