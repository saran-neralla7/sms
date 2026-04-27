"use client";

import { use } from "react";
import { useState, useEffect } from "react";
import { FaPrint, FaSpinner, FaArrowLeft } from "react-icons/fa";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function FacultyDetailedReportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: facultyId } = use(params);
    const searchParams = useSearchParams();
    const academicYearId = searchParams?.get("academicYearId");

    const [reportsByForm, setReportsByForm] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [facultyInfo, setFacultyInfo] = useState<any>(null);

    useEffect(() => {
        if (!facultyId || !academicYearId) return;

        fetch(`/api/admin/feedback/analysis/faculty-report?facultyId=${facultyId}&academicYearId=${academicYearId}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setReportsByForm(data);
                    // Extract faculty info from the first valid report
                    if (data.length > 0 && data[0].reports && data[0].reports.length > 0) {
                        setFacultyInfo({
                            name: data[0].reports[0].facultyName,
                            photoUrl: data[0].reports[0].facultyPhoto
                        });
                    }
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [facultyId, academicYearId]);

    const handlePrint = () => {
        window.print();
    };

    if (!academicYearId) {
        return (
            <div className="p-6 max-w-7xl mx-auto text-center">
                <p className="text-red-500 font-bold">Academic Year is missing.</p>
                <Link href="/admin/feedback/analysis" className="text-fuchsia-600 underline">Go Back</Link>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto printable-area">
            {/* NO-PRINT HEADER SECTION */}
            <div className="no-print mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Link href="/admin/feedback/analysis" className="inline-flex items-center text-slate-500 hover:text-slate-800 transition mb-2 font-medium text-sm">
                            <FaArrowLeft className="mr-2" /> Back to Analysis
                        </Link>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Faculty Subject Reports
                        </h1>
                        <p className="text-slate-500 mt-1">Detailed feedback breakdown across all subjects taught in the selected academic year.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {facultyInfo && (
                            <div className="flex items-center gap-3 mr-4 border-r border-slate-200 pr-6">
                                {facultyInfo.photoUrl ? (
                                    <img src={facultyInfo.photoUrl} alt="Faculty" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold">NA</div>
                                )}
                                <span className="font-bold text-slate-800">{facultyInfo.name}</span>
                            </div>
                        )}
                        <button
                            onClick={handlePrint}
                            disabled={loading || reportsByForm.length === 0}
                            className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            <FaPrint /> Print All Reports
                        </button>
                    </div>
                </div>
            </div>

            {/* LOADING STATE */}
            {loading && (
                <div className="flex justify-center items-center py-20 no-print">
                    <FaSpinner className="animate-spin text-4xl text-fuchsia-500" />
                </div>
            )}

            {!loading && reportsByForm.length === 0 && (
                <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-slate-200">
                    <p className="text-slate-500 text-lg font-medium">No detailed feedback reports found for this faculty in the selected academic year.</p>
                </div>
            )}


            {/* PRINTABLE REPORT SECTION */}
            {!loading && reportsByForm.length > 0 && (
                <div className="print-container">
                    {reportsByForm.map((formGroup, formIndex) => (
                        <div key={`form-${formIndex}`}>
                            {formGroup.reports.map((report: any, index: number) => (
                                <div key={`report-${formIndex}-${index}`} className="report-page relative mb-16 bg-white p-0 md:p-8 rounded-xl shadow-sm md:border border-slate-200 md:mb-8">

                                    {/* Screen tag */}
                                    <div className="absolute -top-3 left-4 bg-fuchsia-100 text-fuchsia-700 px-3 py-1 rounded font-bold text-xs shadow-sm no-print border border-fuchsia-200">
                                        Feedback Window: {formGroup.formTitle}
                                    </div>

                                    {/* COLLEGE HEADER inside every report-page */}
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
                                                    {report.facultyPhoto
                                                        ? <img src={report.facultyPhoto} alt="Faculty" className="rpt-photo" />
                                                        : <div className="rpt-photo-placeholder">Photo</div>}
                                                    <div className="rpt-score-label">Overall Score</div>
                                                    <div className={`rpt-score-val ${parseFloat(report.overallAverage) >= 4.0 ? 'score-green' : parseFloat(report.overallAverage) >= 3.0 ? 'score-blue' : 'score-red'}`}>
                                                        {report.overallAverage}
                                                    </div>
                                                    <div className="rpt-score-sub">/ 5</div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colSpan={2} className="rpt-lbl">Feedback Form:</td>
                                                <td colSpan={4} className="rpt-val" style={{color:'#7c3aed', fontWeight:'bold'}}>{formGroup.metadata.formTitle}</td>
                                            </tr>
                                            <tr>
                                                <td className="rpt-lbl">COURSE:</td>
                                                <td className="rpt-val red">{formGroup.metadata.course}</td>
                                                <td className="rpt-lbl">YEAR &amp; SEM</td>
                                                <td className="rpt-val red">{formGroup.metadata.year ? `${formGroup.metadata.year} / Sem ${formGroup.metadata.semester}` : `Sem ${formGroup.metadata.semester}`}</td>
                                                <td colSpan={2} className="rpt-val center">Academic Year: {formGroup.metadata.academicYear}</td>
                                            </tr>
                                            <tr>
                                                <td className="rpt-lbl">BATCH:</td>
                                                <td className="rpt-val">{formGroup.metadata.batch}</td>
                                                <td className="rpt-lbl">SECTION</td>
                                                <td className="rpt-val blue">{formGroup.metadata.sections}</td>
                                                <td className="rpt-lbl">No. of Respondents:</td>
                                                <td className="rpt-val blue">{report.respondents}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={2} className="rpt-lbl center">Faculty Name:</td>
                                                <td colSpan={2} className="rpt-val red">{report.facultyName}</td>
                                                <td className="rpt-lbl">Subject:</td>
                                                <td className="rpt-val red">{report.subjectName}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* DATA TABLE */}
                                    <table className="rpt-data-tbl">
                                        <colgroup>
                                            {formGroup.ratingQuestions.map((_: any, i: number) => (
                                                <col key={i} style={{width: `${65 / formGroup.ratingQuestions.length}%`}} />
                                            ))}
                                            <col style={{width: '35%'}} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th colSpan={formGroup.ratingQuestions.length + 1} className="rpt-qs-header">QUESTIONS</th>
                                            </tr>
                                            <tr>
                                                {formGroup.ratingQuestions.map((q: string, qIdx: number) => (
                                                    <th key={qIdx} className="rpt-q-text">{q}</th>
                                                ))}
                                                <th className="rpt-q-text red">Remarks / Comments</th>
                                            </tr>
                                            <tr className="rpt-ans-row">
                                                {formGroup.ratingQuestions.map((_: any, qIdx: number) => (
                                                    <th key={`a${qIdx}`} className="rpt-ans-lbl">Ans-{qIdx + 1}</th>
                                                ))}
                                                <th className="rpt-ans-lbl"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.rows.map((row: any, rIdx: number) => (
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
                            ))}
                        </div>
                    ))}
                </div>
            )}

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
                    .report-page { page-break-before: always; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; }
                    .report-page:first-child { page-break-before: auto; }
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
                }
            `}} />
        </div>
    );
}
