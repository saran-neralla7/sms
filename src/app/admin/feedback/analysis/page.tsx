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

    useEffect(() => {
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
    }, []);

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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Feedback Analysis Reports</h1>
                        <p className="text-slate-500 mt-1">Select a feedback window to generate detailed response matrices.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
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
                </div>
            </div>

            {/* LOADING STATE */}
            {loadingReport && (
                <div className="flex justify-center items-center py-20 no-print">
                    <FaSpinner className="animate-spin text-4xl text-fuchsia-500" />
                </div>
            )}

            {/* PRINTABLE REPORT SECTION */}
            {!loadingReport && reportData && reportData.reports && (
                <div className={`print-container ${printSubjectIndex !== null ? 'print-single-mode' : ''}`}>
                    {reportData.reports.map((report: any, index: number) => (
                        <div 
                            key={index} 
                            className={`report-page relative mb-16 bg-white p-0 md:p-8 rounded-xl shadow-sm md:border border-slate-200 md:mb-8 print-no-border print-no-shadow ${printSubjectIndex === index ? 'print-active' : ''}`}
                        >
                            {/* Individual Print Button */}
                            <button
                                onClick={() => handlePrintSubject(index)}
                                className="no-print absolute top-4 right-4 bg-fuchsia-500 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-fuchsia-600 shadow-sm"
                            >
                                <FaPrint className="inline mr-1" /> Export PDF
                            </button>
                            
                            {/* Report Header Table */}
                            <table className="w-full border-collapse border border-black mb-0 text-sm font-sans">
                                <tbody>
                                    <tr>
                                        <td colSpan={6} className="border border-black text-center font-bold py-2 bg-gray-100 text-lg">
                                            Student Feedback on Teachers
                                        </td>
                                        <td rowSpan={2} className="border border-black text-center w-24 p-1">
                                            {report.facultyPhoto ? (
                                                <img src={report.facultyPhoto} alt="Faculty" className="h-16 w-16 mx-auto object-cover rounded" />
                                            ) : (
                                                <div className="text-[10px] text-gray-400">Photo</div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black font-bold px-2 py-1 bg-gray-50">COURSE:</td>
                                        <td className="border border-black px-2 py-1 text-center font-bold text-red-600">{reportData.metadata.course}</td>
                                        <td className="border border-black font-bold px-2 py-1 bg-gray-50 text-center">SEMESTER</td>
                                        <td className="border border-black px-2 py-1 text-center font-bold text-red-600">{reportData.metadata.semester}</td>
                                        <td colSpan={2} className="border border-black text-center font-bold py-1 bg-gray-50 text-base">
                                            Academic Year: {reportData.metadata.academicYear}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black font-bold px-2 py-1 bg-gray-50">BATCH:</td>
                                        <td className="border border-black px-2 py-1 text-center font-bold">{reportData.metadata.batch}</td>
                                        <td className="border border-black font-bold px-2 py-1 bg-gray-50 text-center">SECTION</td>
                                        <td className="border border-black px-2 py-1 text-center font-bold text-blue-500">{reportData.metadata.sections}</td>
                                        <td colSpan={3} className="border border-black bg-gray-200"></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} className="border border-black font-bold px-2 py-1 bg-gray-50 text-center">Faculty Name:</td>
                                        <td colSpan={2} className="border border-black px-2 py-1 text-center font-bold text-red-600">{report.facultyName}</td>
                                        <td className="border border-black font-bold px-2 py-1 bg-gray-50 text-center">Subject:</td>
                                        <td className="border border-black px-2 py-1 text-center font-bold text-red-600">{report.subjectName}</td>
                                        <td className="border border-black px-2 py-1 text-center font-bold text-blue-600 text-xs">
                                            No.Of Respondents: {report.respondents}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Questions Headers */}
                            <table className="w-full border-collapse border border-black text-xs font-sans mt-0 table-fixed">
                                <thead>
                                    <tr>
                                        <th colSpan={reportData.ratingQuestions.length + 1} className="border border-black text-center font-bold py-1 text-red-600 bg-gray-50">
                                            QUESTIONS
                                        </th>
                                    </tr>
                                    <tr>
                                        {reportData.ratingQuestions.map((q: string, qIdx: number) => (
                                            <th key={qIdx} className="border border-black px-1 py-2 text-center font-bold align-top leading-tight" style={{ width: `${100 / (reportData.ratingQuestions.length + 2)}%`}}>
                                                {q}
                                            </th>
                                        ))}
                                        <th className="border border-black px-1 py-2 text-center font-bold text-red-600 w-1/5">
                                            Remarks/Comments
                                        </th>
                                    </tr>
                                    <tr className="bg-blue-50">
                                        {reportData.ratingQuestions.map((_: any, qIdx: number) => (
                                            <th key={`ans-${qIdx}`} className="border border-black px-1 py-1 text-center font-bold text-blue-800">
                                                Ans-{qIdx + 1}
                                            </th>
                                        ))}
                                        <th className="border border-black bg-white"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.rows.map((row: any, rIdx: number) => (
                                        <tr key={rIdx}>
                                            {row.answers.map((ans: any, aIdx: number) => (
                                                <td key={aIdx} className="border border-black px-1 py-1 text-center">
                                                    {ans}
                                                </td>
                                            ))}
                                            <td className="border border-black px-2 py-1 text-center text-[10px] leading-tight">
                                                {row.remarks}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* OVERALL SCORE ROW */}
                                    <tr className="bg-gray-100 font-bold">
                                        <td colSpan={reportData.ratingQuestions.length} className="border border-black px-2 py-2 text-right">
                                            OVERALL FEEDBACK SCORE (OUT OF 5):
                                        </td>
                                        <td className="border border-black px-2 py-2 text-center text-lg text-green-700">
                                            {report.overallAverage}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body {
                        background-color: white;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-container {
                        width: 100%;
                    }
                    .print-single-mode .report-page:not(.print-active) {
                        display: none !important;
                    }
                    .report-page {
                        page-break-after: always;
                        page-break-inside: avoid;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    .report-page:last-child {
                        page-break-after: auto;
                    }
                    .print-no-border { border: none !important; }
                    .print-no-shadow { box-shadow: none !important; }
                }
            `}} />
        </div>
    );
}
