"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaPrint, FaSpinner, FaArrowLeft, FaStar } from "react-icons/fa";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function FacultyFeedbackAnalysis() {
    const searchParams = useSearchParams();
    const subjectId = searchParams?.get("subjectId");
    const sectionId = searchParams?.get("sectionId");

    const [forms, setForms] = useState<any[]>([]);
    const [selectedFormId, setSelectedFormId] = useState("");
    const [reportData, setReportData] = useState<any>(null);
    const [loadingForms, setLoadingForms] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Fetch Forms list for this subject
    useEffect(() => {
        if (!subjectId) {
            setErrorMsg("Subject ID is missing.");
            setLoadingForms(false);
            return;
        }

        fetch(`/api/faculty/feedback/report?subjectId=${subjectId}${sectionId ? `&sectionId=${sectionId}` : ''}`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to load feedback forms.");
                return res.json();
            })
            .then(data => {
                setForms(data);
                if (data.length > 0) {
                    setSelectedFormId(data[0].id);
                }
                setLoadingForms(false);
            })
            .catch(err => {
                console.error(err);
                setErrorMsg("No feedback report is available for this subject yet. Please make sure the feedback window is closed.");
                setLoadingForms(false);
            });
    }, [subjectId, sectionId]);

    // Fetch Detailed Report for the selected form
    useEffect(() => {
        if (!subjectId || !selectedFormId) {
            setReportData(null);
            return;
        }

        setLoadingReport(true);
        fetch(`/api/faculty/feedback/report?subjectId=${subjectId}&formId=${selectedFormId}${sectionId ? `&sectionId=${sectionId}` : ''}`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to load detailed report.");
                return res.json();
            })
            .then(data => {
                setReportData(data);
                setLoadingReport(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingReport(false);
            });
    }, [subjectId, selectedFormId, sectionId]);

    const handlePrint = () => {
        window.print();
    };

    if (loadingForms) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <FaSpinner className="animate-spin text-4xl text-fuchsia-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto printable-area">
            {/* NO-PRINT HEADER SECTION */}
            <div className="no-print mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Link href="/faculty/dashboard" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition mb-2 font-medium text-sm">
                            <FaArrowLeft className="mr-2" /> Back to Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Detailed Feedback Report
                        </h1>
                        <p className="text-slate-500 mt-1">View student feedback analysis, comments, and rating graphs.</p>
                    </div>

                    {forms.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <select
                                value={selectedFormId}
                                onChange={(e) => setSelectedFormId(e.target.value)}
                                className="p-2 border border-slate-300 rounded-lg bg-white min-w-[240px] focus:ring-2 focus:ring-fuchsia-500 outline-none"
                            >
                                {forms.map(f => (
                                    <option key={f.id} value={f.id}>{f.title}</option>
                                ))}
                            </select>

                            <button
                                onClick={handlePrint}
                                disabled={loadingReport || !reportData?.report}
                                className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm ml-auto md:ml-0"
                            >
                                <FaPrint /> Print Report
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ERROR / EMPTY STATE */}
            {forms.length === 0 && (
                <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-slate-200">
                    <p className="text-slate-500 text-lg font-medium">
                        {errorMsg || "No closed feedback forms found for this subject."}
                    </p>
                    <p className="text-sm text-slate-400 mt-2">
                        Feedback data is only viewable after the active feedback window is officially closed.
                    </p>
                </div>
            )}

            {/* LOADING REPORT */}
            {loadingReport && (
                <div className="flex justify-center items-center py-20 no-print">
                    <FaSpinner className="animate-spin text-4xl text-fuchsia-500" />
                </div>
            )}

            {/* DETAILED REPORT SECTION */}
            {!loadingReport && reportData && reportData.report && (
                <div className="print-container">
                    <div className="report-page relative bg-white p-0 md:p-8 rounded-xl shadow-sm md:border border-slate-200">

                        {/* COLLEGE HEADER inside report-page (only visible when printing) */}
                        <div className="print-college-header">
                            <div className="pch-inner">
                                <img src="/logo.png" alt="GVP Logo" className="pch-logo" />
                                <div>
                                    <div className="pch-title">GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(A)</div>
                                    <div className="pch-sub">ENGINEERING AND TECHNOLOGY PROGRAM</div>
                                    <div className="pch-sub">RUSHIKONDA, VISAKHAPATNAM</div>
                                </div>
                            </div>
                            <div className="pch-line" />
                        </div>

                        {/* METADATA TABLE */}
                        <table className="rpt-meta-tbl">
                            <tbody>
                                <tr>
                                    <td colSpan={6} className="rpt-title">Student Feedback on Teachers</td>
                                    <td rowSpan={5} className="rpt-photo-cell">
                                        {reportData.report.facultyPhoto
                                            ? <img src={reportData.report.facultyPhoto} alt="Faculty" className="rpt-photo" />
                                            : <div className="rpt-photo-placeholder">Photo</div>}
                                        <div className="rpt-score-label">Overall Score</div>
                                        <div className={`rpt-score-val ${parseFloat(reportData.report.overallAverage) >= 4.0 ? 'score-green' : parseFloat(reportData.report.overallAverage) >= 3.0 ? 'score-blue' : 'score-red'}`}>
                                            {reportData.report.overallAverage}
                                        </div>
                                        <div className="rpt-score-sub">/ 5</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={2} className="rpt-lbl">Feedback Form:</td>
                                    <td colSpan={4} className="rpt-val" style={{color:'#7c3aed', fontWeight:'bold'}}>{reportData.metadata.formTitle}</td>
                                </tr>
                                <tr>
                                    <td className="rpt-lbl">COURSE:</td>
                                    <td className="rpt-val red">{reportData.metadata.course}</td>
                                    <td className="rpt-lbl">YEAR &amp; SEM</td>
                                    <td className="rpt-val red">{reportData.metadata.year ? `${reportData.metadata.year} / Sem ${reportData.metadata.semester}` : `Sem ${reportData.metadata.semester}`}</td>
                                    <td colSpan={2} className="rpt-val center">Academic Year: {reportData.metadata.academicYear}</td>
                                </tr>
                                <tr>
                                    <td className="rpt-lbl">BATCH:</td>
                                    <td className="rpt-val">{reportData.metadata.batch}</td>
                                    <td className="rpt-lbl">SECTION</td>
                                    <td className="rpt-val blue">{reportData.metadata.sections}</td>
                                    <td className="rpt-lbl">No. of Respondents:</td>
                                    <td className="rpt-val blue">{reportData.report.respondents}</td>
                                </tr>
                                <tr>
                                    <td colSpan={2} className="rpt-lbl center">Faculty Name:</td>
                                    <td colSpan={2} className="rpt-val red">{reportData.report.facultyName}</td>
                                    <td className="rpt-lbl">Subject:</td>
                                    <td className="rpt-val red">{reportData.report.subjectName}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* RESPONSE MATRIX TABLE */}
                        <div className="mt-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 no-print flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-fuchsia-600 rounded-full" />
                                Responses Matrix
                            </h3>
                            <table className="rpt-data-tbl">
                                <colgroup>
                                    {reportData.ratingQuestions.map((_: any, i: number) => (
                                        <col key={i} style={{width: `${65 / reportData.ratingQuestions.length}%`}} />
                                    ))}
                                    <col style={{width: '35%'}} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th colSpan={reportData.ratingQuestions.length + 1} className="rpt-qs-header">QUESTIONS</th>
                                    </tr>
                                    <tr>
                                        {reportData.ratingQuestions.map((q: string, qIdx: number) => (
                                            <th key={qIdx} className="rpt-q-text">{q}</th>
                                        ))}
                                        <th className="rpt-q-text red">Remarks / Comments</th>
                                    </tr>
                                    <tr className="rpt-ans-row">
                                        {reportData.ratingQuestions.map((_: any, qIdx: number) => (
                                            <th key={`a${qIdx}`} className="rpt-ans-lbl">Ans-{qIdx + 1}</th>
                                        ))}
                                        <th className="rpt-ans-lbl"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.report.rows.map((row: any, rIdx: number) => (
                                        <tr key={rIdx}>
                                            {row.answers.map((ans: any, aIdx: number) => (
                                                <td key={aIdx} className="rpt-ans-val">{ans}</td>
                                            ))}
                                            <td className="rpt-remark">{row.remarks}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* GRAPHICAL CHARTS */}
                        <div className="mt-12 page-break-before-print">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 no-print flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-fuchsia-600 rounded-full" />
                                Graphical Representation
                            </h3>

                            <div className="charts-wrapper flex flex-col md:grid md:grid-cols-2 gap-8">
                                <div className="chart-box bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner flex flex-col items-center" style={{ minHeight: '340px' }}>
                                    <h5 className="font-bold text-center mb-6 text-sm text-slate-700 uppercase tracking-wider">Question-wise Rating Distribution</h5>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart 
                                            data={reportData.ratingQuestions.map((q: string, qIndex: number) => {
                                                const counts: any = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
                                                reportData.report.rows.forEach((row: any) => {
                                                    const val = row.answers[qIndex];
                                                    if (counts[val] !== undefined) counts[val]++;
                                                });
                                                return {
                                                    question: `Q${qIndex + 1}`,
                                                    fullQuestion: q,
                                                    "1": counts["1"],
                                                    "2": counts["2"],
                                                    "3": counts["3"],
                                                    "4": counts["4"],
                                                    "5": counts["5"]
                                                };
                                            })} 
                                            margin={{ top: 20, right: 20, left: -20, bottom: 20 }}
                                        >
                                            <XAxis dataKey="question" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                            <Tooltip labelFormatter={(label, payload: any) => payload?.[0]?.payload?.fullQuestion || label} />
                                            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                                            <Bar dataKey="1" name="1 (Poor)" fill="#4285F4" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="2" name="2 (Fair)" fill="#DB4437" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="3" name="3 (Good)" fill="#F4B400" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="4" name="4 (Very Good)" fill="#0F9D58" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="5" name="5 (Excellent)" fill="#AB47BC" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="chart-box bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner flex flex-col items-center" style={{ minHeight: '340px' }}>
                                    <h5 className="font-bold text-center mb-6 text-sm text-slate-700 uppercase tracking-wider">Overall Rating Distribution</h5>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Excellent (5)', value: reportData.report.excellents || 0, color: '#AB47BC' },
                                                    { name: 'Very Good (4)', value: reportData.report.veryGood || 0, color: '#0F9D58' },
                                                    { name: 'Good (3)', value: reportData.report.good || 0, color: '#F4B400' },
                                                    { name: 'Fair (2)', value: reportData.report.fair || 0, color: '#DB4437' },
                                                    { name: 'Poor (1)', value: reportData.report.poor || 0, color: '#4285F4' },
                                                ].filter(d => d.value > 0)}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={true}
                                                label={({ name, percent }) => `${(name || '').split(' ')[0]}: ${((percent || 0) * 100).toFixed(0)}%`}
                                                outerRadius={90}
                                                dataKey="value"
                                                style={{ fontSize: '10px', fontWeight: 'bold' }}
                                            >
                                                {
                                                    [
                                                        { name: 'Excellent (5)', value: reportData.report.excellents || 0, color: '#AB47BC' },
                                                        { name: 'Very Good (4)', value: reportData.report.veryGood || 0, color: '#0F9D58' },
                                                        { name: 'Good (3)', value: reportData.report.good || 0, color: '#F4B400' },
                                                        { name: 'Fair (2)', value: reportData.report.fair || 0, color: '#DB4437' },
                                                        { name: 'Poor (1)', value: reportData.report.poor || 0, color: '#4285F4' },
                                                    ].filter(d => d.value > 0).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))
                                                }
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* EMBEDDED PRINT STYLES */}
            <style dangerouslySetInnerHTML={{__html: `
                .print-college-header { display: none; }
                .pch-inner { display:flex; align-items:center; gap:12px; }
                .pch-logo { height:52px; width:auto; object-fit:contain; flex-shrink:0; }
                .pch-title { font-weight:900; font-size:13px; text-transform:uppercase; letter-spacing:0.3px; line-height:1.4; }
                .pch-sub { font-size:11px; font-weight:700; line-height:1.4; }
                .pch-line { border-top:2px solid black; margin-top:5px; }
                .rpt-meta-tbl { width:100%; border-collapse:collapse; border:1px solid black; font-size:12px; font-family:sans-serif; }
                .rpt-meta-tbl td { border:1px solid black; padding:4px 8px; }
                .rpt-title { text-align:center; font-weight:bold; font-size:15px; background:#f3f4f6; }
                .rpt-lbl { font-weight:bold; background:#f9fafb; white-space:nowrap; }
                .rpt-val { font-weight:bold; text-align:center; }
                .rpt-val.red { color:#dc2626; }
                .rpt-val.blue { color:#2563eb; }
                .rpt-val.center { text-align:center; }
                .rpt-photo-cell { text-align:center; vertical-align:middle; width:110px; padding:6px; }
                .rpt-photo { height:80px; width:80px; object-fit:cover; border-radius:4px; display:block; margin:0 auto 4px; }
                .rpt-photo-placeholder { font-size:10px; color:#9ca3af; margin-bottom:4px; }
                .rpt-score-label { font-size:10px; font-weight:bold; color:#374151; }
                .rpt-score-val { font-size:26px; font-weight:900; line-height:1.1; }
                .score-green { color:#15803d; }
                .score-blue { color:#1d4ed8; }
                .score-red { color:#dc2626; }
                .rpt-score-sub { font-size:9px; color:#6b7280; }
                .rpt-data-tbl { width:100%; border-collapse:collapse; border:1px solid black; font-family:sans-serif; table-layout:fixed; margin-top:0; }
                .rpt-qs-header { border:1px solid black; text-align:center; font-weight:bold; padding:4px; color:#dc2626; background:#f9fafb; }
                .rpt-q-text { border:1px solid black; padding:4px 3px; font-size:10px; font-weight:bold; text-align:center; vertical-align:top; line-height:1.3; word-wrap:break-word; overflow-wrap:break-word; }
                .rpt-q-text.red { color:#dc2626; }
                .rpt-ans-row { background:#eff6ff; }
                .rpt-ans-lbl { border:1px solid black; padding:3px 2px; text-align:center; font-weight:bold; font-size:11px; color:#1d4ed8; }
                .rpt-ans-val { border:1px solid black; padding:3px 2px; text-align:center; font-size:11px; }
                .rpt-remark { border:1px solid black; padding:3px 5px; font-size:10px; word-wrap:break-word; overflow-wrap:break-word; white-space:normal; }

                @media print {
                    @page { size: A4 portrait; margin: 10mm 12mm; }
                    body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .no-print, header, nav, aside, footer { display: none !important; }
                    .printable-area { padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
                    .print-college-header { display: block !important; margin-bottom: 6px; }
                    .pch-inner { display: flex !important; align-items: center !important; gap: 10px !important; }
                    .pch-logo { height: 50px !important; width: auto !important; object-fit: contain !important; flex-shrink: 0 !important; }
                    .pch-title { font-weight: 900 !important; font-size: 11px !important; text-transform: uppercase !important; line-height: 1.4 !important; }
                    .pch-sub { font-size: 9.5px !important; font-weight: 700 !important; line-height: 1.4 !important; }
                    .pch-line { border-top: 2px solid black !important; margin-top: 4px !important; }
                    .print-container { width: 100%; }
                    .report-page { margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
                    .rpt-meta-tbl { font-size: 9px !important; }
                    .rpt-meta-tbl td { padding: 3px 5px !important; }
                    .rpt-title { font-size: 11px !important; padding: 4px !important; }
                    .rpt-photo { height: 65px !important; width: 65px !important; }
                    .rpt-score-val { font-size: 20px !important; }
                    .rpt-data-tbl { font-size: 8px !important; }
                    .rpt-q-text { font-size: 6px !important; padding: 2px 2px !important; line-height: 1.2 !important; }
                    .rpt-ans-lbl { font-size: 7px !important; padding: 2px 1px !important; }
                    .rpt-ans-val { font-size: 8px !important; padding: 2px 1px !important; }
                    .rpt-remark { font-size: 7px !important; padding: 2px 3px !important; word-wrap: break-word !important; white-space: normal !important; overflow-wrap: break-word !important; }
                    table { page-break-inside: auto !important; }
                    tr { page-break-inside: avoid !important; }
                    thead { display: table-header-group !important; }
                    .page-break-before-print { page-break-before: auto; page-break-inside: avoid; margin-top: 20px; }
                    .charts-wrapper { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
                    .chart-box { background: transparent !important; border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
                }
            `}} />
        </div>
    );
}
