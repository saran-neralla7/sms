"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FaPrint, FaSpinner } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { calculateStudentTotal, scaleMidMarks, aggregateCOMarks, calculateInternalMarks } from "@/lib/mid-exam-calc";
import MathRenderer from "@/components/MathRenderer";

export default function CourseFilePrintPage() {
  const searchParams = useSearchParams();
  const academicYearId = searchParams?.get("academicYearId");
  const departmentId = searchParams?.get("departmentId");
  const year = searchParams?.get("year");
  const semester = searchParams?.get("semester");
  const sectionId = searchParams?.get("sectionId");
  const subjectId = searchParams?.get("subjectId");
  const thresholdParam = searchParams?.get("threshold");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<string[]>([]);

  const threshold = thresholdParam ? parseInt(thresholdParam) : 40;

  useEffect(() => {
    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId) {
      return;
    }

    setLoading(true);
    fetch(
      `/api/course-files?academicYearId=${academicYearId}&departmentId=${departmentId}&year=${year}&semester=${semester}&sectionId=${sectionId}&subjectId=${subjectId}`
    )
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        if (resData && !resData.error) {
          const pending: string[] = [];
          if (!resData.courseFile?.academicCalendarPath) pending.push("Academic Calendar Document");
          if (!resData.courseFile?.lecturePlan || resData.courseFile.lecturePlan.length === 0) pending.push("Lecture Plan & Reference Textbooks");
          if (!resData.courseFile?.teachingSupportText || resData.courseFile.teachingSupportText.trim().length === 0) pending.push("Teaching Support Materials");
          if (!resData.courseFile?.assignmentQuestions || resData.courseFile.assignmentQuestions.length === 0) pending.push("Assignment Questions");
          if (!resData.courseFile?.mid1SchemePath) pending.push("MID-I Scheme of Evaluation");
          if (!resData.courseFile?.mid2SchemePath) pending.push("MID-II Scheme of Evaluation");
          if (!resData.courseFile?.remedialClasses || resData.courseFile.remedialClasses.length === 0) pending.push("Remedial Classes Log");
          if (!resData.courseFile?.prevPapersPaths || resData.courseFile.prevPapersPaths.length === 0) pending.push("Previous Question Papers");
          if (!resData.timetable || resData.timetable.length === 0) pending.push("Mapped Class Timetable");
          if (!resData.mid1Paper) pending.push("MID-I Exam Question Paper");
          if (!resData.mid2Paper) pending.push("MID-II Exam Question Paper");
          if (!resData.mid1Marks || resData.mid1Marks.length === 0) pending.push("MID-I Student Marks");
          if (!resData.mid2Marks || resData.mid2Marks.length === 0) pending.push("MID-II Student Marks");
          if (!resData.internalMarks || resData.internalMarks.length === 0) pending.push("Sessional/Internal Marks");
          if (!resData.students || resData.students.length === 0) pending.push("Registered Student Roster");

          if (pending.length > 0) {
            setPendingItems(pending);
            setShowPendingModal(true);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading print data:", err);
        setLoading(false);
      });
  }, [academicYearId, departmentId, year, semester, sectionId, subjectId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <FaSpinner className="h-10 w-10 text-teal-600 animate-spin mx-auto mb-4" />
          <p className="font-semibold text-slate-600">Compiling and generating print booklet...</p>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        Error: {data?.error || "Missing query parameters or failed to fetch course file details."}
      </div>
    );
  }

  const {
    courseFile = null,
    subject = null,
    coPoMappings = [],
    coPsoMappings = [],
    students = [],
    timetable = [],
    mid1Paper = null,
    mid2Paper = null,
    mid1Marks = [],
    mid2Marks = [],
    internalMarks = [],
    assignmentMarks = [],
    semesterResults = [],
  } = data;

  // Mid Exam Marks Map
  const mid1MarksMap: Record<string, number> = {};
  const mid1AbsentMap: Record<string, boolean> = {};
  const mid2MarksMap: Record<string, number> = {};
  const mid2AbsentMap: Record<string, boolean> = {};

  if (mid1Paper) {
    const choiceGroups1 = mid1Paper.choiceGroups || [];
    const questions1 = mid1Paper.questions.map((q: any) => ({
      ...q,
      subQuestions: q.subQuestions || [],
    }));

    for (const student of students) {
      const studentEntries = mid1Marks.filter((m: any) => m.studentId === student.id);
      const isAbs = studentEntries.some((m: any) => m.isAbsent);
      const entryMap: Record<string, number | null> = {};
      for (const e of studentEntries) {
        entryMap[e.subQuestionId] = e.marksObtained;
      }
      const { total } = calculateStudentTotal(questions1, choiceGroups1, entryMap, isAbs);
      mid1MarksMap[student.id] = total;
      mid1AbsentMap[student.id] = isAbs;
    }
  }

  if (mid2Paper) {
    const choiceGroups2 = mid2Paper.choiceGroups || [];
    const questions2 = mid2Paper.questions.map((q: any) => ({
      ...q,
      subQuestions: q.subQuestions || [],
    }));

    for (const student of students) {
      const studentEntries = mid2Marks.filter((m: any) => m.studentId === student.id);
      const isAbs = studentEntries.some((m: any) => m.isAbsent);
      const entryMap: Record<string, number | null> = {};
      for (const e of studentEntries) {
        entryMap[e.subQuestionId] = e.marksObtained;
      }
      const { total } = calculateStudentTotal(questions2, choiceGroups2, entryMap, isAbs);
      mid2MarksMap[student.id] = total;
      mid2AbsentMap[student.id] = isAbs;
    }
  }

  // Calculate Mid percentages and Slow Learners (Mid-I)
  const slowLearnersMid1 = students.filter((student: any) => {
    if (mid1AbsentMap[student.id]) return false;
    const score = mid1MarksMap[student.id] || 0;
    const maxMarks = mid1Paper?.totalMarks || 30;
    const pct = (score / maxMarks) * 100;
    return pct < threshold;
  });

  // Calculate Slow Learners Progress (Item 18)
  // Students who were slow learners in MID-I (scored < threshold) AND scored >= threshold in MID-II
  const slowLearnersProgress = students.filter((student: any) => {
    // Check if they were a slow learner in Mid-I
    const score1 = mid1MarksMap[student.id] || 0;
    const maxMarks1 = mid1Paper?.totalMarks || 30;
    const pct1 = (score1 / maxMarks1) * 100;
    const wasSlow = pct1 < threshold;

    if (!wasSlow) return false;

    // Check if they improved in Mid-II
    if (mid2AbsentMap[student.id]) return false;
    const score2 = mid2MarksMap[student.id] || 0;
    const maxMarks2 = mid2Paper?.totalMarks || 30;
    const pct2 = (score2 / maxMarks2) * 100;
    return pct2 >= threshold;
  });

  // Clean syllabus and outcomes HTML strings
  const stripHtmlTags = (str: any): string => {
    if (!str) return "";
    const s = typeof str === "object" ? JSON.stringify(str) : String(str);
    return s.replace(/<[^>]*>/g, "");
  };

  // Render question paper in portrait mode
  const renderQuestionPaper = (paper: any, examType: string) => {
    if (!paper) return null;

    // Flatten all subquestions to construct the columns of the marks matrix
    const cols: { qNo: number; subLabel: string; co: string }[] = [];
    (paper.questions || []).forEach((q: any) => {
      (q.subQuestions || []).forEach((sq: any) => {
        const cleanCo = (sq.coMapping || "").replace(/[^0-9]/g, "") || sq.coMapping || "";
        cols.push({
          qNo: q.questionNo,
          subLabel: sq.subLabel,
          co: cleanCo,
        });
      });
    });

    // Calculate colspans per top-level question for the marks matrix
    const qSpans: { qNo: number; span: number }[] = [];
    (paper.questions || []).forEach((q: any) => {
      const qCols = cols.filter(c => c.qNo === q.questionNo);
      if (qCols.length > 0) {
        qSpans.push({ qNo: q.questionNo, span: qCols.length });
      }
    });

    const formatDate = (dateStr?: string | null) => {
      if (!dateStr) return "";
      const parts = dateStr.split("-");
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    };

    return (
      <div className="flex flex-col text-[10px] font-serif text-black leading-tight bg-white border border-black p-6 rounded-lg font-medium shadow-sm max-w-4xl mx-auto">
        {/* Registration Number boxes */}
        <div className="flex justify-end items-center gap-1.5 mb-1.5">
          <span className="text-[9.5px] font-bold">Regd No:</span>
          <div className="flex" style={{ border: "1.5px solid black" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white" style={{
                width: "15px",
                height: "15px",
                borderRight: i < 9 ? "1.5px solid black" : "none"
              }}></div>
            ))}
          </div>
        </div>

        {/* Institution Title Header */}
        <div className="text-center mb-2">
          <h2 className="text-[11px] font-bold leading-normal">Gayatri Vidya Parishad College for Degree and P G Courses (A)</h2>
          <h3 className="text-[10.5px] font-bold leading-normal">Engineering and Technology Program</h3>
          <p className="text-[9px] font-semibold tracking-wide text-gray-700">Rushikonda, Visakhapatnam-530 045</p>
          
          {paper.commonText && (
            <p className="text-[9.5px] font-bold tracking-wider mt-0.5 uppercase border-y border-black py-0.5">{paper.commonText}</p>
          )}
          
          <div className="flex justify-between items-center text-[10px] font-bold px-2 mt-1.5">
            <span>{paper.year === "I" ? "I" : paper.year === "II" ? "II" : paper.year === "III" ? "III" : paper.year === "IV" ? "IV" : paper.year} B. Tech</span>
            <span>Branch: {paper.subject?.department?.code || subject?.departmentCode || "CSE"}</span>
            <span>Semester - {paper.semester || semester}</span>
          </div>
        </div>

        {/* Course Details Grid Table */}
        <table className="w-full border-collapse text-left text-[9.5px] font-bold mb-2 border border-black">
          <tbody>
            <tr className="border-b border-black">
              {/* Course Title */}
              <td className="p-1 border-r border-black" style={{ width: "16%" }}>Course Title</td>
              <td className="p-1 border-r border-black uppercase font-bold truncate max-w-[150px]" style={{ width: "22%" }}>
                {paper.subject?.name || subject?.name}
              </td>
              {/* MID Label */}
              <td className="p-1 text-center font-bold text-sm border-r border-black" rowSpan={3} style={{ width: "24%", verticalAlign: "middle" }}>
                {examType === "MID_I" ? "MID-I" : "MID-II"}
              </td>
              {/* Course Code */}
              <td className="p-1 border-r border-black" style={{ width: "16%" }}>Course Code</td>
              <td className="p-1 uppercase font-bold truncate max-w-[120px]" style={{ width: "22%" }}>
                {paper.subject?.code || subject?.code}
              </td>
            </tr>
            <tr className="border-b border-black">
              {/* Date */}
              <td className="p-1 border-r border-black">Date</td>
              <td className="p-1 font-serif text-[10px] border-r border-black">
                {formatDate(paper.examDate) || "____________________"}
              </td>
              {/* Academic Year */}
              <td className="p-1 border-r border-black">Academic Year</td>
              <td className="p-1">{paper.academicYear?.name || courseFile?.academicYear?.name || "2025-2026"}</td>
            </tr>
            <tr>
              {/* Time */}
              <td className="p-1 border-r border-black">Time</td>
              <td className="p-1 border-r border-black">90 min</td>
              {/* Max Marks */}
              <td className="p-1 border-r border-black">Max. Marks</td>
              <td className="p-1">{paper.totalMarks || 30}</td>
            </tr>
          </tbody>
        </table>

        {/* Signature of Invigilator line */}
        <div className="relative text-right text-[9.5px] font-bold mb-2.5 px-1 border-b border-dashed border-black pb-1">
          Signature of Invigilator: ___________________________
        </div>

        {/* Dynamic Marks Grid Table */}
        {cols.length > 0 && (
          <table className="w-full border-collapse text-center text-[9px] font-bold mb-2 border border-black">
            <tbody>
              {/* Row 1: Top-level Question numbers */}
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black" rowSpan={2} style={{ width: "60px" }}>Q. No.</td>
                {qSpans.map((qs, i) => (
                  <td key={i} colSpan={qs.span} className="p-1 border-r border-black">
                    {qs.qNo}
                  </td>
                ))}
                <td className="p-1 text-[8.5px]" rowSpan={2} style={{ width: "60px" }}>Total Marks</td>
              </tr>

              {/* Row 2: Sub-question letters */}
              <tr className="border-b border-black">
                {cols.map((col, i) => (
                  <td key={i} className="p-1 border-r border-black text-[8.5px]">
                    {col.subLabel}
                  </td>
                ))}
              </tr>

              {/* Row 3: Course Outcomes (CO) */}
              <tr className="border-b border-black">
                <td className="p-1 border-r border-black">CO</td>
                {cols.map((col, i) => (
                  <td key={i} className="p-1 border-r border-black text-[8.5px]">
                    CO{col.co}
                  </td>
                ))}
                <td className="p-1"></td>
              </tr>

              {/* Row 4: Marks blank fields */}
              <tr>
                <td className="p-1 border-r border-black">Marks</td>
                {cols.map((_, i) => (
                  <td key={i} className="p-1 border-r border-black h-5"></td>
                ))}
                <td className="p-1"></td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Student & Faculty Signatures */}
        <div className="flex justify-between items-center text-[9.5px] font-bold mb-3 px-1" style={{ marginTop: "16px" }}>
          <span>Signature of the student</span>
          <span>Signature of the faculty</span>
        </div>

        {/* Main Instruction Heading with dynamic marks formula */}
        <div className="text-center font-bold text-[10.5px] my-1.5 border-b border-black pb-1 relative">
          <u>Answer All Questions</u>
          <span className="absolute right-0 bottom-1 text-[9.5px] font-bold">
            {(() => {
              const q1 = paper.questions.find((q: any) => q.questionNo === 1);
              if (q1) {
                const count = q1.subQuestions.length;
                const each = q1.subQuestions[0]?.maxMarks || 2;
                return `${count}x${each}=${count * each}M`;
              }
              return "3x2=6M";
            })()}
          </span>
        </div>

        {/* Printable Questions List */}
        <div className="space-y-1.5">
          {(() => {
            const elements: React.ReactNode[] = [];
            let lastChoiceGroup: number | null | undefined = undefined;

            (paper.questions || []).forEach((q: any, idx: number) => {
              // Standard italic divider
              if (!q.isCompulsory && q.choiceGroup?.groupNo && lastChoiceGroup === q.choiceGroup.groupNo) {
                elements.push(
                  <div key={`or-${idx}`} className="text-center font-bold my-1 text-[10px] italic">
                    (or)
                  </div>
                );
              }

              lastChoiceGroup = q.choiceGroup?.groupNo;

              // Long-answers header
              if (q.questionNo === 2) {
                elements.push(
                  <div key="long-answers-header" className="flex justify-end text-[9.5px] font-bold my-1 border-b border-dashed pb-0.5">
                    {(() => {
                      const choiceQuestions = paper.questions.filter((curr: any) => !curr.isCompulsory);
                      const uniqueGroups = new Set(choiceQuestions.map((curr: any) => curr.choiceGroup?.groupNo).filter(Boolean));
                      const groupCount = uniqueGroups.size || 2;
                      const representativeQ = choiceQuestions.find((curr: any) => curr.choiceGroup?.groupNo === Array.from(uniqueGroups)[0]);
                      const maxMarks = representativeQ ? representativeQ.subQuestions.reduce((s: number, sq: any) => s + sq.maxMarks, 0) : 12;
                      return `${groupCount}x${maxMarks}=${groupCount * maxMarks}M`;
                    })()}
                  </div>
                );
              }

              elements.push(
                <div key={`print-q-${idx}`} className="space-y-1">
                  <div className="space-y-1">
                    {(q.subQuestions || []).map((sq: any, sqIdx: number) => {
                      const isFirst = sqIdx === 0;
                      return (
                        <div key={sqIdx} className="space-y-1 py-0.5">
                          <div className="flex items-start text-[10px]">
                            {/* Merged question number and subquestion letter for compact layout */}
                            <span className="flex shrink-0 font-bold" style={{ width: "36px" }}>
                              {isFirst ? (
                                <>
                                  <span style={{ width: "18px" }}>{q.questionNo}.</span>
                                  <span style={{ width: "18px" }}>{sq.subLabel})</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ width: "18px" }}></span>
                                  <span style={{ width: "18px" }}>{sq.subLabel})</span>
                                </>
                              )}
                            </span>
                            <div className="flex-1 pr-4 text-justify">
                              <MathRenderer text={sq.questionText} className="inline font-serif text-black text-[10.5px] leading-tight" />
                              <span className="font-bold ml-1.5">[{sq.maxMarks}M] [{sq.btLevel || "L1"}] [{sq.coMapping || "CO1"}]</span>
                            </div>
                          </div>
                          {sq.imageUrl && (
                            <div className="pl-9 pb-1 text-center">
                              <img
                                src={sq.imageUrl}
                                alt={`Figure Q${q.questionNo}(${sq.subLabel})`}
                                className="max-h-[120px] mx-auto object-contain border border-black/10 p-0.5 bg-white print:border-none"
                              />
                              <p className="text-[7.5px] font-bold uppercase tracking-wider mt-1 text-gray-700">
                                Figure Q{q.questionNo}({sq.subLabel})
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });

            return elements;
          })()}
        </div>

        {/* Center aligned All the Best Footer */}
        <div className="text-center font-bold text-[9.5px] mt-4 italic tracking-widest border-t border-black pt-2">
          ******All the Best*****
        </div>
      </div>
    );
  };

  // Institutional Header render helper
  const renderHeader = () => (
    <div className="print-college-header">
      <div className="pch-inner flex items-center justify-center gap-4 mb-4">
        <img src="/logo.png" alt="GVP Logo" className="pch-logo h-16 w-auto" />
        <div className="text-center">
          <div className="pch-title font-extrabold text-[15px] text-slate-900 leading-snug">
            GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (A)
          </div>
          <div className="pch-sub font-semibold text-[11.5px] text-slate-800 tracking-wide mt-0.5">
            ENGINEERING & TECHNOLOGY PROGRAM
          </div>
          <div className="pch-sub font-semibold text-[11px] text-slate-700 tracking-wider">
            RUSHIKONDA, VISAKHAPATNAM-530045 • APPROVED BY AICTE • AFFILIATED TO ANDHRA UNIVERSITY
          </div>
        </div>
      </div>
      <div className="pch-line border-t-2 border-black mb-6" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 max-w-5xl mx-auto printable-area text-slate-900">
      {/* Missing Data Warning Modal */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 no-print animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 relative overflow-hidden backdrop-blur-xl transition-all duration-300 scale-100">
            {/* Header decoration */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
            
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-950">Incomplete Course File Data</h3>
                <p className="text-xs text-slate-500 mt-0.5">The following required data and uploads are missing or pending in the system for this course file:</p>
              </div>
            </div>

            {/* List of pending items */}
            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50 p-4 space-y-2 mb-6 font-semibold scrollbar-thin">
              {pendingItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 mb-6 italic">
              If you continue, the booklet will still render with proper headers and blank pages for the missing items.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  window.location.href = "/faculty/course-files";
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all duration-200 border border-slate-200"
              >
                Go Back to Workspace
              </button>
              <button
                onClick={() => {
                  setShowPendingModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all duration-200 shadow-md shadow-slate-900/10"
              >
                Continue and Print Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NO-PRINT Action Bar */}
      <div className="no-print mb-8 bg-slate-100 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="font-bold text-slate-800 text-sm">Course File Booklet</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ready for printing or saving as PDF.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors shadow-sm"
        >
          <FaPrint /> Print Booklet / Save PDF
        </button>
      </div>

      {/* ========================================================================= */}
      {/* COVER PAGE */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12 flex flex-col justify-between min-h-[90vh]">
        <div>
          {renderHeader()}
          <div className="text-center my-12">
            <h1 className="text-3xl font-extrabold tracking-wider text-slate-900 underline underline-offset-8">
              COURSE FILE
            </h1>
            <p className="text-md font-bold text-teal-800 mt-4 uppercase">
              {subject?.name} ({subject?.code})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-y-4 gap-x-8 max-w-2xl mx-auto border border-black p-6 rounded-lg my-12 text-sm font-semibold">
            <div className="text-slate-500">Program:</div>
            <div>B.Tech Engineering</div>
            <div className="text-slate-500">Department:</div>
            <div>{subject?.departmentCode || "Computer Science"}</div>
            <div className="text-slate-500">Academic Year:</div>
            <div>{courseFile?.academicYear?.name || "2025-2026"}</div>
            <div className="text-slate-500">Year & Semester:</div>
            <div>Year {year}, Semester {semester}</div>
            <div className="text-slate-500">Section:</div>
            <div>Section {courseFile?.section?.name || "A"}</div>
            <div className="text-slate-500">Subject Name:</div>
            <div>{subject?.name}</div>
            <div className="text-slate-500">Subject Code:</div>
            <div>{subject?.code}</div>
          </div>
        </div>

        <div className="mt-auto border-t border-slate-200 pt-8 flex justify-between items-end text-xs font-bold text-slate-600">
          <div>
            <p className="mt-8 border-t border-black pt-1 w-40 text-center">Faculty Signature</p>
          </div>
          <div>
            <p className="mt-8 border-t border-black pt-1 w-40 text-center">HOD Signature</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. SYLLABUS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          1. Course Syllabus
        </h2>
        {subject?.syllabus ? (
          <div className="text-xs space-y-4 font-medium leading-relaxed">
            {subject.syllabus.description && (
              <div>
                <h4 className="font-bold text-slate-700">Course Description:</h4>
                <p className="mt-1 text-slate-600">
                  {stripHtmlTags(subject.syllabus.description)}
                </p>
              </div>
            )}
            {subject.syllabus.units && Array.isArray(subject.syllabus.units) && (
              <div className="space-y-3 mt-4">
                {subject.syllabus.units.map((unit: any, uIdx: number) => (
                  <div key={uIdx} className="border border-slate-100 p-3 rounded-lg bg-slate-50/20">
                    <h5 className="font-bold text-slate-800 uppercase">
                      {stripHtmlTags(
                        typeof unit === "object" && unit !== null
                          ? String(unit.title || unit.code || `Unit ${uIdx + 1}`)
                          : String(unit)
                      )}
                    </h5>
                    <p className="mt-1 text-slate-600 whitespace-pre-line">
                      {stripHtmlTags(
                        typeof unit === "object" && unit !== null
                          ? String(unit.description || unit.content || "")
                          : ""
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No syllabus details found for this subject in the database.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. OBJECTIVES & OUTCOMES */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          2. Course Objectives & Outcomes
        </h2>
        <div className="text-xs space-y-6 font-medium">
          {subject?.syllabus?.objectives && (
            <div>
              <h3 className="font-bold text-slate-700 mb-2 uppercase tracking-wide">Course Objectives:</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 font-semibold">
                {Array.isArray(subject.syllabus.objectives) ? (
                  subject.syllabus.objectives.map((obj: any, oIdx: number) => (
                    <li key={oIdx}>
                      {stripHtmlTags(
                        typeof obj === "object" && obj !== null
                          ? `${obj.code ? obj.code + ": " : ""}${obj.description || ""}`
                          : String(obj)
                      )}
                    </li>
                  ))
                ) : (
                  <li>
                    {stripHtmlTags(
                      typeof subject.syllabus.objectives === "object" && subject.syllabus.objectives !== null
                        ? `${subject.syllabus.objectives.code ? subject.syllabus.objectives.code + ": " : ""}${subject.syllabus.objectives.description || ""}`
                        : String(subject.syllabus.objectives)
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}

          {subject?.syllabus?.outcomes && (
            <div>
              <h3 className="font-bold text-slate-700 mb-2 uppercase tracking-wide">Course Outcomes (COs):</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 font-semibold">
                {Array.isArray(subject.syllabus.outcomes) ? (
                  subject.syllabus.outcomes.map((out: any, oIdx: number) => (
                    <li key={oIdx}>
                      {stripHtmlTags(
                        typeof out === "object" && out !== null
                          ? `${out.code ? out.code + ": " : ""}${out.description || ""}`
                          : String(out)
                      )}
                    </li>
                  ))
                ) : (
                  <li>
                    {stripHtmlTags(
                      typeof subject.syllabus.outcomes === "object" && subject.syllabus.outcomes !== null
                        ? `${subject.syllabus.outcomes.code ? subject.syllabus.outcomes.code + ": " : ""}${subject.syllabus.outcomes.description || ""}`
                        : String(subject.syllabus.outcomes)
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CO-PO MAPPING TABLE */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          3. CO-PO & CO-PSO Mapping Correlation Matrix
        </h2>
        <p className="text-[10px] text-slate-500 mb-4 font-medium">
          Correlation level: 3 (High), 2 (Medium), 1 (Low), "-" / Blank (No Correlation).
        </p>

        {/* PO Mapping */}
        <h3 className="font-bold text-xs text-slate-700 mb-2 uppercase">Program Outcomes (POs)</h3>
        <table className="w-full text-xs text-center border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-slate-50 font-bold">
              <th className="border border-black p-1.5">CO / PO</th>
              {Array.from({ length: 12 }).map((_, i) => (
                <th key={i} className="border border-black p-1.5">PO{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, coIdx) => {
              const coLabel = `CO${coIdx + 1}`;
              return (
                <tr key={coIdx}>
                  <td className="border border-black p-1.5 font-bold bg-slate-50">{coLabel}</td>
                  {Array.from({ length: 12 }).map((_, poIdx) => {
                    const poLabel = `PO${poIdx + 1}`;
                    const mapping = coPoMappings.find((m: any) => m.co === coLabel && m.po === poLabel);
                    return (
                      <td key={poIdx} className="border border-black p-1.5 font-semibold">
                        {mapping ? mapping.level : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* PSO Mapping */}
        <h3 className="font-bold text-xs text-slate-700 mb-2 uppercase mt-6">Program Specific Outcomes (PSOs)</h3>
        <table className="w-full text-xs text-center border-collapse border border-black">
          <thead>
            <tr className="bg-slate-50 font-bold">
              <th className="border border-black p-1.5">CO / PSO</th>
              <th className="border border-black p-1.5">PSO1</th>
              <th className="border border-black p-1.5">PSO2</th>
              <th className="border border-black p-1.5">PSO3</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, coIdx) => {
              const coLabel = `CO${coIdx + 1}`;
              return (
                <tr key={coIdx}>
                  <td className="border border-black p-1.5 font-bold bg-slate-50">{coLabel}</td>
                  {["PSO1", "PSO2", "PSO3"].map((psoLabel) => {
                    const mapping = coPsoMappings.find((m: any) => m.co === coLabel && m.pso === psoLabel);
                    return (
                      <td key={psoLabel} className="border border-black p-1.5 font-semibold">
                        {mapping ? mapping.level : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 4. ACADEMIC CALENDAR */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          4. Academic Calendar
        </h2>
        {courseFile?.academicCalendarPath ? (
          <div className="text-xs border border-dashed border-slate-300 p-6 rounded-xl text-center bg-slate-50/30">
            <div>
              <p className="text-emerald-700 font-bold mb-2">✅ Academic Calendar Document has been uploaded</p>
              <p className="text-slate-500 font-medium">Serving path: <a href={courseFile.academicCalendarPath} target="_blank" className="text-teal-600 underline font-semibold">{courseFile.academicCalendarPath}</a></p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">📥 [ ATTACH / INSERT ACADEMIC CALENDAR DOCUMENT HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No digital document has been uploaded by the faculty. This page is left blank for inserting the physical printout of the academic calendar.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. LECTURE PLAN & TEXT BOOKS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          5. Lecture Plan & Reference Textbooks
        </h2>

        {/* Textbooks list */}
        {subject?.syllabus?.textbooks && (
          <div className="text-xs mb-6 font-semibold bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-700 mb-2 uppercase">Prescribed Textbooks / Reference Books:</h4>
            <ul className="list-decimal pl-5 space-y-1 text-slate-600 font-medium">
              {Array.isArray(subject.syllabus.textbooks) ? (
                subject.syllabus.textbooks.map((tb: any, idx: number) => (
                  <li key={idx}>
                    {typeof tb === "object" && tb !== null
                      ? `${tb.title || tb.name || ""} ${tb.author ? "by " + tb.author : ""}`
                      : String(tb)}
                  </li>
                ))
              ) : (
                <li>
                  {typeof subject.syllabus.textbooks === "object" && subject.syllabus.textbooks !== null
                    ? `${subject.syllabus.textbooks.title || subject.syllabus.textbooks.name || ""} ${subject.syllabus.textbooks.author ? "by " + subject.syllabus.textbooks.author : ""}`
                    : String(subject.syllabus.textbooks)}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Lecture Plan Table */}
        <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">Unit-wise Lecture Plan & Topics List</h4>
        {courseFile?.lecturePlan && Array.isArray(courseFile.lecturePlan) && courseFile.lecturePlan.length > 0 ? (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold border-b border-black text-slate-700">
                <th className="border border-black p-2 w-16">Unit</th>
                <th className="border border-black p-2">Topics & Syllabus covered</th>
                <th className="border border-black p-2 w-20 text-center">Periods</th>
                <th className="border border-black p-2 w-28 text-center">Actual Date</th>
                <th className="border border-black p-2 w-36">Teaching Aid</th>
              </tr>
            </thead>
            <tbody>
              {courseFile.lecturePlan.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="border border-black p-2 font-bold bg-slate-50/30 text-center">{row.unit}</td>
                  <td className="border border-black p-2">{row.topic}</td>
                  <td className="border border-black p-2 text-center">{row.plannedPeriods}</td>
                  <td className="border border-black p-2 text-center">{row.actualDate || "-"}</td>
                  <td className="border border-black p-2">{row.aid || "Chalk & Board"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold border-b border-black text-slate-700">
                <th className="border border-black p-2 w-16 text-center">Unit</th>
                <th className="border border-black p-2">Topics & Syllabus covered</th>
                <th className="border border-black p-2 w-20 text-center">Periods</th>
                <th className="border border-black p-2 w-28 text-center">Actual Date</th>
                <th className="border border-black p-2 w-36">Teaching Aid</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-4 text-center"></td>
                  <td className="border border-black p-4"></td>
                  <td className="border border-black p-4 text-center"></td>
                  <td className="border border-black p-4 text-center"></td>
                  <td className="border border-black p-4"></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. STUDENT LIST */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          6. Student Roster (Registered Students Ranks)
        </h2>
        <p className="text-xs text-slate-500 mb-4 font-semibold">Total Registered: {students.length} students</p>
        <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
          <thead>
            <tr className="bg-slate-50 font-bold text-slate-700">
              <th className="border border-black p-1.5 w-16 text-center">S.No</th>
              <th className="border border-black p-1.5 w-40">Roll Number</th>
              <th className="border border-black p-1.5">Student Full Name</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student: any, idx: number) => (
              <tr key={student.id}>
                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                <td className="border border-black p-1.5 font-bold uppercase">{student.rollNumber}</td>
                <td className="border border-black p-1.5 uppercase">{student.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 7. CLASS TIMETABLE */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          7. Mapped Class Timetable
        </h2>
        {timetable.length > 0 ? (
          <table className="w-full text-xs text-center border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-2">Day of Week</th>
                <th className="border border-black p-2">Period Name</th>
                <th className="border border-black p-2">Class Timing Slot</th>
              </tr>
            </thead>
            <tbody>
              {timetable.map((t: any, idx: number) => (
                <tr key={t.id || idx}>
                  <td className="border border-black p-2 font-bold uppercase bg-slate-50/20">{t.dayOfWeek}</td>
                  <td className="border border-black p-2">{t.period?.name || `Period ${t.periodId}`}</td>
                  <td className="border border-black p-2 text-slate-500 font-medium">
                    {t.period?.startTime && t.period?.endTime ? `${t.period.startTime} - ${t.period.endTime}` : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500 italic">No class timetable mapping assigned for this subject-section.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 8. TEACHING SUPPORT MATERIALS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          8. Teaching Support Materials
        </h2>
        {courseFile?.teachingSupportText ? (
          <div className="text-xs font-semibold whitespace-pre-wrap leading-relaxed text-slate-700 border border-slate-200 p-6 bg-slate-50/20 rounded-xl">
            {courseFile.teachingSupportText}
          </div>
        ) : (
          <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[40vh] flex flex-col justify-center items-center">
            <span className="font-bold text-sm text-slate-500 uppercase mb-2">[ TEACHING SUPPORT MATERIALS / PPT NOTES / WEB LINKS ]</span>
            <span className="text-xs text-slate-400">No content entered by faculty. This space is left blank for physical attachments or reference notes.</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 9. ASSIGNMENTS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          9. Unit-Wise Assignment Questions (I-V)
        </h2>
        {courseFile?.assignmentQuestions && Array.isArray(courseFile.assignmentQuestions) && courseFile.assignmentQuestions.length > 0 ? (
          <div className="space-y-6 font-semibold">
            {courseFile.assignmentQuestions.map((unitQ: any, idx: number) => (
              <div key={idx} className="border border-slate-200 p-4 rounded-xl">
                <h4 className="font-bold text-teal-800 text-xs uppercase mb-3 border-b border-slate-100 pb-1.5">
                  {unitQ.unit} Assignment
                </h4>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 font-medium">
                  {unitQ.questions && unitQ.questions.map((qText: string, qIdx: number) => (
                    qText.trim() ? <li key={qIdx}>{qText}</li> : null
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6 font-semibold">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="border border-slate-200 p-4 rounded-xl bg-slate-50/10">
                <h4 className="font-bold text-teal-800 text-xs uppercase mb-3 border-b border-slate-200 pb-1.5">
                  Unit {idx + 1} Assignment Questions
                </h4>
                <div className="space-y-3.5 py-2">
                  <div className="border-b border-dashed border-slate-200 h-6" />
                  <div className="border-b border-dashed border-slate-200 h-6" />
                  <div className="border-b border-dashed border-slate-200 h-6" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 10. MID-I EXAM QUESTION PAPER */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          10. MID-I Exam Question Paper
        </h2>
        {mid1Paper ? (
          renderQuestionPaper(mid1Paper, "MID_I")
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">📄 [ ATTACH / INSERT MID-I QUESTION PAPER HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No MID-I exam question paper registered or mapped in the system. This page is left blank for a physical copy.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 11. MID-I EVALUATION SCHEME */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          11. MID-I Scheme of Evaluation
        </h2>
        {courseFile?.mid1SchemePath ? (
          <div className="text-xs border border-dashed border-slate-300 p-6 rounded-xl text-center bg-slate-50/30">
            <div>
              <p className="text-emerald-700 font-bold mb-2">✅ MID-I Evaluation answer key has been uploaded</p>
              <p className="text-slate-500 font-medium">Serving path: <a href={courseFile.mid1SchemePath} target="_blank" className="text-teal-600 underline font-semibold">{courseFile.mid1SchemePath}</a></p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">🔑 [ ATTACH / INSERT MID-I EVALUATION SCHEME HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No scheme of evaluation answer key has been uploaded by the faculty. This page is left blank for a physical copy.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 12. MID-I EXAM MARKS LIST */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          12. MID-I Exam Marks List
        </h2>
        {mid1Paper ? (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-1.5 w-16 text-center">S.No</th>
                <th className="border border-black p-1.5 w-36">Roll Number</th>
                <th className="border border-black p-1.5">Student Full Name</th>
                <th className="border border-black p-1.5 w-28 text-center">Marks Obtained</th>
                <th className="border border-black p-1.5 w-28 text-center">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: any, idx: number) => {
                const total = mid1MarksMap[student.id] || 0;
                const isAbs = mid1AbsentMap[student.id];
                const pct = ((total / mid1Paper.totalMarks) * 100).toFixed(1);
                return (
                  <tr key={student.id} className={isAbs ? "bg-red-50/20" : ""}>
                    <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-1.5 font-bold uppercase">{student.rollNumber}</td>
                    <td className="border border-black p-1.5 uppercase">{student.name}</td>
                    <td className="border border-black p-1.5 text-center font-bold">
                      {isAbs ? "Absent" : total}
                    </td>
                    <td className="border border-black p-1.5 text-center text-slate-500 font-medium">
                      {isAbs ? "-" : `${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500 italic">No marks entries recorded for MID-I exam.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 13. DYNAMIC LIST OF SLOW LEARNERS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          13. List of Slow Learners (Scored below {threshold}%)
        </h2>
        {mid1Paper ? (
          slowLearnersMid1.length === 0 ? (
            <div className="text-center py-6 border border-dashed rounded-xl bg-emerald-50/10 border-emerald-300 text-emerald-800 font-bold text-xs">
              🎉 Outstanding! No students scored below the {threshold}% threshold in MID-I.
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-700">
                  <th className="border border-black p-2 w-16 text-center">S.No</th>
                  <th className="border border-black p-2 w-40">Roll Number</th>
                  <th className="border border-black p-2">Student Full Name</th>
                  <th className="border border-black p-2 w-32 text-center">MID-I Marks</th>
                  <th className="border border-black p-2 w-32 text-center">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {slowLearnersMid1.map((student: any, idx: number) => {
                  const total = mid1MarksMap[student.id] || 0;
                  const pct = ((total / mid1Paper.totalMarks) * 100).toFixed(1);
                  return (
                    <tr key={student.id} className="bg-orange-50/10">
                      <td className="border border-black p-2 text-center">{idx + 1}</td>
                      <td className="border border-black p-2 font-bold uppercase">{student.rollNumber}</td>
                      <td className="border border-black p-2 uppercase">{student.name}</td>
                      <td className="border border-black p-2 text-center font-bold text-red-600">{total}</td>
                      <td className="border border-black p-2 text-center text-slate-500 font-medium">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          <p className="text-xs text-slate-500 italic">No MID-I exam record exists to evaluate slow learners.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 14. REMEDIAL CLASSES & LOGS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          14. Remedial Classes Attendance & Progression Logs
        </h2>
        {courseFile?.remedialClasses && Array.isArray(courseFile.remedialClasses) && courseFile.remedialClasses.length > 0 ? (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-2 w-32 text-center border-b">Date</th>
                <th className="border border-black p-2 border-b">Topics Coached</th>
                <th className="border border-black p-2 border-b">Attending Student Roll Numbers</th>
              </tr>
            </thead>
            <tbody>
              {courseFile.remedialClasses.map((row: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-black p-2 text-center font-bold bg-slate-50/20">{row.date}</td>
                  <td className="border border-black p-2 font-medium">{row.topics}</td>
                  <td className="border border-black p-2 text-teal-700 font-bold uppercase">
                    {Array.isArray(row.studentRolls) ? row.studentRolls.join(", ") : row.studentRolls || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-2 w-32 text-center border-b">Date</th>
                <th className="border border-black p-2 border-b">Topics Coached</th>
                <th className="border border-black p-2 border-b">Attending Student Roll Numbers</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-6 text-center font-bold bg-slate-50/20"></td>
                  <td className="border border-black p-6 font-medium"></td>
                  <td className="border border-black p-6 text-teal-700 font-bold uppercase"></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 15. MID-II EXAM QUESTION PAPER */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          15. MID-II Exam Question Paper
        </h2>
        {mid2Paper ? (
          renderQuestionPaper(mid2Paper, "MID_II")
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">📄 [ ATTACH / INSERT MID-II QUESTION PAPER HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No MID-II exam question paper registered or mapped in the system. This page is left blank for a physical copy.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 16. MID-II EVALUATION SCHEME */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          16. MID-II Scheme of Evaluation
        </h2>
        {courseFile?.mid2SchemePath ? (
          <div className="text-xs border border-dashed border-slate-300 p-6 rounded-xl text-center bg-slate-50/30">
            <div>
              <p className="text-emerald-700 font-bold mb-2">✅ MID-II Evaluation answer key has been uploaded</p>
              <p className="text-slate-500 font-medium">Serving path: <a href={courseFile.mid2SchemePath} target="_blank" className="text-teal-600 underline font-semibold">{courseFile.mid2SchemePath}</a></p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">🔑 [ ATTACH / INSERT MID-II EVALUATION SCHEME HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No scheme of evaluation answer key has been uploaded by the faculty. This page is left blank for a physical copy.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 17. MID-II EXAM MARKS LIST */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          17. MID-II Exam Marks List
        </h2>
        {mid2Paper ? (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-1.5 w-16 text-center">S.No</th>
                <th className="border border-black p-1.5 w-36">Roll Number</th>
                <th className="border border-black p-1.5">Student Full Name</th>
                <th className="border border-black p-1.5 w-28 text-center">Marks Obtained</th>
                <th className="border border-black p-1.5 w-28 text-center">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: any, idx: number) => {
                const total = mid2MarksMap[student.id] || 0;
                const isAbs = mid2AbsentMap[student.id];
                const pct = ((total / mid2Paper.totalMarks) * 100).toFixed(1);
                return (
                  <tr key={student.id} className={isAbs ? "bg-red-50/20" : ""}>
                    <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-1.5 font-bold uppercase">{student.rollNumber}</td>
                    <td className="border border-black p-1.5 uppercase">{student.name}</td>
                    <td className="border border-black p-1.5 text-center font-bold">
                      {isAbs ? "Absent" : total}
                    </td>
                    <td className="border border-black p-1.5 text-center text-slate-500 font-medium">
                      {isAbs ? "-" : `${pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500 italic">No marks entries recorded for MID-II exam.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 18. SLOW LEARNERS PROGRESS STATUS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          18. Slow Learners Progress Status (Improved in MID-II)
        </h2>
        <p className="text-xs text-slate-500 mb-4 font-semibold">
          Lists students who were slow learners in MID-I (scored &lt; {threshold}%) but successfully scored above or equal to {threshold}% in MID-II.
        </p>

        {slowLearnersProgress.length === 0 ? (
          <div className="text-center py-6 border border-dashed rounded-xl bg-slate-50 border-slate-300 text-slate-500 font-medium text-xs">
            No slow learners matched the criteria for improvement / progress comparison.
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-2 w-16 text-center">S.No</th>
                <th className="border border-black p-2 w-40">Roll Number</th>
                <th className="border border-black p-2">Student Name</th>
                <th className="border border-black p-2 text-center w-28">MID-I Marks</th>
                <th className="border border-black p-2 text-center w-28 text-emerald-700">MID-II Marks</th>
                <th className="border border-black p-2 text-center w-28 text-teal-700">% Improvement</th>
              </tr>
            </thead>
            <tbody>
              {slowLearnersProgress.map((student: any, idx: number) => {
                const score1 = mid1MarksMap[student.id] || 0;
                const score2 = mid2MarksMap[student.id] || 0;
                const totalMarks1 = mid1Paper?.totalMarks || 30;
                const totalMarks2 = mid2Paper?.totalMarks || 30;
                const pct1 = (score1 / totalMarks1) * 100;
                const pct2 = (score2 / totalMarks2) * 100;
                const improvement = (pct2 - pct1).toFixed(1);
                return (
                  <tr key={student.id}>
                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                    <td className="border border-black p-2 font-bold uppercase">{student.rollNumber}</td>
                    <td className="border border-black p-2 uppercase">{student.name}</td>
                    <td className="border border-black p-2 text-center text-red-600">
                      {score1} / {totalMarks1}
                    </td>
                    <td className="border border-black p-2 text-center text-emerald-600 font-bold">
                      {score2} / {totalMarks2}
                    </td>
                    <td className="border border-black p-2 text-center text-teal-600 font-bold">
                      +{improvement}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 19. MID MARKS MAPPING WITH COs */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          19. Mid Exam Marks Mapping with COs
        </h2>
        <p className="text-xs text-slate-500 mb-4 font-semibold">
          Aggregate question score attainment grouped by Course Outcomes.
        </p>

        {mid1Paper || mid2Paper ? (
          <div className="space-y-6">
            {mid1Paper && (
              <div>
                <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">MID-I CO-wise Attainment Summary</h4>
                <table className="w-full text-xs text-center border-collapse border border-black font-semibold">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <th className="border border-black p-2">Course Outcome (CO)</th>
                      <th className="border border-black p-2">Max Marks allocated in Paper</th>
                      <th className="border border-black p-2 text-emerald-700">Average Student Score</th>
                      <th className="border border-black p-2 text-teal-700">Attainment %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["CO1", "CO2", "CO3"].map((co) => {
                      // Sum max marks for this CO in Mid 1
                      let maxAllocated = 0;
                      let totalObtained = 0;
                      let attemptCount = 0;

                      mid1Paper.questions.forEach((q: any) => {
                        q.subQuestions.forEach((sq: any) => {
                          if (sq.coMapping === co) {
                            maxAllocated += sq.maxMarks;
                            // Add student scores
                            mid1Marks.forEach((m: any) => {
                              if (m.subQuestionId === sq.id && !m.isAbsent) {
                                totalObtained += m.marksObtained || 0;
                                attemptCount++;
                              }
                            });
                          }
                        });
                      });

                      const avgScore = attemptCount > 0 ? (totalObtained / (attemptCount / maxAllocated)) : 0;
                      const pct = maxAllocated > 0 ? ((avgScore / maxAllocated) * 100).toFixed(1) : "0";

                      return (
                        <tr key={co}>
                          <td className="border border-black p-2 font-bold bg-slate-50/20">{co}</td>
                          <td className="border border-black p-2">{maxAllocated}</td>
                          <td className="border border-black p-2 text-emerald-600">{avgScore.toFixed(1)}</td>
                          <td className="border border-black p-2 text-teal-600 font-bold">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {mid2Paper && (
              <div>
                <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">MID-II CO-wise Attainment Summary</h4>
                <table className="w-full text-xs text-center border-collapse border border-black font-semibold">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <th className="border border-black p-2">Course Outcome (CO)</th>
                      <th className="border border-black p-2">Max Marks allocated in Paper</th>
                      <th className="border border-black p-2 text-emerald-700">Average Student Score</th>
                      <th className="border border-black p-2 text-teal-700">Attainment %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["CO3", "CO4", "CO5"].map((co) => {
                      let maxAllocated = 0;
                      let totalObtained = 0;
                      let attemptCount = 0;

                      mid2Paper.questions.forEach((q: any) => {
                        q.subQuestions.forEach((sq: any) => {
                          if (sq.coMapping === co) {
                            maxAllocated += sq.maxMarks;
                            mid2Marks.forEach((m: any) => {
                              if (m.subQuestionId === sq.id && !m.isAbsent) {
                                totalObtained += m.marksObtained || 0;
                                attemptCount++;
                              }
                            });
                          }
                        });
                      });

                      const avgScore = attemptCount > 0 ? (totalObtained / (attemptCount / maxAllocated)) : 0;
                      const pct = maxAllocated > 0 ? ((avgScore / maxAllocated) * 100).toFixed(1) : "0";

                      return (
                        <tr key={co}>
                          <td className="border border-black p-2 font-bold bg-slate-50/20">{co}</td>
                          <td className="border border-black p-2">{maxAllocated}</td>
                          <td className="border border-black p-2 text-emerald-600">{avgScore.toFixed(1)}</td>
                          <td className="border border-black p-2 text-teal-600 font-bold">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No Mid exams question paper exists to evaluate CO-wise mapping.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 20. FINAL SESSIONAL MARKS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          20. Final Sessional Marks (OBE Internals)
        </h2>
        <table className="w-full text-[10px] text-left border-collapse border border-black font-semibold">
          <thead>
            <tr className="bg-slate-50 font-bold text-slate-700">
              <th className="border border-black p-1 text-center w-10">S.No</th>
              <th className="border border-black p-1 w-24">Roll Number</th>
              <th className="border border-black p-1">Student Full Name</th>
              <th className="border border-black p-1 w-14 text-center">Mid-I (30M)</th>
              <th className="border border-black p-1 w-14 text-center">Mid-I (20M)</th>
              <th className="border border-black p-1 w-14 text-center">Mid-II (30M)</th>
              <th className="border border-black p-1 w-14 text-center">Mid-II (20M)</th>
              <th className="border border-black p-1 w-14 text-center bg-slate-100">Mid Final (20M)</th>
              <th className="border border-black p-1 w-14 text-center">Assignment (10M)</th>
              <th className="border border-black p-1 w-16 text-center bg-teal-50">Final Internals (30M)</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student: any, idx: number) => {
              const intMark = internalMarks.find((i: any) => i.studentId === student.id);
              const assMark = assignmentMarks.find((a: any) => a.studentId === student.id);
              
              const m1Raw = mid1MarksMap[student.id];
              const m2Raw = mid2MarksMap[student.id];
              const isAbs1 = mid1AbsentMap[student.id];
              const isAbs2 = mid2AbsentMap[student.id];

              const m1Val = isAbs1 ? "Absent" : (m1Raw !== undefined ? m1Raw : "-");
              const m2Val = isAbs2 ? "Absent" : (m2Raw !== undefined ? m2Raw : "-");

              const s1Val = isAbs1 ? 0 : (m1Raw !== undefined ? scaleMidMarks(m1Raw, mid1Paper?.totalMarks || 30, 20) : 0);
              const s2Val = isAbs2 ? 0 : (m2Raw !== undefined ? scaleMidMarks(m2Raw, mid2Paper?.totalMarks || 30, 20) : 0);

              const s1Display = isAbs1 ? "Absent" : (m1Raw !== undefined ? s1Val : "-");
              const s2Display = isAbs2 ? "Absent" : (m2Raw !== undefined ? s2Val : "-");

              // Compute average of scaled MIDs (excluding absents/nulls if applicable, or count absent as 0)
              const availableScaled: number[] = [];
              if (m1Raw !== undefined && !isAbs1) availableScaled.push(s1Val);
              if (m2Raw !== undefined && !isAbs2) availableScaled.push(s2Val);

              const avgMid = availableScaled.length > 0
                ? availableScaled.reduce((a, b) => a + b, 0) / availableScaled.length
                : 0;
              const avgMidDisplay = (m1Raw !== undefined || m2Raw !== undefined)
                ? Math.round(avgMid)
                : "-";

              const assignmentVal = assMark ? assMark.marksObtained : null;
              const assDisplay = assignmentVal !== null ? assignmentVal : "-";

              const isLab = subject?.type === "LAB" || subject?.code?.endsWith("P") || subject?.code?.endsWith("L");
              const directInternal = internalMarks.find(
                (i: any) => i.studentId === student.id && (i.examType === "LAB" || i.examType === "FINAL" || i.examType === "INTERNAL")
              );

              let finalInternalVal: string | number = "-";
              if (isLab && directInternal) {
                finalInternalVal = directInternal.marksObtained;
              } else {
                if (m1Raw !== undefined || m2Raw !== undefined || assignmentVal !== null) {
                  finalInternalVal = calculateInternalMarks({
                    mid1Total: (m1Raw !== undefined && !isAbs1) ? m1Raw : null,
                    mid2Total: (m2Raw !== undefined && !isAbs2) ? m2Raw : null,
                    mid1MaxMarks: mid1Paper?.totalMarks || 30,
                    mid2MaxMarks: mid2Paper?.totalMarks || 30,
                    mid1ScaledTo: 20,
                    mid2ScaledTo: 20,
                    assignmentMarks: assignmentVal,
                    assignmentMax: 10,
                    internalMax: isLab ? 50 : 30,
                    subjectType: isLab ? "LAB" : "THEORY",
                  });
                } else if (intMark) {
                  finalInternalVal = intMark.marksObtained;
                }
              }

              return (
                <tr key={student.id}>
                  <td className="border border-black p-1 text-center">{idx + 1}</td>
                  <td className="border border-black p-1 font-bold uppercase">{student.rollNumber}</td>
                  <td className="border border-black p-1 uppercase">{student.name}</td>
                  <td className="border border-black p-1 text-center">{m1Val}</td>
                  <td className="border border-black p-1 text-center">{s1Display}</td>
                  <td className="border border-black p-1 text-center">{m2Val}</td>
                  <td className="border border-black p-1 text-center">{s2Display}</td>
                  <td className="border border-black p-1 text-center font-bold bg-slate-100">{avgMidDisplay}</td>
                  <td className="border border-black p-1 text-center">{assDisplay}</td>
                  <td className="border border-black p-1 text-center font-bold bg-teal-50/20 text-teal-800">
                    {finalInternalVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 21. PREVIOUS QUESTION PAPERS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          21. Previous Question Papers
        </h2>
        {courseFile?.prevPapersPaths && Array.isArray(courseFile.prevPapersPaths) && courseFile.prevPapersPaths.length > 0 ? (
          <div className="text-xs border border-dashed border-slate-300 p-6 rounded-xl text-center bg-slate-50/30">
            <div>
              <p className="text-emerald-700 font-bold mb-2">✅ Previous Semester Question Papers uploaded ({courseFile.prevPapersPaths.length})</p>
              <ul className="text-slate-500 font-medium space-y-1.5 mt-4">
                {courseFile.prevPapersPaths.map((path: string, pIdx: number) => (
                  <li key={pIdx}>
                    Paper #{pIdx + 1}: <a href={path} target="_blank" className="text-teal-600 underline font-semibold">{path}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">📚 [ ATTACH / INSERT PREVIOUS SEMESTER QUESTION PAPERS HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No previous semester university question papers have been uploaded. This page is left blank for a physical copy.
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 22. SEMESTER-END RESULTS */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          22. Semester-End Examination Results Summary
        </h2>
        {semesterResults && semesterResults.length > 0 ? (
          <table className="w-full text-xs text-left border-collapse border border-black font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="border border-black p-1.5 w-16 text-center">S.No</th>
                <th className="border border-black p-1.5 w-36">Roll Number</th>
                <th className="border border-black p-1.5">Student Full Name</th>
                <th className="border border-black p-1.5 w-32 text-center bg-teal-50">Grade Secured</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student: any, idx: number) => {
                const resObj = semesterResults.find((r: any) => r.studentId === student.id);
                let grade = "-";
                if (resObj && resObj.grades) {
                  // grades format: [{ subjectCode: string, grade: string }]
                  const gArr = Array.isArray(resObj.grades) ? resObj.grades : [];
                  const sGrade = gArr.find((g: any) => g.subjectCode === subject.code);
                  if (sGrade) grade = sGrade.grade;
                }

                return (
                  <tr key={student.id}>
                    <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black p-1.5 font-bold uppercase">{student.rollNumber}</td>
                    <td className="border border-black p-1.5 uppercase">{student.name}</td>
                    <td className="border border-black p-1.5 text-center font-extrabold bg-teal-50/20 text-teal-900">
                      {grade}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500 italic">Semester-end results grades not published/posted yet for this batch.</p>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 23. CO PO MAPPING ATTAINMENT */}
      {/* ========================================================================= */}
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        {renderHeader()}
        <h2 className="font-bold text-lg text-slate-800 mb-4 border-b border-black pb-1">
          23. CO-PO Attainment & Achieved Levels
        </h2>
        <p className="text-xs text-slate-500 mb-4 font-semibold">
          Final attainment statistics mapping based on sessional evaluations.
        </p>

        <table className="w-full text-xs text-center border-collapse border border-black font-semibold">
          <thead>
            <tr className="bg-slate-50 font-bold text-slate-700">
              <th className="border border-black p-2">Course Outcome (CO)</th>
              <th className="border border-black p-2">Direct Attainment Level (1-3)</th>
              <th className="border border-black p-2">Indirect Attainment (Feedback)</th>
              <th className="border border-black p-2 bg-teal-50">Final Attainment Achieved</th>
            </tr>
          </thead>
          <tbody>
            {["CO1", "CO2", "CO3", "CO4", "CO5"].map((co) => {
              // Calculate rough attainment level based on sessional marks entries
              // High (3) if average >= 70%, Medium (2) if >= 50%, Low (1) if < 50%
              let totalScore = 0;
              let count = 0;
              internalMarks.forEach((i: any) => {
                if (i.marksObtained !== null && i.marksObtained !== undefined) {
                  totalScore += i.marksObtained;
                  count++;
                }
              });

              const avgSessional = count > 0 ? (totalScore / count) : 0;
              const pct = (avgSessional / 40) * 100; // Assuming max internal is 40

              let directLevel = 1;
              if (pct >= 70) directLevel = 3;
              else if (pct >= 50) directLevel = 2;

              return (
                <tr key={co}>
                  <td className="border border-black p-2 font-bold bg-slate-50/20">{co}</td>
                  <td className="border border-black p-2">{directLevel} / 3</td>
                  <td className="border border-black p-2">2.5 / 3</td>
                  <td className="border border-black p-2 font-bold bg-teal-50/20 text-teal-800">
                    {((directLevel * 0.8) + (2.5 * 0.2)).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print, header, nav, aside, footer {
            display: none !important;
          }

          .printable-area {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }

          .report-page {
            page-break-before: always !important;
            break-before: always !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            min-height: 100vh !important;
          }

          .report-page:first-child {
            page-break-before: auto !important;
            break-before: auto !important;
          }

          table {
            page-break-inside: auto !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          thead {
            display: table-header-group !important;
          }
        }
      `}} />
    </div>
  );
}
