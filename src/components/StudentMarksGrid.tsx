"use client";

import React, { useState } from "react";
import { FaChevronDown, FaChevronUp, FaTable } from "react-icons/fa";

interface StudentMarksGridProps {
  students: any[];
  mid1Paper: any;
  mid2Paper: any;
  mid1Marks: any[];
  mid2Marks: any[];
  semesterResults: any[];
  subjectCode: string;
  benchmarkPct: number;
}

function getPaperSubQuestions(paper: any) {
  if (!paper) return [];
  const questions = paper.masterPaper?.questions || paper.questions || [];
  const sortedQ = [...questions].sort((a: any, b: any) => a.questionNo - b.questionNo);
  const result: any[] = [];
  for (const q of sortedQ) {
    const subQ = [...(q.subQuestions || [])].sort(
      (a: any, b: any) => a.order - b.order || a.subLabel.localeCompare(b.subLabel)
    );
    for (const sq of subQ) {
      result.push({
        id: sq.id,
        label: `Q${q.questionNo}.${sq.subLabel}`,
        coMapping: sq.coMapping,
        maxMarks: sq.maxMarks,
      });
    }
  }
  return result;
}

function gradeToPercent(grade: string): number | null {
  const g = (grade || "").trim().toUpperCase();
  const map: Record<string, number> = {
    "A+": 100,
    "A":  90,
    "B":  80,
    "C":  70,
    "D":  60,
    "E":  50,
    "F":  39,
  };
  return map[g] ?? null;
}

export default function StudentMarksGrid({
  students = [],
  mid1Paper,
  mid2Paper,
  mid1Marks = [],
  mid2Marks = [],
  semesterResults = [],
  subjectCode = "",
  benchmarkPct = 50,
}: StudentMarksGridProps) {
  const [expanded, setExpanded] = useState(true);

  const mid1SQs = getPaperSubQuestions(mid1Paper);
  const mid2SQs = getPaperSubQuestions(mid2Paper);

  const hasMid1 = mid1SQs.length > 0;
  const hasMid2 = mid2SQs.length > 0;

  // Total columns span
  const colSpanMid1 = hasMid1 ? mid1SQs.length : 1;
  const colSpanMid2 = hasMid2 ? mid2SQs.length : 1;

  // Double scrollbars
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  React.useEffect(() => {
    const bottomEl = bottomScrollRef.current;
    if (!bottomEl) return;

    const resizeObserver = new ResizeObserver(() => {
      setScrollWidth(bottomEl.scrollWidth);
    });
    resizeObserver.observe(bottomEl);
    setScrollWidth(bottomEl.scrollWidth);

    return () => resizeObserver.disconnect();
  }, [students, mid1Paper, mid2Paper]);

  React.useEffect(() => {
    const topEl = topScrollRef.current;
    const bottomEl = bottomScrollRef.current;
    if (!topEl || !bottomEl) return;

    const handleTopScroll = () => {
      bottomEl.scrollLeft = topEl.scrollLeft;
    };
    const handleBottomScroll = () => {
      topEl.scrollLeft = bottomEl.scrollLeft;
    };

    topEl.addEventListener("scroll", handleTopScroll);
    bottomEl.addEventListener("scroll", handleBottomScroll);

    return () => {
      topEl.removeEventListener("scroll", handleTopScroll);
      bottomEl.removeEventListener("scroll", handleBottomScroll);
    };
  }, [scrollWidth]);

  // Grade matching function
  const getStudentGradeEntry = (studentId: string) => {
    const result = semesterResults.find((r) => r.studentId === studentId);
    if (!result || !result.grades) return null;
    const gradesArr = Array.isArray(result.grades) ? result.grades : [];
    return gradesArr.find((g: any) => {
      const dbCode = (g.subjectCode || "").trim().toUpperCase();
      const targetCode = subjectCode.trim().toUpperCase();
      return dbCode === targetCode || dbCode.split(" - ")[0].trim() === targetCode;
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Button */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 text-left cursor-pointer hover:bg-slate-100/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          <FaTable className="text-indigo-600 h-4 w-4" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Student Marksheet Grid View
          </h2>
        </div>
        {expanded ? (
          <FaChevronUp className="h-4.5 w-4.5 text-slate-400" />
        ) : (
          <FaChevronDown className="h-4.5 w-4.5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Top scrollbar helper */}
          {scrollWidth > 0 && (
            <div
              ref={topScrollRef}
              className="overflow-x-auto w-full border border-slate-200 rounded-lg bg-slate-50/50 scrollbar-thin"
              style={{ height: "12px" }}
            >
              <div style={{ width: `${scrollWidth}px`, height: "1px" }} />
            </div>
          )}

          <div ref={bottomScrollRef} className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                {/* Row 1: Exam Type Groupings */}
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-extrabold text-center">
                  <th className="p-3 border-r border-slate-200 min-w-[50px]" rowSpan={4}>S.No</th>
                  <th className="p-3 border-r border-slate-200 min-w-[120px]" rowSpan={4}>Register Number</th>
                  <th className="p-3 border-r border-slate-200 min-w-[180px] text-left" rowSpan={4}>Student Name</th>
                  <th className="p-2 border-r border-slate-200" colSpan={colSpanMid1}>I MID Exam</th>
                  <th className="p-2 border-r border-slate-200" colSpan={colSpanMid2}>II MID Exam</th>
                  <th className="p-2" colSpan={2}>University Results</th>
                </tr>

                {/* Row 2: Subquestions / Subheaders */}
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-center">
                  {hasMid1 ? (
                    mid1SQs.map((sq) => (
                      <th key={sq.id} className="p-2 border-r border-slate-200 font-semibold">{sq.label}</th>
                    ))
                  ) : (
                    <th className="p-2 border-r border-slate-200 text-slate-400 italic font-normal" rowSpan={3}>No Questions Mapped</th>
                  )}
                  {hasMid2 ? (
                    mid2SQs.map((sq) => (
                      <th key={sq.id} className="p-2 border-r border-slate-200 font-semibold">{sq.label}</th>
                    ))
                  ) : (
                    <th className="p-2 border-r border-slate-200 text-slate-400 italic font-normal" rowSpan={3}>No Questions Mapped</th>
                  )}
                  <th className="p-2 border-r border-slate-200 font-semibold">Grade</th>
                  <th className="p-2 font-semibold">Equivalent %</th>
                </tr>

                {/* Row 3: Max Marks */}
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-center">
                  {hasMid1 && mid1SQs.map((sq) => (
                    <th key={sq.id} className="p-1 border-r border-slate-200 font-medium">Max: {sq.maxMarks}M</th>
                  ))}
                  {hasMid2 && mid2SQs.map((sq) => (
                    <th key={sq.id} className="p-1 border-r border-slate-200 font-medium">Max: {sq.maxMarks}M</th>
                  ))}
                  <th className="p-1 border-r border-slate-200 font-medium text-slate-400">—</th>
                  <th className="p-1 font-medium text-slate-400">—</th>
                </tr>

                {/* Row 4: Matching CO */}
                <tr className="bg-indigo-50/50 border-b border-slate-200 text-indigo-900 font-bold text-center">
                  {hasMid1 && mid1SQs.map((sq) => (
                    <th key={sq.id} className="p-1 border-r border-slate-200 text-[10px]">{sq.coMapping}</th>
                  ))}
                  {hasMid2 && mid2SQs.map((sq) => (
                    <th key={sq.id} className="p-1 border-r border-slate-200 text-[10px]">{sq.coMapping}</th>
                  ))}
                  <th className="p-1 border-r border-slate-200 text-[10px]">All COs</th>
                  <th className="p-1 text-[10px]">All COs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {students.map((student, idx) => {
                  const gradeEntry = getStudentGradeEntry(student.id);
                  const uniGrade = gradeEntry?.grade;
                  const uniPercent = uniGrade ? gradeToPercent(uniGrade) : null;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-normal">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-800">{student.rollNumber}</td>
                      <td className="p-2 border-r border-slate-200 text-slate-900 font-bold">{student.name}</td>

                      {/* Mid 1 Marks */}
                      {hasMid1 ? (
                        mid1SQs.map((sq) => {
                          const mark = mid1Marks.find(
                            (m) => m.studentId === student.id && m.subQuestionId === sq.id
                          );
                          return (
                            <td key={sq.id} className="p-2 border-r border-slate-200 text-center">
                              {mark?.isAbsent ? (
                                <span className="text-red-500 font-extrabold">Ab</span>
                              ) : mark?.marksObtained != null ? (
                                <span className="font-semibold text-slate-800">{mark.marksObtained}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <td className="p-2 border-r border-slate-200 text-center text-slate-300 font-normal">—</td>
                      )}

                      {/* Mid 2 Marks */}
                      {hasMid2 ? (
                        mid2SQs.map((sq) => {
                          const mark = mid2Marks.find(
                            (m) => m.studentId === student.id && m.subQuestionId === sq.id
                          );
                          return (
                            <td key={sq.id} className="p-2 border-r border-slate-200 text-center">
                              {mark?.isAbsent ? (
                                <span className="text-red-500 font-extrabold">Ab</span>
                              ) : mark?.marksObtained != null ? (
                                <span className="font-semibold text-slate-800">{mark.marksObtained}</span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })
                      ) : (
                        <td className="p-2 border-r border-slate-200 text-center text-slate-300 font-normal">—</td>
                      )}

                      {/* University Grade */}
                      <td className="p-2 border-r border-slate-200 text-center">
                        {uniGrade ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-extrabold border ${
                            uniGrade === "F"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {uniGrade}
                          </span>
                        ) : (
                          <span className="text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                            Not Available
                          </span>
                        )}
                      </td>

                      {/* University Equivalent % */}
                      <td className="p-2 text-center">
                        {uniPercent != null ? (
                          <span className="font-extrabold text-slate-850">{uniPercent}%</span>
                        ) : (
                          <span className="text-amber-600 font-bold text-[10px]">
                            Not Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
