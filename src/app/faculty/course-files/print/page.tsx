"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FaPrint, FaSpinner } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { calculateStudentTotal, scaleMidMarks, aggregateCOMarks, calculateInternalMarks } from "@/lib/mid-exam-calc";
import MathRenderer from "@/components/MathRenderer";
import { computeAttainments } from "@/lib/attainments";


function parseLecturePlan(dbValue: any) {
  if (!dbValue || !Array.isArray(dbValue)) {
    return [
      { unit: "Unit I", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
      { unit: "Unit II", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
      { unit: "Unit III", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
      { unit: "Unit IV", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
      { unit: "Unit V", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] }
    ];
  }

  const isStructured = dbValue.length > 0 && "topics" in dbValue[0] && Array.isArray(dbValue[0].topics);
  if (isStructured) {
    return dbValue;
  }

  const plan = [
    { unit: "Unit I", title: "", references: "", topics: [] as any[] },
    { unit: "Unit II", title: "", references: "", topics: [] as any[] },
    { unit: "Unit III", title: "", references: "", topics: [] as any[] },
    { unit: "Unit IV", title: "", references: "", topics: [] as any[] },
    { unit: "Unit V", title: "", references: "", topics: [] as any[] }
  ];

  dbValue.forEach((row: any) => {
    const unitName = row.unit || "Unit I";
    let target = plan.find(u => u.unit.toLowerCase() === unitName.toLowerCase());
    if (!target) {
      target = { unit: unitName, title: "", references: "", topics: [] as any[] };
      plan.push(target);
    }
    
    const topicText = row.topic || "";
    const isHeaderRow = topicText.toLowerCase().includes("unit") && (topicText.includes(":") || topicText.includes("-"));
    
    if (isHeaderRow) {
      const splitChar = topicText.includes(":") ? ":" : "-";
      const parts = topicText.split(splitChar);
      target.title = parts.slice(1).join(splitChar).trim();
      target.references = row.aid || "";
    } else {
      if (topicText.trim()) {
        target.topics.push({
          topic: topicText,
          plannedPeriods: parseInt(row.plannedPeriods) || 1
        });
      }
    }
  });

  return plan;
}


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

  // ── Attainment settings from courseFile ──────────────────────
  const benchmarkPct: number = (courseFile as any)?.benchmarkPct ?? 50;
  const surveyRating: number = (courseFile as any)?.surveyRating ?? 2;
  const attainmentDecimal: number = (courseFile as any)?.attainmentDecimal ?? 2;

  // ── CO list from syllabus ────────────────────────────────────
  const syllabus = subject?.syllabus as any;
  const coList: string[] =
    syllabus && Array.isArray(syllabus.outcomes) && syllabus.outcomes.length > 0
      ? syllabus.outcomes.map((o: any) => o.code as string)
      : ["CO1","CO2","CO3","CO4","CO5"];

  // ── Flatten subquestions from paper ─────────────────────────
  function flattenSQs(paper: any) {
    if (!paper) return [] as {id:string; coMapping:string; maxMarks:number}[];
    const out: {id:string; coMapping:string; maxMarks:number}[] = [];
    for (const q of (paper.questions || [])) {
      for (const sq of (q.subQuestions || [])) {
        out.push({ id: sq.id, coMapping: sq.coMapping, maxMarks: sq.maxMarks });
      }
    }
    return out;
  }

  // ── Compute attainments ──────────────────────────────────────
  const allMarks = [...(mid1Marks as any[]), ...(mid2Marks as any[])];
  const attainmentResult = computeAttainments({
    coList,
    mid1SubQuestions: flattenSQs(mid1Paper),
    mid2SubQuestions: flattenSQs(mid2Paper),
    allMarks,
    benchmarkPct,
    surveyRating,
    coPoMappings: coPoMappings as any[],
    coPsoMappings: coPsoMappings as any[],
    decimalPlaces: attainmentDecimal,
    students: students as any[],
    semesterResults: semesterResults as any[],
    subjectCode: (subject as any)?.code || "",
  });


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

  interface RubricItem {
    description: string;
    marks: number;
  }

  interface StructuredScheme {
    version: number;
    type: "structured";
    rubrics: Record<string, RubricItem[]>;
  }

  const parseSchemeText = (text: string): StructuredScheme | null => {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.type === "structured" && parsed.rubrics) {
        return parsed;
      }
    } catch (e) {}
    return null;
  };

  // Clean syllabus and outcomes HTML strings
  const stripHtmlTags = (str: any): string => {
    if (!str) return "";
    const s = typeof str === "object" ? JSON.stringify(str) : String(str);
    return s.replace(/<[^>]*>/g, "");
  };

  // Helper to chunk student list into a 5-column side-by-side grid
  const getMarksGridData = (studentsList: any[], marksMap: Record<string, number>, absentMap: Record<string, boolean>) => {
    const totalStudents = studentsList.length;
    const colsCount = 5;
    const rowsCount = Math.ceil(totalStudents / colsCount);
    
    const rows = [];
    for (let r = 0; r < rowsCount; r++) {
      const rowCells = [];
      for (let c = 0; c < colsCount; c++) {
        const studentIdx = c * rowsCount + r;
        if (studentIdx < totalStudents) {
          const student = studentsList[studentIdx];
          const total = marksMap[student.id] ?? 0;
          const isAbs = absentMap[student.id];
          rowCells.push({
            roll: student.rollNumber,
            marks: isAbs ? "AB" : total
          });
        } else {
          rowCells.push({ roll: "", marks: "" });
        }
      }
      rows.push(rowCells);
    }
    return rows;
  };

  // Helper to chunk student list into a 2-column side-by-side grid to save vertical space
  const getStudentGridData = (studentsList: any[]) => {
    const total = studentsList.length;
    const half = Math.ceil(total / 2);
    const rows = [];
    for (let i = 0; i < half; i++) {
      const leftStudent = studentsList[i];
      const rightStudent = studentsList[i + half] || null;
      rows.push({
        left: leftStudent ? { sNo: i + 1, roll: leftStudent.rollNumber, name: leftStudent.name } : null,
        right: rightStudent ? { sNo: i + half + 1, roll: rightStudent.rollNumber, name: rightStudent.name } : null,
      });
    }
    return rows;
  };

  const isImageFile = (path: string): boolean => {
    const ext = path.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '');
  };

  const renderUploadedDocument = (path: string, title: string) => {
    if (!path) return null;
    const isImg = isImageFile(path);
    return (
      <div className="space-y-4 w-full">
        <div className="no-print text-xs border border-slate-200 p-4 rounded-xl bg-slate-50 flex justify-between items-center mb-4">
          <div>
            <p className="text-emerald-700 font-bold">✅ {title} has been uploaded</p>
            <p className="text-slate-500 font-medium mt-1">
              File: <a href={path} target="_blank" className="text-teal-600 underline font-semibold">{path}</a>
            </p>
            <p className="text-slate-400 text-[10px] mt-1 italic">
              Note: If the embedded document does not print fully, click "Open in New Tab" to print it separately.
            </p>
          </div>
          <a
            href={path}
            target="_blank"
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 font-sans"
          >
            Open in New Tab
          </a>
        </div>
        
        <div className="w-full border border-slate-200 rounded-xl overflow-hidden bg-slate-100/50 p-1 flex justify-center">
          {isImg ? (
            <img
              src={path}
              alt={title}
              className="max-w-full h-auto mx-auto object-contain max-h-[85vh] rounded-lg"
            />
          ) : (
            <iframe
              src={`${path}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full min-h-[75vh] print:h-[95vh] border-none rounded-lg bg-white"
              title={title}
            />
          )}
        </div>
      </div>
    );
  };

  const renderEvaluationScheme = (schemeText: string, paper: any, examTitle: string) => {
    const structured = parseSchemeText(schemeText);

    if (!schemeText && !courseFile?.mid1SchemePath && !courseFile?.mid2SchemePath) {
      return (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
          <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">🔑 [ ATTACH / INSERT {examTitle} EVALUATION SCHEME HERE ]</span>
          <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
            No scheme of evaluation answer key has been entered or uploaded by the faculty. This page is left blank for a physical copy.
          </span>
        </div>
      );
    }

    if (!structured) {
      if (schemeText) {
        return (
          <div className="text-xs font-serif text-black leading-relaxed whitespace-pre-wrap border border-slate-300 p-6 rounded-xl bg-slate-50/20 font-medium">
            {schemeText}
          </div>
        );
      }
      
      const schemePath = examTitle === "MID-I" ? courseFile?.mid1SchemePath : courseFile?.mid2SchemePath;
      return renderUploadedDocument(schemePath || "", `${examTitle} Evaluation Scheme`);
    }

    const rubrics = structured.rubrics || {};
    const matrixQuestions: any[] = [];
    paper?.questions?.forEach((q: any) => {
      q.subQuestions?.forEach((sq: any) => {
        matrixQuestions.push({
          label: `${q.questionNo}(${sq.subLabel})`,
          co: sq.coMapping || "—",
          marks: sq.maxMarks || 0
        });
      });
    });

    const totalMatrixMarks = matrixQuestions.reduce((sum, item) => sum + item.marks, 0);

    return (
      <div className="flex flex-col gap-6 font-serif text-black leading-relaxed">
        <div className="text-center font-bold">
          <h2 className="text-sm uppercase tracking-wide">Gayatri Vidya Parishad</h2>
          <h3 className="text-[11px] uppercase tracking-wider text-slate-800">College for Degree and PG Courses (A)</h3>
          <p className="text-[9px] text-slate-600 font-sans mt-0.5">Rushikonda, Visakhapatnam – 530 045 | Engineering &amp; Technology Program</p>
          <p className="text-[10px] mt-1 font-bold">I/IV B. Tech Degree {examTitle} Examinations</p>
        </div>

        <table className="w-full text-[10px] border-collapse border border-black font-semibold mt-2">
          <tbody>
            <tr>
              <td className="border border-black p-1.5 font-bold bg-slate-50 w-24">Course Title:</td>
              <td className="border border-black p-1.5 uppercase font-bold text-slate-900">{subject?.name || "—"}</td>
              <td rowSpan={3} className="border border-black p-2 font-extrabold text-center text-lg w-28 align-middle" style={{ verticalAlign: "middle" }}>
                {examTitle}
              </td>
              <td className="border border-black p-1.5 font-bold bg-slate-50 w-24">Course Code:</td>
              <td className="border border-black p-1.5 font-mono font-bold text-slate-900">{subject?.code || "—"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold bg-slate-50">Date:</td>
              <td className="border border-black p-1.5">{paper?.examDate || "—"}</td>
              <td className="border border-black p-1.5 font-bold">Academic Year:</td>
              <td className="border border-black p-1.5 font-bold">{courseFile?.academicYear?.name || "—"}</td>
            </tr>
            <tr>
              <td className="border border-black p-1.5 font-bold bg-slate-50">Time:</td>
              <td className="border border-black p-1.5">2:30pm - 4:00pm</td>
              <td className="border border-black p-1.5 font-bold bg-slate-50">Max. Marks:</td>
              <td className="border border-black p-1.5 font-bold">{paper?.totalMarks || 30}</td>
            </tr>
          </tbody>
        </table>

        {matrixQuestions.length > 0 && (
          <div className="mt-2">
            <table className="w-full text-center border-collapse border border-black text-[9.5px]">
              <tbody>
                <tr className="border border-black font-bold bg-slate-100">
                  <td className="border border-black p-1 font-bold w-20">Question no.</td>
                  {matrixQuestions.map((item, idx) => (
                    <td key={idx} className="border border-black p-1">{item.label}</td>
                  ))}
                  <td className="border border-black p-1 bg-slate-200">Total Marks</td>
                </tr>
                <tr className="border border-black font-bold">
                  <td className="border border-black p-1 font-bold">Course Outcome</td>
                  {matrixQuestions.map((item, idx) => (
                    <td key={idx} className="border border-black p-1">{item.co}</td>
                  ))}
                  <td className="border border-black p-1 font-bold">—</td>
                </tr>
                <tr className="border border-black">
                  <td className="border border-black p-1 font-bold">Marks allotted</td>
                  {matrixQuestions.map((item, idx) => (
                    <td key={idx} className="border border-black p-1 font-semibold">{item.marks}</td>
                  ))}
                  <td className="border border-black p-1 font-bold bg-slate-200">{totalMatrixMarks}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center font-bold text-xs uppercase tracking-widest mt-4 decoration-solid underline underline-offset-4">
          SCHEME OF EVALUATION
        </div>

        <div className="flex flex-col gap-4 mt-2 pl-4 text-xs">
          {paper?.questions?.map((q: any) => {
            const hasSubQuestions = q.subQuestions && q.subQuestions.length > 0;
            if (!hasSubQuestions) return null;

            return (
              <div key={q.questionNo} className="flex gap-2">
                <div className="w-5 font-bold text-right">{q.questionNo}.</div>
                <div className="flex-grow flex flex-col gap-3">
                  {q.subQuestions.map((sq: any) => {
                    const key = `${q.questionNo}_${sq.subLabel}`;
                    const items = rubrics[key] || [];

                    return (
                      <div key={sq.subLabel} className="flex flex-col gap-1.5">
                        {items.map((item: any, idx: number) => {
                          const isFirst = idx === 0;
                          return (
                            <div key={idx} className="flex justify-between items-start gap-4">
                              <div className="flex gap-1.5 items-start">
                                {isFirst ? (
                                  <span className="font-bold w-4 text-left">{sq.subLabel}.</span>
                                ) : (
                                  <span className="w-4"></span>
                                )}
                                <span className="text-slate-800">{item.description || "—"}</span>
                              </div>
                              <span className="font-bold whitespace-nowrap text-slate-900">
                                ({item.marks || 0}M)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-between items-center text-[10px] font-bold">
          <div></div>
          <div className="text-right flex flex-col items-center">
            <div className="h-10"></div>
            <span className="border-t border-black pt-1 px-4 uppercase">Signature of the Faculty</span>
          </div>
        </div>
      </div>
    );
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

  // Reusable print section with repeating header layout
  const PrintSection = ({
    title,
    children
  }: {
    title: string;
    children: React.ReactNode;
  }) => {
    return (
      <div className="report-page bg-white p-6 border border-slate-200 rounded-xl shadow-sm mb-12">
        <table className="w-full text-xs text-left border-collapse font-semibold print-section-table">
          <thead>
            <tr className="no-border-row">
              <td className="p-0 border-none">
                {renderHeader()}
              </td>
            </tr>
            <tr className="no-border-row">
              <td className="p-0 pb-4 border-none">
                <h2 className="font-bold text-lg text-slate-800 border-b border-black pb-1">
                  {title}
                </h2>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr className="no-border-row">
              <td className="p-0 pt-4 border-none">
                {children}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

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
      <PrintSection title="1. Course Syllabus">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 2. OBJECTIVES & OUTCOMES */}
      {/* ========================================================================= */}
      <PrintSection title="2. Course Objectives & Outcomes">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 3. CO-PO MAPPING TABLE */}
      {/* ========================================================================= */}
      <PrintSection title="3. CO-PO & CO-PSO Mapping Correlation Matrix">
        <p className="text-[10px] text-slate-500 mb-4 font-medium">
          Correlation level: 3 (High), 2 (Medium), 1 (Low), "-" / Blank (No Correlation).
        </p>

        {/* PO Mapping */}
        <h3 className="font-bold text-xs text-slate-700 mb-2 uppercase">Program Outcomes (POs)</h3>
        <table className="print-table w-full text-xs text-center border-collapse mb-6">
          <thead>
            <tr className="bg-slate-50 font-bold">
              <th className="p-1.5 text-center">CO / PO</th>
              {Array.from({ length: 12 }).map((_, i) => (
                <th key={i} className="p-1.5 text-center">PO{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, coIdx) => {
              const coLabel = `CO${coIdx + 1}`;
              return (
                <tr key={coIdx}>
                  <td className="p-1.5 font-bold bg-slate-50 text-center">{coLabel}</td>
                  {Array.from({ length: 12 }).map((_, poIdx) => {
                    const poLabel = `PO${poIdx + 1}`;
                    const mapping = coPoMappings.find((m: any) => m.co === coLabel && m.po === poLabel);
                    return (
                      <td key={poIdx} className="p-1.5 font-semibold text-center">
                        {mapping && mapping.weight !== null ? mapping.weight : "-"}
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
        <table className="print-table w-full text-xs text-center border-collapse">
          <thead>
            <tr className="bg-slate-50 font-bold">
              <th className="p-1.5 text-center">CO / PSO</th>
              <th className="p-1.5 text-center">PSO1</th>
              <th className="p-1.5 text-center">PSO2</th>
              <th className="p-1.5 text-center">PSO3</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, coIdx) => {
              const coLabel = `CO${coIdx + 1}`;
              return (
                <tr key={coIdx}>
                  <td className="p-1.5 font-bold bg-slate-50 text-center">{coLabel}</td>
                  {["PSO1", "PSO2", "PSO3"].map((psoLabel) => {
                    const mapping = coPsoMappings.find((m: any) => m.co === coLabel && m.pso === psoLabel);
                    return (
                      <td key={psoLabel} className="p-1.5 font-semibold text-center">
                        {mapping && mapping.weight !== null ? mapping.weight : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </PrintSection>

      {/* ========================================================================= */}
      {/* 4. ACADEMIC CALENDAR */}
      {/* ========================================================================= */}
      <PrintSection title="4. Academic Calendar">
        {courseFile?.academicCalendarPath ? (
          renderUploadedDocument(courseFile.academicCalendarPath, "Academic Calendar")
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">📥 [ ATTACH / INSERT ACADEMIC CALENDAR DOCUMENT HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No digital document has been uploaded by the faculty. This page is left blank for inserting the physical printout of the academic calendar.
            </span>
          </div>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 5. LECTURE PLAN & TEXT BOOKS */}
      {/* ========================================================================= */}
      <PrintSection title="5. Lecture Plan & Reference Textbooks">
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
        {(() => {
          const plan = parseLecturePlan(courseFile?.lecturePlan);
          const getUnitHours = (unit: any) => unit.topics.reduce((sum: number, t: any) => sum + (t.plannedPeriods || 0), 0);
          const getGrandTotalHours = () => plan.reduce((sum: number, u: any) => sum + getUnitHours(u), 0);
          
          let serialNum = 1;

          return (
            <div className="flex flex-col gap-4">
              <table className="print-table w-full text-xs text-left border-collapse font-semibold">
                <thead>
                  <tr className="bg-slate-50 font-bold border-b border-black text-slate-700">
                    <th className="p-2 w-16 text-center">S.No</th>
                    <th className="p-2">Topics To be Covered</th>
                    <th className="p-2 w-28 text-center">No.Of Hours</th>
                    <th className="p-2 w-48 text-center font-bold">References</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((u: any, uIdx: number) => {
                    const unitHours = getUnitHours(u);
                    const rows: React.ReactNode[] = [];

                    // 1. Add unit header row
                    rows.push(
                      <tr key={`header-${u.unit}`} className="bg-slate-100/70 border-y border-slate-300">
                        <td colSpan={4} className="p-2 font-bold text-slate-900 uppercase text-center tracking-wider text-[11px]">
                          {u.unit}: {u.title || "[No Unit Title Enterered]"}
                        </td>
                      </tr>
                    );

                    // 2. Add each topic row
                    u.topics.forEach((t: any, tIdx: number) => {
                      rows.push(
                        <tr key={`topic-${u.unit}-${tIdx}`} className="hover:bg-slate-50/50">
                          <td className="p-2 text-center text-slate-400 font-medium">{serialNum++}</td>
                          <td className="p-2 text-slate-800">{t.topic || "—"}</td>
                          <td className="p-2 text-center text-slate-800">{t.plannedPeriods || 1}</td>
                          {tIdx === 0 ? (
                            <td rowSpan={u.topics.length} className="p-2 text-center text-slate-800 border-l border-slate-200 font-medium align-middle" style={{ verticalAlign: "middle" }}>
                              {u.references || "—"}
                            </td>
                          ) : null}
                        </tr>
                      );
                    });

                    // 3. Add unit total row
                    rows.push(
                      <tr key={`total-${u.unit}`} className="bg-slate-50/30 border-y border-slate-200">
                        <td colSpan={2} className="p-2 font-bold text-slate-700 text-right uppercase tracking-wider">
                          Total Hours for {u.unit}:
                        </td>
                        <td className="p-2 text-center font-bold text-slate-800">{unitHours}</td>
                        <td className="p-2 bg-slate-50/10"></td>
                      </tr>
                    );

                    return rows;
                  })}
                  
                  {/* Grand total subject hours row */}
                  <tr className="bg-slate-100 border-t border-black">
                    <td colSpan={2} className="p-2.5 font-bold text-slate-900 text-right uppercase tracking-widest text-[10.5px]">
                      Total Subject Hours:
                    </td>
                    <td className="p-2.5 text-center font-bold text-[11px] text-slate-950">{getGrandTotalHours()}</td>
                    <td className="p-2.5 bg-slate-100"></td>
                  </tr>
                </tbody>
              </table>

              {/* Syllabus completion date at the bottom */}
              <div className="mt-4 text-xs font-bold text-slate-800 text-right italic tracking-wide">
                Tentative date for completion of syllabus is {courseFile?.tentativeCompletionDate || "27.01.2024"}
              </div>
            </div>
          );
        })()}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 6. STUDENT LIST */}
      {/* ========================================================================= */}
      <PrintSection title="6. Student Roster (Registered Students Ranks)">
        <p className="text-xs text-slate-500 mb-2 font-semibold">Total Registered: {students.length} students</p>
        <table className="print-table tight-table w-full text-xs text-left border-collapse border border-black font-semibold">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-black text-slate-800 text-[10.5px]">
              <th className="p-1 border-r border-black w-10 text-center">S.No</th>
              <th className="p-1 border-r border-black w-24 text-center">Roll Number</th>
              <th className="p-1 border-r border-black px-2">Student Full Name</th>
              
              <th className="p-1 border-r border-black w-10 text-center bg-slate-50/50">S.No</th>
              <th className="p-1 border-r border-black w-24 text-center bg-slate-50/50">Roll Number</th>
              <th className="p-1 px-2 bg-slate-50/50">Student Full Name</th>
            </tr>
          </thead>
          <tbody>
            {getStudentGridData(students).map((row, idx) => (
              <tr key={idx} className="border-b border-slate-300 last:border-b-black text-[10.5px]">
                {/* Left Student */}
                <td className="p-1 text-center border-r border-slate-300">{row.left?.sNo || ""}</td>
                <td className="p-1 font-mono font-bold uppercase text-center border-r border-slate-300">{row.left?.roll || ""}</td>
                <td className="p-1 uppercase px-2 border-r border-black">{row.left?.name || ""}</td>
                
                {/* Right Student */}
                <td className="p-1 text-center border-r border-slate-300 bg-slate-50/10">{row.right?.sNo || ""}</td>
                <td className="p-1 font-mono font-bold uppercase text-center border-r border-slate-300 bg-slate-50/10">{row.right?.roll || ""}</td>
                <td className="p-1 uppercase px-2 bg-slate-50/10">{row.right?.name || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintSection>

      {/* ========================================================================= */}
      {/* 7. CLASS TIMETABLE */}
      {/* ========================================================================= */}
      <PrintSection title="7. Mapped Class Timetable">
        {timetable.length > 0 ? (
          <table className="print-table w-full text-xs text-center border-collapse font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="p-2 text-center">Day of Week</th>
                <th className="p-2 text-center">Period Name</th>
                <th className="p-2 text-center">Class Timing Slot</th>
              </tr>
            </thead>
            <tbody>
              {timetable.map((t: any, idx: number) => (
                <tr key={t.id || idx}>
                  <td className="p-2 font-bold uppercase bg-slate-50/20 text-center">{t.dayOfWeek}</td>
                  <td className="p-2 text-center">{t.period?.name || `Period ${t.periodId}`}</td>
                  <td className="p-2 text-slate-500 font-medium text-center">
                    {t.period?.startTime && t.period?.endTime ? `${t.period.startTime} - ${t.period.endTime}` : "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-slate-500 italic">No class timetable mapping assigned for this subject-section.</p>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 8. TEACHING SUPPORT MATERIALS */}
      {/* ========================================================================= */}
      <PrintSection title="8. Teaching Support Materials">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 9. ASSIGNMENTS */}
      {/* ========================================================================= */}
      <PrintSection title="9. Unit-Wise Assignment Questions (I-V)">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 10. MID-I EXAM QUESTION PAPER */}
      {/* ========================================================================= */}
      <PrintSection title="10. MID-I Exam Question Paper">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 11. MID-I EVALUATION SCHEME */}
      {/* ========================================================================= */}
      <PrintSection title="11. MID-I Scheme of Evaluation">
        {renderEvaluationScheme(courseFile?.mid1SchemeText || "", mid1Paper, "MID-I")}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 12. MID-I EXAM MARKS LIST */}
      {/* ========================================================================= */}
      <PrintSection title="12. MID-I Exam Marks List">
        {mid1Paper ? (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] text-slate-500 font-medium">
              Marks displayed in a 5-column side-by-side grid format to save space. (AB = Absent)
            </p>
            <table className="print-table w-full text-xs text-center border-collapse border border-black font-semibold">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-black text-slate-855">
                  {Array.from({ length: 5 }).map((_, c) => (
                    <React.Fragment key={c}>
                      <th className="p-1 border-r border-black w-24">Roll Number</th>
                      <th className="p-1 border-black w-12" style={{ borderRight: c < 4 ? "1px solid black" : "none" }}>Marks</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getMarksGridData(students, mid1MarksMap, mid1AbsentMap).map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-slate-300 last:border-b-black">
                    {row.map((cell, cIdx) => (
                      <React.Fragment key={cIdx}>
                        <td className="p-1 font-mono font-bold border-r border-slate-300 text-[10.5px] uppercase">
                          {cell.roll || "—"}
                        </td>
                        <td className="p-1 font-bold text-[10.5px]" style={{ color: cell.marks === "AB" ? "red" : "inherit", borderRight: cIdx < 4 ? "1px solid #cbd5e1" : "none" }}>
                          {cell.marks !== "" ? cell.marks : "—"}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No marks entries recorded for MID-I exam.</p>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 13. DYNAMIC LIST OF SLOW LEARNERS */}
      {/* ========================================================================= */}
      <PrintSection title={`13. List of Slow Learners (Scored below ${threshold}%)`}>
        {mid1Paper ? (
          slowLearnersMid1.length === 0 ? (
            <div className="text-center py-6 border border-dashed rounded-xl bg-emerald-50/10 border-emerald-300 text-emerald-800 font-bold text-xs">
              🎉 Outstanding! No students scored below the {threshold}% threshold in MID-I.
            </div>
          ) : (
            <table className="print-table w-full text-xs text-left border-collapse font-semibold">
              <thead>
                <tr className="bg-slate-50 font-bold text-slate-700">
                  <th className="p-2 w-16 text-center">S.No</th>
                  <th className="p-2 w-40 text-center">Roll Number</th>
                  <th className="p-2 px-4">Student Full Name</th>
                  <th className="p-2 w-32 text-center">MID-I Marks</th>
                  <th className="p-2 w-32 text-center">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {slowLearnersMid1.map((student: any, idx: number) => {
                  const total = mid1MarksMap[student.id] || 0;
                  const pct = ((total / mid1Paper.totalMarks) * 100).toFixed(1);
                  return (
                    <tr key={student.id} className="bg-orange-50/10">
                      <td className="p-2 text-center">{idx + 1}</td>
                      <td className="p-2 font-bold uppercase text-center">{student.rollNumber}</td>
                      <td className="p-2 uppercase px-4">{student.name}</td>
                      <td className="p-2 text-center font-bold text-red-600">{total}</td>
                      <td className="p-2 text-center text-slate-500 font-medium">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          <p className="text-xs text-slate-500 italic">No MID-I exam record exists to evaluate slow learners.</p>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 14. REMEDIAL CLASSES & LOGS */}
      {/* ========================================================================= */}
      <PrintSection title="14. Remedial Classes Attendance & Progression Logs">
        {courseFile?.remedialClasses && Array.isArray(courseFile.remedialClasses) && courseFile.remedialClasses.length > 0 ? (
          <table className="print-table w-full text-xs text-left border-collapse font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="p-2 w-32 text-center">Date</th>
                <th className="p-2">Topics Coached</th>
                <th className="p-2 text-center">Attending Student Roll Numbers</th>
              </tr>
            </thead>
            <tbody>
              {courseFile.remedialClasses.map((row: any, idx: number) => (
                <tr key={idx}>
                  <td className="p-2 text-center font-bold bg-slate-50/20">{row.date}</td>
                  <td className="p-2 font-medium">{row.topics}</td>
                  <td className="p-2 text-teal-700 font-bold uppercase text-center">
                    {Array.isArray(row.studentRolls) ? row.studentRolls.join(", ") : row.studentRolls || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="print-table w-full text-xs text-left border-collapse font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="p-2 w-32 text-center">Date</th>
                <th className="p-2">Topics Coached</th>
                <th className="p-2 text-center">Attending Student Roll Numbers</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="p-6 text-center font-bold bg-slate-50/20"></td>
                  <td className="p-6 font-medium"></td>
                  <td className="p-6 text-teal-700 font-bold uppercase text-center"></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 15. MID-II EXAM QUESTION PAPER */}
      {/* ========================================================================= */}
      <PrintSection title="15. MID-II Exam Question Paper">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 16. MID-II EVALUATION SCHEME */}
      {/* ========================================================================= */}
      <PrintSection title="16. MID-II Scheme of Evaluation">
        {renderEvaluationScheme(courseFile?.mid2SchemeText || "", mid2Paper, "MID-II")}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 17. MID-II EXAM MARKS LIST */}
      {/* ========================================================================= */}
      <PrintSection title="17. MID-II Exam Marks List">
        {mid2Paper ? (
          <div className="flex flex-col gap-4">
            <p className="text-[10px] text-slate-500 font-medium">
              Marks displayed in a 5-column side-by-side grid format to save space. (AB = Absent)
            </p>
            <table className="print-table w-full text-xs text-center border-collapse border border-black font-semibold">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-black text-slate-855">
                  {Array.from({ length: 5 }).map((_, c) => (
                    <React.Fragment key={c}>
                      <th className="p-1 border-r border-black w-24">Roll Number</th>
                      <th className="p-1 border-black w-12" style={{ borderRight: c < 4 ? "1px solid black" : "none" }}>Marks</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getMarksGridData(students, mid2MarksMap, mid2AbsentMap).map((row, rIdx) => (
                  <tr key={rIdx} className="border-b border-slate-300 last:border-b-black">
                    {row.map((cell, cIdx) => (
                      <React.Fragment key={cIdx}>
                        <td className="p-1 font-mono font-bold border-r border-slate-300 text-[10.5px] uppercase">
                          {cell.roll || "—"}
                        </td>
                        <td className="p-1 font-bold text-[10.5px]" style={{ color: cell.marks === "AB" ? "red" : "inherit", borderRight: cIdx < 4 ? "1px solid #cbd5e1" : "none" }}>
                          {cell.marks !== "" ? cell.marks : "—"}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No marks entries recorded for MID-II exam.</p>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 18. SLOW LEARNERS PROGRESS STATUS */}
      {/* ========================================================================= */}
      <PrintSection title="18. Slow Learners Progress Status (Improved in MID-II)">
        <p className="text-xs text-slate-500 mb-4 font-semibold">
          Lists students who were slow learners in MID-I (scored &lt; {threshold}%) but successfully scored above or equal to {threshold}% in MID-II.
        </p>

        {slowLearnersProgress.length === 0 ? (
          <div className="text-center py-6 border border-dashed rounded-xl bg-slate-50 border-slate-300 text-slate-500 font-medium text-xs">
            No slow learners matched the criteria for improvement / progress comparison.
          </div>
        ) : (
          <table className="print-table w-full text-xs text-left border-collapse font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="p-2 w-16 text-center">S.No</th>
                <th className="p-2 w-40 text-center">Roll Number</th>
                <th className="p-2 px-4">Student Name</th>
                <th className="p-2 text-center w-28">MID-I Marks</th>
                <th className="p-2 text-center w-28 text-emerald-700">MID-II Marks</th>
                <th className="p-2 text-center w-28 text-teal-700">% Improvement</th>
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
                    <td className="p-2 text-center">{idx + 1}</td>
                    <td className="p-2 font-bold uppercase text-center">{student.rollNumber}</td>
                    <td className="p-2 uppercase px-4">{student.name}</td>
                    <td className="p-2 text-center text-red-600">
                      {score1} / {totalMarks1}
                    </td>
                    <td className="p-2 text-center text-emerald-600 font-bold">
                      {score2} / {totalMarks2}
                    </td>
                    <td className="p-2 text-center text-teal-600 font-bold text-center">
                      +{improvement}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 19. MID MARKS MAPPING WITH COs */}
      {/* ========================================================================= */}
      <PrintSection title="19. Mid Exam Marks Mapping with COs">
        <p className="text-xs text-slate-500 mb-4 font-semibold">
          Aggregate question score attainment grouped by Course Outcomes (Benchmark: {benchmarkPct}%).
        </p>

        {mid1Paper || mid2Paper ? (
          <div className="space-y-6">
            {/* Per-paper CO summary tables */}
            {[
              { paper: mid1Paper, marks: mid1Marks as any[], label: "MID-I" },
              { paper: mid2Paper, marks: mid2Marks as any[], label: "MID-II" },
            ].map(({ paper, marks, label }) => {
              if (!paper) return null;
              // Only include COs that appear in this paper
              const paperCOs = ([...new Set(
                (paper.questions || []).flatMap((q: any) =>
                  (q.subQuestions || []).map((sq: any) => sq.coMapping as string)
                )
              )] as string[]).filter(co => coList.includes(co)).sort();

              if (paperCOs.length === 0) return null;

              return (
                <div key={label}>
                  <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">{label} CO-wise Pass % Summary</h4>
                  <table className="print-table w-full text-xs text-center border-collapse font-semibold">
                    <thead>
                      <tr className="bg-slate-50 font-bold text-slate-700">
                        <th className="p-2 text-center">Course Outcome</th>
                        <th className="p-2 text-center">Max Marks in Paper</th>
                        <th className="p-2 text-center">Benchmark Mark ({benchmarkPct}%)</th>
                        <th className="p-2 text-emerald-700 text-center">Avg Student Score</th>
                        <th className="p-2 text-amber-700 text-center">Students ≥ Benchmark</th>
                        <th className="p-2 text-teal-700 text-center">Pass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paperCOs.map((co) => {
                        let totalMaxMarks = 0;
                        let totalObtained = 0;
                        let studentsAbove = 0;
                        const studentSet = new Set<string>();

                        (paper.questions || []).forEach((q: any) => {
                          (q.subQuestions || []).forEach((sq: any) => {
                            if (sq.coMapping !== co) return;
                            const sqBenchmark = sq.maxMarks * (benchmarkPct / 100);
                            totalMaxMarks += sq.maxMarks;
                            marks.filter((m: any) => m.subQuestionId === sq.id && !m.isAbsent).forEach((m: any) => {
                              studentSet.add(m.studentId || m.subQuestionId + "_" + m.id);
                              totalObtained += m.marksObtained || 0;
                              if ((m.marksObtained || 0) >= sqBenchmark) studentsAbove++;
                            });
                          });
                        });

                        const studentCount = (marks.filter((m: any) => !m.isAbsent)
                          .reduce((acc: Set<string>, m: any) => { acc.add(m.studentId); return acc; }, new Set<string>())).size;
                        const avgScore = studentCount > 0 ? totalObtained / studentCount : 0;
                        const passPct = studentCount > 0 ? (studentsAbove / studentCount * 100).toFixed(1) : "0";
                        const benchmarkMark = totalMaxMarks * benchmarkPct / 100;

                        return (
                          <tr key={co}>
                            <td className="p-2 font-bold bg-slate-50/20 text-center">{co}</td>
                            <td className="p-2 text-center">{totalMaxMarks}</td>
                            <td className="p-2 text-center text-amber-700">{benchmarkMark.toFixed(1)}</td>
                            <td className="p-2 text-emerald-600 text-center">{avgScore.toFixed(1)}</td>
                            <td className="p-2 text-center">{studentsAbove}</td>
                            <td className="p-2 text-teal-600 font-bold text-center">{passPct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No Mid exams question paper exists to evaluate CO-wise mapping.</p>
        )}
      </PrintSection>


      {/* ========================================================================= */}
      {/* 20. FINAL SESSIONAL MARKS */}
      {/* ========================================================================= */}
      <PrintSection title="20. Final Sessional Marks (OBE Internals)">
        <table className="print-table w-full text-[10px] text-left border-collapse font-semibold">
          <thead>
            <tr className="bg-slate-50 font-bold text-slate-700">
              <th className="p-1 text-center w-10">S.No</th>
              <th className="p-1 w-24 text-center">Roll Number</th>
              <th className="p-1 px-4">Student Full Name</th>
              <th className="p-1 w-14 text-center">Mid-I (30M)</th>
              <th className="p-1 w-14 text-center">Mid-I (20M)</th>
              <th className="p-1 w-14 text-center">Mid-II (30M)</th>
              <th className="p-1 w-14 text-center">Mid-II (20M)</th>
              <th className="p-1 w-14 text-center bg-slate-100">Mid Final (20M)</th>
              <th className="p-1 w-14 text-center">Assignment (10M)</th>
              <th className="p-1 w-16 text-center bg-teal-50">Final Internals (30M)</th>
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

              const m1Val = isAbs1 ? "AB" : (m1Raw !== undefined ? m1Raw : "-");
              const m2Val = isAbs2 ? "AB" : (m2Raw !== undefined ? m2Raw : "-");

              const s1Val = isAbs1 ? 0 : (m1Raw !== undefined ? scaleMidMarks(m1Raw, mid1Paper?.totalMarks || 30, 20) : 0);
              const s2Val = isAbs2 ? 0 : (m2Raw !== undefined ? scaleMidMarks(m2Raw, mid2Paper?.totalMarks || 30, 20) : 0);

              const s1Display = isAbs1 ? "0" : (m1Raw !== undefined ? s1Val : "-");
              const s2Display = isAbs2 ? "0" : (m2Raw !== undefined ? s2Val : "-");

              // Compute average of scaled MIDs (excluding absents/nulls if applicable, or count absent as 0)
              const availableScaled: number[] = [];
              if (m1Raw !== undefined || isAbs1) availableScaled.push(s1Val);
              if (m2Raw !== undefined || isAbs2) availableScaled.push(s2Val);

              const avgMid = availableScaled.length > 0
                ? availableScaled.reduce((a, b) => a + b, 0) / availableScaled.length
                : 0;
              const avgMidDisplay = (m1Raw !== undefined || m2Raw !== undefined || isAbs1 || isAbs2)
                ? Math.ceil(avgMid)
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
                if (m1Raw !== undefined || m2Raw !== undefined || isAbs1 || isAbs2 || assignmentVal !== null) {
                  finalInternalVal = calculateInternalMarks({
                    mid1Total: (m1Raw !== undefined && !isAbs1) ? m1Raw : (isAbs1 ? 0 : null),
                    mid2Total: (m2Raw !== undefined && !isAbs2) ? m2Raw : (isAbs2 ? 0 : null),
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
                  <td className="p-1 text-center">{idx + 1}</td>
                  <td className="p-1 font-bold uppercase text-center">{student.rollNumber}</td>
                  <td className="p-1 uppercase px-4">{student.name}</td>
                  <td className="p-1 text-center">{m1Val}</td>
                  <td className="p-1 text-center">{s1Display}</td>
                  <td className="p-1 text-center">{m2Val}</td>
                  <td className="p-1 text-center">{s2Display}</td>
                  <td className="p-1 text-center font-bold bg-slate-100">{avgMidDisplay}</td>
                  <td className="p-1 text-center">{assDisplay}</td>
                  <td className="p-1 text-center font-bold bg-teal-50/20 text-teal-800">
                    {finalInternalVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PrintSection>

      {/* ========================================================================= */}
      {/* 21. PREVIOUS QUESTION PAPERS */}
      {/* ========================================================================= */}
      <PrintSection title="21. Previous Question Papers">
        {courseFile?.prevPapersPaths && Array.isArray(courseFile.prevPapersPaths) && courseFile.prevPapersPaths.length > 0 ? (
          <div className="space-y-12">
            {courseFile.prevPapersPaths.map((path: string, pIdx: number) => (
              <div
                key={pIdx}
                className="space-y-4"
                style={{
                  pageBreakBefore: pIdx > 0 ? "always" : "auto",
                  breakBefore: pIdx > 0 ? "always" : "auto"
                }}
              >
                <h4 className="font-bold text-xs text-slate-700 uppercase">Question Paper #{pIdx + 1}</h4>
                {renderUploadedDocument(path, `Previous Question Paper #${pIdx + 1}`)}
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400 min-h-[70vh] flex flex-col justify-center items-center bg-slate-50/10">
            <span className="font-extrabold text-sm text-slate-600 uppercase mb-2">📚 [ ATTACH / INSERT PREVIOUS SEMESTER QUESTION PAPERS HERE ]</span>
            <span className="text-xs text-slate-400 font-medium max-w-sm mt-1 leading-relaxed">
              No previous semester university question papers have been uploaded. This page is left blank for a physical copy.
            </span>
          </div>
        )}
      </PrintSection>

      {/* ========================================================================= */}
      {/* 22. SEMESTER-END RESULTS */}
      {/* ========================================================================= */}
      <PrintSection title="22. Semester-End Examination Results Summary">
        {semesterResults && semesterResults.length > 0 ? (
          <table className="print-table w-full text-xs text-left border-collapse font-semibold">
            <thead>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <th className="p-1.5 w-16 text-center">S.No</th>
                <th className="p-1.5 w-36 text-center">Roll Number</th>
                <th className="p-1.5 px-4">Student Full Name</th>
                <th className="p-1.5 w-32 text-center bg-teal-50">Grade Secured</th>
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
                    <td className="p-1.5 text-center">{idx + 1}</td>
                    <td className="p-1.5 font-bold uppercase text-center">{student.rollNumber}</td>
                    <td className="p-1.5 uppercase px-4">{student.name}</td>
                    <td className="p-1.5 text-center font-extrabold bg-teal-50/20 text-teal-900">
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
      </PrintSection>

      {/* ========================================================================= */}
      {/* 23. CO-PO / CO-PSO ATTAINMENT */}
      {/* ========================================================================= */}
      <PrintSection title="23. CO-PO & CO-PSO Attainment">
        <p className="text-xs text-slate-500 mb-4 font-semibold">
          Benchmark: {benchmarkPct}% &nbsp;|&nbsp; Survey Rating: {surveyRating}/3 &nbsp;|&nbsp;
          Rounding: {attainmentDecimal} decimal{attainmentDecimal !== 1 ? "s" : ""}
          {(semesterResults as any[]).length > 0 ? " | University results included" : " | University results: pending"}
        </p>

        {/* CO Attainment Summary */}
        <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">CO Attainment Summary</h4>
        <table className="print-table w-full text-xs text-center border-collapse font-semibold mb-6">
          <thead>
            <tr className="bg-slate-50 font-bold text-slate-700">
              <th className="p-2 text-center">CO</th>
              <th className="p-2 text-center">Combined Pass %</th>
              <th className="p-2 text-center">Internal Score</th>
              <th className="p-2 text-center">Internal Level</th>
              <th className="p-2 text-center">Uni Pass %</th>
              <th className="p-2 text-center">Uni Level</th>
              <th className="p-2 bg-teal-50 text-center text-teal-800">Final CO Attainment</th>
            </tr>
          </thead>
          <tbody>
            {attainmentResult.coResults.map(cr => (
              <tr key={cr.co}>
                <td className="p-2 font-bold bg-slate-50/20">{cr.co}</td>
                <td className="p-2">{cr.combinedPassPct.toFixed(1)}%</td>
                <td className="p-2">{cr.internalScore.toFixed(1)}%</td>
                <td className="p-2">{cr.internalLevel} / 3</td>
                <td className="p-2">{cr.universityPassPct !== null ? `${cr.universityPassPct.toFixed(1)}%` : "–"}</td>
                <td className="p-2">{cr.universityLevel !== null ? `${cr.universityLevel} / 3` : "–"}</td>
                <td className="p-2 font-extrabold bg-teal-50/30 text-teal-800">{cr.finalAttainment.toFixed(attainmentDecimal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* CO-PO Matrix */}
        {(coPoMappings as any[]).length > 0 && (() => {
          const pos = [...new Set((coPoMappings as any[]).map((m: any) => m.po))].sort();
          return (
            <div className="mb-6">
              <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">CO-PO Mapping & PO Attainment</h4>
              <div className="overflow-x-auto">
                <table className="print-table w-full text-[10px] text-center border-collapse font-semibold">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <th className="p-1.5 text-left">CO</th>
                      <th className="p-1.5 text-center bg-teal-50">Attainment</th>
                      {pos.map(po => <th key={po} className="p-1.5 text-center min-w-[42px]">{po}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {coList.map(co => {
                      const coAtt = attainmentResult.coResults.find(r => r.co === co)?.finalAttainment ?? 0;
                      return (
                        <tr key={co}>
                          <td className="p-1.5 font-bold text-left">{co}</td>
                          <td className="p-1.5 text-center bg-teal-50 font-extrabold text-teal-800">{coAtt.toFixed(attainmentDecimal)}</td>
                          {pos.map(po => {
                            const m = (coPoMappings as any[]).find((x: any) => x.co === co && x.po === po);
                            const w = m?.weight;
                            if (!w) return <td key={po} className="p-1.5 text-slate-200">–</td>;
                            const cell = ((w / 3) * coAtt).toFixed(attainmentDecimal);
                            return (
                              <td key={po} className="p-1.5">
                                <div className="text-[9px] text-slate-400">{w}</div>
                                <div className="font-bold text-teal-700">{cell}</div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="bg-teal-50 font-extrabold text-teal-800">
                      <td className="p-1.5 text-left text-[10px] uppercase">PO Attainment</td>
                      <td className="p-1.5" />
                      {pos.map(po => (
                        <td key={po} className="p-1.5 text-center text-sm">
                          {attainmentResult.poAttainments[po] !== undefined
                            ? attainmentResult.poAttainments[po].toFixed(attainmentDecimal)
                            : "–"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* CO-PSO Matrix */}
        {(coPsoMappings as any[]).length > 0 && (() => {
          const psos = [...new Set((coPsoMappings as any[]).map((m: any) => m.pso))].sort();
          return (
            <div>
              <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase">CO-PSO Mapping & PSO Attainment</h4>
              <div className="overflow-x-auto">
                <table className="print-table w-full text-[10px] text-center border-collapse font-semibold">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <th className="p-1.5 text-left">CO</th>
                      <th className="p-1.5 text-center bg-indigo-50">Attainment</th>
                      {psos.map(pso => <th key={pso} className="p-1.5 text-center min-w-[56px]">{pso}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {coList.map(co => {
                      const coAtt = attainmentResult.coResults.find(r => r.co === co)?.finalAttainment ?? 0;
                      return (
                        <tr key={co}>
                          <td className="p-1.5 font-bold text-left">{co}</td>
                          <td className="p-1.5 text-center bg-indigo-50 font-extrabold text-indigo-800">{coAtt.toFixed(attainmentDecimal)}</td>
                          {psos.map(pso => {
                            const m = (coPsoMappings as any[]).find((x: any) => x.co === co && x.pso === pso);
                            const w = m?.weight;
                            if (!w) return <td key={pso} className="p-1.5 text-slate-200">–</td>;
                            const cell = ((w / 3) * coAtt).toFixed(attainmentDecimal);
                            return (
                              <td key={pso} className="p-1.5">
                                <div className="text-[9px] text-slate-400">{w}</div>
                                <div className="font-bold text-indigo-700">{cell}</div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="bg-indigo-50 font-extrabold text-indigo-800">
                      <td className="p-1.5 text-left text-[10px] uppercase">PSO Attainment</td>
                      <td className="p-1.5" />
                      {psos.map(pso => (
                        <td key={pso} className="p-1.5 text-center text-sm">
                          {attainmentResult.psoAttainments[pso] !== undefined
                            ? attainmentResult.psoAttainments[pso].toFixed(attainmentDecimal)
                            : "–"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </PrintSection>



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

          table.print-section-table,
          table.print-section-table tr,
          table.print-section-table td,
          table.print-section-table th {
            border: none !important;
            background: none !important;
            padding: 0 !important;
          }
          table.print-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 10px !important;
            border: 1px solid #000000 !important;
          }
          table.print-table th, table.print-table td {
            border: 1px solid #000000 !important;
            padding: 6px 8px !important;
            text-align: left !important;
            font-size: 10px !important;
            color: #000000 !important;
          }
          table.print-table.tight-table th, table.print-table.tight-table td {
            padding: 3px 6px !important;
            font-size: 9px !important;
          }
          table.print-table th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
          }
        }
      `}} />
    </div>
  );
}
