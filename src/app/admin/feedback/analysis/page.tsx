"use client";

import { useState, useEffect } from "react";
import { FaPrint, FaSpinner } from "react-icons/fa";

export default function FeedbackAnalysisPage() {
    const [forms, setForms] = useState<any[]>([]);
    const [selectedFormId, setSelectedFormId] = useState("");
    const [reportData, setReportData] = useState<any>(null);
    const [loadingForms, setLoadingForms] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);
    const [printSubjectIndex, setPrintSubjectIndex] = useState<number | null>(null);

    // New States for Tabs and Overall Faculty
    const [activeTab, setActiveTab] = useState<"WINDOW" | "OVERALL">("WINDOW");
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [selectedYearId, setSelectedYearId] = useState("");
    const [selectedDeptId, setSelectedDeptId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [facultyData, setFacultyData] = useState<any[]>([]);
    const [loadingFaculty, setLoadingFaculty] = useState(false);

    useEffect(() => {
        // Fetch Forms
        fetch("/api/admin/feedback/forms")
            .then(res => res.json())
            .then(data => {
                setForms(data);
                setLoadingForms(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingForms(false);
            });

        // Fetch Metadata for Overall Tab
        Promise.all([
            fetch("/api/academic-years").then(r => r.json()),
            fetch("/api/departments?all=true").then(r => r.json())
        ]).then(([years, depts]) => {
            if (Array.isArray(years)) {
                setAcademicYears(years);
                const currentYear = years.find(y => y.isCurrent);
                if (currentYear) setSelectedYearId(currentYear.id);
            }
            if (Array.isArray(depts)) {
                setDepartments(depts);
            }
        }).catch(console.error);
    }, []);

    // Fetch Overall Faculty Data
    useEffect(() => {
        if (activeTab === "OVERALL" && selectedYearId) {
            setLoadingFaculty(true);
            const params = new URLSearchParams();
            params.append("academicYearId", selectedYearId);
            if (selectedDeptId) params.append("departmentId", selectedDeptId);
            if (searchQuery) params.append("search", searchQuery);

            fetch(`/api/admin/feedback/analysis/overall?${params.toString()}`)
                .then(res => res.json())
                .then(data => {
                    setFacultyData(Array.isArray(data) ? data : []);
                    setLoadingFaculty(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoadingFaculty(false);
                });
        }
    }, [activeTab, selectedYearId, selectedDeptId, searchQuery]);

    useEffect(() => {
        if (!selectedFormId) {
            setReportData(null);
            return;
        }

        setLoadingReport(true);
        fetch(`/api/admin/feedback/analysis/report?formId=${selectedFormId}`)
            .then(res => res.json())
            .then(data => {
                setReportData(data);
                setLoadingReport(false);
            })
            .catch(err => {
                console.error(err);
                setLoadingReport(false);
            });
    }, [selectedFormId]);

    const handlePrint = () => {
        setPrintSubjectIndex(null); // Print all
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handlePrintSubject = (index: number) => {
        setPrintSubjectIndex(index);
        setTimeout(() => {
            window.print();
            setPrintSubjectIndex(null); // Reset after print dialog
        }, 100);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto printable-area">
            {/* NO-PRINT HEADER SECTION */}
            <div className="no-print mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Feedback Analysis Reports</h1>
                        <p className="text-slate-500 mt-1">View detailed feedback matrices or overall faculty rankings.</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab("WINDOW")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === "WINDOW" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            By Feedback Window
                        </button>
                        <button
                            onClick={() => setActiveTab("OVERALL")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === "OVERALL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Overall Faculty Rankings
                        </button>
                    </div>
                </div>

                {/* WINDOW TAB FILTERS */}
                {activeTab === "WINDOW" && (
                    <div className="flex items-center justify-end gap-3 w-full border-t border-slate-100 pt-4">
                        <select
                            value={selectedFormId}
                            onChange={(e) => setSelectedFormId(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg bg-white min-w-[300px] focus:ring-2 focus:ring-fuchsia-500 outline-none"
                            disabled={loadingForms}
                        >
                            <option value="">-- Select Feedback Window --</option>
                            {forms.map(f => (
                                <option key={f.id} value={f.id}>{f.title}</option>
                            ))}
                        </select>

                        <button
                            onClick={handlePrint}
                            disabled={!reportData || loadingReport}
                            className="bg-slate-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            <FaPrint /> Print / PDF
                        </button>
                    </div>
                )}

                {/* OVERALL TAB FILTERS */}
                {activeTab === "OVERALL" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                        <select
                            value={selectedYearId}
                            onChange={(e) => setSelectedYearId(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none w-full"
                        >
                            <option value="">-- Select Academic Year --</option>
                            {academicYears.map(y => (
                                <option key={y.id} value={y.id}>{y.name}</option>
                            ))}
                        </select>

                        <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none w-full"
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                            ))}
                        </select>

                        <input
                            type="text"
                            placeholder="Search Faculty Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-fuchsia-500 outline-none w-full"
                        />
                    </div>
                )}
            </div>

            {/* OVERALL TAB CONTENT */}
            {activeTab === "OVERALL" && (
                <div className="no-print">
                    {loadingFaculty ? (
                        <div className="flex justify-center py-20">
                            <FaSpinner className="animate-spin text-4xl text-fuchsia-500" />
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 font-semibold text-slate-600 text-sm w-16 text-center">S.No</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm">Faculty</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm text-center">Department</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm text-center">Overall Score</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facultyData.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-500">
                                                No faculty feedback data found for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        facultyData.map((fac, idx) => (
                                            <tr key={fac.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                                <td className="p-4 text-center text-slate-500 font-medium">{idx + 1}</td>
                                                <td className="p-4 flex items-center gap-3">
                                                    {fac.photoUrl ? (
                                                        <img src={fac.photoUrl} alt={fac.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">NA</div>
                                                    )}
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{fac.name}</p>
                                                        <p className="text-xs text-slate-500">{fac.totalRespondents} Responded across all subjects</p>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold">
                                                        {fac.departmentCode}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`inline-flex items-center justify-center w-12 h-8 rounded font-bold ${fac.overallAverage >= 4.0 ? 'bg-green-100 text-green-700' : fac.overallAverage >= 3.0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                        {fac.overallAverage}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <a 
                                                        href={`/admin/feedback/analysis/faculty/${fac.id}?academicYearId=${selectedYearId}`}
                                                        className="inline-block bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 px-3 py-1.5 rounded-md text-sm font-semibold transition"
                                                    >
                                                        View Reports
                                                    </a>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* WINDOW TAB CONTENT */}
            {activeTab === "WINDOW" && (
                <>
                    {/* LOADING STATE */}
                    {loadingReport && (
                        <div className="flex justify-center items-center py-20 no-print">
                            <FaSpinner className="animate-spin text-4xl text-fuchsia-500" />
                        </div>
                    )}

                    {/* PRINTABLE REPORT SECTION */}
                    {!loadingReport && reportData && reportData.reports && (
                <div className={`print-container ${printSubjectIndex !== null ? 'print-single-mode' : ''}`}>

                    {/* SUMMARY REPORT PAGE */}
                    <div className={`report-page relative mb-16 bg-white p-0 md:p-8 rounded-xl shadow-sm md:border border-slate-200 md:mb-8 ${printSubjectIndex !== null ? 'no-print hidden' : ''}`}>
                         {/* Header */}
                         <div className="text-center font-bold mb-4" style={{ fontFamily: 'Times New Roman, serif' }}>
                             <div className="text-[17px]">Feedback Analysis of {reportData.metadata.year ? `${reportData.metadata.year}/IV` : ""} B.Tech {reportData.metadata.semester} Sem</div>
                             <div className="text-[15px] underline mt-1">ACADEMIC YEAR: {reportData.metadata.academicYear}</div>
                         </div>
                         
                         {/* Table */}
                         <table className="w-full border-collapse border-[2px] border-black" style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px' }}>
                            <thead>
                                <tr>
                                    <th colSpan={9} className="border border-black p-1.5 text-center bg-white font-bold">{reportData.metadata.course} Engineering</th>
                                </tr>
                                <tr className="bg-white font-bold">
                                    <th className="border border-black p-1.5 text-center">Subject</th>
                                    <th className="border border-black p-1.5 text-center">Faculty</th>
                                    <th className="border border-black p-1.5 text-center">Excellents</th>
                                    <th className="border border-black p-1.5 text-center">Very Good</th>
                                    <th className="border border-black p-1.5 text-center">Good</th>
                                    <th className="border border-black p-1.5 text-center">Fair</th>
                                    <th className="border border-black p-1.5 text-center">Poor</th>
                                    <th className="border border-black p-1.5 text-center">Total scripts</th>
                                    <th className="border border-black p-1.5 text-center">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.reports.map((report: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="border border-black p-1.5 text-center uppercase">{report.subjectName.split('(')[0].trim()}</td>
                                        <td className="border border-black p-1.5 text-center">{report.facultyName}</td>
                                        <td className="border border-black p-1.5 text-center">{report.excellents || 0}</td>
                                        <td className="border border-black p-1.5 text-center">{report.veryGood || 0}</td>
                                        <td className="border border-black p-1.5 text-center">{report.good || 0}</td>
                                        <td className="border border-black p-1.5 text-center">{report.fair || 0}</td>
                                        <td className="border border-black p-1.5 text-center">{report.poor || 0}</td>
                                        <td className="border border-black p-1.5 text-center">{report.totalRatings || 0}</td>
                                        <td className="border border-black p-1.5 text-center font-bold">{report.overallAverage}</td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>

                    {/* COLLEGE HEADER — only shown in print (fixed = appears on every page) */}

                    {reportData.reports.map((report: any, index: number) => (
                        <div
                            key={index}
                            className={`report-page relative mb-16 bg-white p-0 md:p-8 rounded-xl shadow-sm md:border border-slate-200 md:mb-8 ${printSubjectIndex === index ? 'print-active' : ''}`}
                        >
                            {/* Screen-only Export button */}
                            <button
                                onClick={() => handlePrintSubject(index)}
                                className="no-print absolute top-4 right-4 bg-fuchsia-500 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-fuchsia-600 shadow-sm"
                            >
                                <FaPrint className="inline mr-1" /> Export PDF
                            </button>

                            {/* COLLEGE HEADER — inside every report-page so it prints on each subject page */}
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
            )}
                </>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                /* ===== SCREEN: hide college header ===== */
                .print-college-header { display: none; }
                .pch-inner { display:flex; align-items:center; gap:12px; }
                .pch-logo { height:52px; width:auto; object-fit:contain; flex-shrink:0; }
                .pch-title { font-weight:900; font-size:13px; text-transform:uppercase; letter-spacing:0.3px; line-height:1.4; }
                .pch-sub { font-size:11px; font-weight:700; line-height:1.4; }
                .pch-line { border-top:2px solid black; margin-top:5px; }

                /* ===== SCREEN: data table looks clean ===== */
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

                /* ===== PRINT STYLES ===== */
                @media print {
                    @page { size: A4 portrait; margin: 10mm 12mm; }

                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Hide website chrome — nav/sidebar/topbar/buttons */
                    .no-print, header, nav, aside, footer { display: none !important; }

                    /* Make printable container fill the page */
                    .printable-area {
                        padding: 0 !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                    }

                    /* College header — show, full width, at top of each report-page block */
                    .print-college-header {
                        display: block !important;
                        margin-bottom: 6px;
                    }
                    .pch-inner { display: flex !important; align-items: center !important; gap: 10px !important; }
                    .pch-logo { height: 50px !important; width: auto !important; object-fit: contain !important; flex-shrink: 0 !important; }
                    .pch-title { font-weight: 900 !important; font-size: 11px !important; text-transform: uppercase !important; line-height: 1.4 !important; }
                    .pch-sub { font-size: 9.5px !important; font-weight: 700 !important; line-height: 1.4 !important; }
                    .pch-line { border-top: 2px solid black !important; margin-top: 4px !important; }

                    .print-container { width: 100%; }
                    .print-single-mode .report-page:not(.print-active) { display: none !important; }

                    /* Each subject = new page */
                    .report-page {
                        page-break-before: always;
                        margin: 0 !important; padding: 0 !important;
                        border: none !important; box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    .report-page:first-child { page-break-before: auto; }

                    /* META TABLE print */
                    .rpt-meta-tbl { font-size: 9px !important; }
                    .rpt-meta-tbl td { padding: 3px 5px !important; }
                    .rpt-title { font-size: 11px !important; padding: 4px !important; }
                    .rpt-photo { height: 65px !important; width: 65px !important; }
                    .rpt-score-val { font-size: 20px !important; }

                    /* DATA TABLE print */
                    .rpt-data-tbl { font-size: 8px !important; }
                    .rpt-q-text { font-size: 7px !important; padding: 2px 2px !important; line-height: 1.25 !important; }
                    .rpt-ans-lbl { font-size: 7.5px !important; padding: 2px 1px !important; }
                    .rpt-ans-val { font-size: 8px !important; padding: 2px 1px !important; }
                    .rpt-remark { font-size: 7.5px !important; padding: 2px 3px !important; word-wrap: break-word !important; white-space: normal !important; overflow-wrap: break-word !important; }

                    table { page-break-inside: auto !important; }
                    tr { page-break-inside: avoid !important; }
                    thead { display: table-header-group !important; }
                }
            `}} />
        </div>
    );
}
