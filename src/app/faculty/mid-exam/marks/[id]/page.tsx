"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft, FaSave, FaCheck, FaTimes, FaUserSlash, FaUserCheck,
  FaSpinner, FaFileDownload, FaInfoCircle, FaClipboardList, FaFilePdf
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";
import * as XLSX from "xlsx";

interface SubQuestion {
  id: string;
  questionNo: number;
  subLabel: string;
  maxMarks: number;
  coMapping: string;
  isCompulsory: boolean;
  choiceGroupId: string | null;
  choiceGroupNo: number | null;
  label: string;
}

interface StudentRow {
  studentId: string;
  rollNumber: string;
  name: string;
  isAbsent: boolean;
  isDraft: boolean;
  marks: Record<string, number | null>; // subQuestionId -> marks
  calculatedTotal?: number;
}

interface PaperInfo {
  id: string;
  examType: string;
  totalMarks: number;
  isFrozen: boolean;
  isLocked: boolean;
  isPublished: boolean;
  subjectName?: string;
  subjectCode?: string;
  year?: string;
  semester?: string;
  sectionName?: string;
}

export default function MarksGridPage() {
  const params = useParams();
  const paperId = params ? (params.id as string) : "";
  const router = useRouter();
  const { data: session } = useSession();

  const [paper, setPaper] = useState<PaperInfo | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Keep ref of cells for keyboard navigation
  const gridRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Refs for double scrollbar synchronization
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const topScrollbarRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  const updateScrollWidth = useCallback(() => {
    if (tableContainerRef.current) {
      setTableScrollWidth(tableContainerRef.current.scrollWidth);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(updateScrollWidth, 100);
    window.addEventListener("resize", updateScrollWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateScrollWidth);
    };
  }, [updateScrollWidth, rows, subQuestions]);

  const handleTopScroll = () => {
    if (topScrollbarRef.current && tableContainerRef.current) {
      if (tableContainerRef.current.scrollLeft !== topScrollbarRef.current.scrollLeft) {
        tableContainerRef.current.scrollLeft = topScrollbarRef.current.scrollLeft;
      }
    }
  };

  const handleTableScroll = () => {
    if (topScrollbarRef.current && tableContainerRef.current) {
      if (topScrollbarRef.current.scrollLeft !== tableContainerRef.current.scrollLeft) {
        topScrollbarRef.current.scrollLeft = tableContainerRef.current.scrollLeft;
      }
    }
  };

  const downloadExcel = () => {
    if (!paper || rows.length === 0) return;

    const data = rows.map(row => {
      const record: Record<string, any> = {
        "Roll Number": row.rollNumber,
        "Name": row.name,
      };

      subQuestions.forEach(sq => {
        const mark = row.isAbsent ? "AB" : (row.marks[sq.id] ?? "-");
        record[sq.label] = mark;
      });

      record["Total"] = row.isAbsent ? "AB" : (row.calculatedTotal ?? 0);
      return record;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mid Exam Marks");
    
    const examName = paper.examType.replace(/\s+/g, "_");
    const subjectStr = paper.subjectCode || "Subject";
    const sectionStr = paper.sectionName ? `Sec_${paper.sectionName}` : "Sec";
    const filename = `${examName}_Marks_${subjectStr}_${sectionStr}_Export_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadGridData = useCallback(async () => {
    try {
      const res = await fetch(`/api/mid-exam/marks?paperId=${paperId}`);
      if (!res.ok) {
        showToast("Failed to load marks grid", "error");
        return;
      }
      const data = await res.json();
      setPaper(data.paper);
      setSubQuestions(data.subQuestions);

      // Map rows with live calculation
      const initialRows = (data.rows || []).map((row: any) => {
        const studentMarks: Record<string, number | null> = {};
        for (const sq of data.subQuestions) {
          studentMarks[sq.id] = row.marks[sq.id] !== undefined ? row.marks[sq.id] : null;
        }

        return {
          ...row,
          marks: studentMarks,
          calculatedTotal: calculateRowTotal(row.isAbsent, studentMarks, data.subQuestions),
        };
      });

      setRows(initialRows);
    } catch (e) {
      console.error(e);
      showToast("Error loading marks grid", "error");
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadGridData();
  }, [loadGridData]);

  const calculateRowTotal = (
    isAbsent: boolean,
    marks: Record<string, number | null>,
    sqs: SubQuestion[]
  ) => {
    if (isAbsent) return 0;

    // Convert sqs and marks to calculation engine format
    // Map subquestions to parent question format for calculateStudentTotal
    const questionNos = Array.from(new Set(sqs.map(sq => sq.questionNo)));
    const questions = questionNos.map(qNo => {
      const qSubQs = sqs.filter(sq => sq.questionNo === qNo);
      const isCompulsory = qSubQs[0]?.isCompulsory ?? true;
      const choiceGroupId = qSubQs[0]?.choiceGroupId ?? null;
      return {
        id: `q_${qNo}`,
        questionNo: qNo,
        isCompulsory,
        choiceGroupId,
        subQuestions: qSubQs.map(sq => ({
          id: sq.id,
          subLabel: sq.subLabel,
          maxMarks: sq.maxMarks,
          questionId: `q_${qNo}`,
          coMapping: sq.coMapping,
        }))
      };
    });

    const choiceGroupIds = Array.from(new Set(sqs.map(sq => sq.choiceGroupId).filter(Boolean)));
    const choiceGroups = choiceGroupIds.map((cgId, idx) => {
      const cgSqs = sqs.filter(sq => sq.choiceGroupId === cgId);
      const qNosInCg = Array.from(new Set(cgSqs.map(sq => sq.questionNo)));
      return {
        id: cgId as string,
        groupNo: idx + 1,
        questions: qNosInCg.map(qNo => {
          const qSubQs = cgSqs.filter(sq => sq.questionNo === qNo);
          return {
            id: `q_${qNo}`,
            questionNo: qNo,
            isCompulsory: false,
            choiceGroupId: cgId,
            subQuestions: qSubQs.map(sq => ({
              id: sq.id,
              subLabel: sq.subLabel,
              maxMarks: sq.maxMarks,
              questionId: `q_${qNo}`,
              coMapping: sq.coMapping,
            }))
          };
        })
      };
    });

    const { total } = calculateStudentTotal(questions, choiceGroups, marks, isAbsent);
    return total;
  };

  const handleMarksChange = (studentId: string, sqId: string, value: string) => {
    const parsedVal = value === "" ? null : parseFloat(value);
    const sq = subQuestions.find(s => s.id === sqId);
    if (!sq) return;

    if (parsedVal !== null) {
      if (parsedVal < 0 || parsedVal > sq.maxMarks) {
        // Just let them type but show temporary border color error or handle gracefully
      }
    }

    setRows(prev =>
      prev.map(row => {
        if (row.studentId === studentId) {
          const newMarks = { ...row.marks, [sqId]: parsedVal };
          return {
            ...row,
            marks: newMarks,
            calculatedTotal: calculateRowTotal(row.isAbsent, newMarks, subQuestions),
          };
        }
        return row;
      })
    );
  };

  const handleAbsentToggle = (studentId: string) => {
    setRows(prev =>
      prev.map(row => {
        if (row.studentId === studentId) {
          const newAbsent = !row.isAbsent;
          // Clear all marks if absent is selected
          const newMarks = { ...row.marks };
          if (newAbsent) {
            for (const key of Object.keys(newMarks)) {
              newMarks[key] = null;
            }
          }
          return {
            ...row,
            isAbsent: newAbsent,
            marks: newMarks,
            calculatedTotal: calculateRowTotal(newAbsent, newMarks, subQuestions),
          };
        }
        return row;
      })
    );
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    sqIndex: number
  ) => {
    const key = e.key;

    const focusCell = (rIdx: number, sIdx: number, direction: "right" | "left" | "down" | "up") => {
      let currRow = rIdx;
      let currSq = sIdx;

      // Start by moving one step in the direction of movement
      if (direction === "right") {
        if (currSq < subQuestions.length - 1) {
          currSq += 1;
        } else if (currRow < rows.length - 1) {
          currSq = 0;
          currRow += 1;
        } else {
          return;
        }
      } else if (direction === "left") {
        if (currSq > 0) {
          currSq -= 1;
        } else if (currRow > 0) {
          currSq = subQuestions.length - 1;
          currRow -= 1;
        } else {
          return;
        }
      } else if (direction === "down") {
        if (currRow < rows.length - 1) {
          currRow += 1;
        } else {
          return;
        }
      } else if (direction === "up") {
        if (currRow > 0) {
          currRow -= 1;
        } else {
          return;
        }
      }

      // Keep moving until we find a non-disabled input
      while (true) {
        const targetSqId = subQuestions[currSq]?.id;
        const targetStudentId = rows[currRow]?.studentId;
        const targetRefKey = `${targetStudentId}_${targetSqId}`;
        const inputEl = gridRefs.current[targetRefKey];

        if (inputEl && !inputEl.disabled) {
          inputEl.focus();
          setTimeout(() => {
            inputEl.select();
          }, 10);
          break;
        }

        // Otherwise keep moving in that direction
        if (direction === "right") {
          if (currSq < subQuestions.length - 1) {
            currSq += 1;
          } else if (currRow < rows.length - 1) {
            currSq = 0;
            currRow += 1;
          } else {
            break;
          }
        } else if (direction === "left") {
          if (currSq > 0) {
            currSq -= 1;
          } else if (currRow > 0) {
            currSq = subQuestions.length - 1;
            currRow -= 1;
          } else {
            break;
          }
        } else if (direction === "down") {
          if (currRow < rows.length - 1) {
            currRow += 1;
          } else {
            break;
          }
        } else if (direction === "up") {
          if (currRow > 0) {
            currRow -= 1;
          } else {
            break;
          }
        }
      }
    };

    if (key === "Enter" || key === "Tab") {
      if (key === "Tab" && e.shiftKey) {
        e.preventDefault();
        focusCell(rowIndex, sqIndex, "left");
      } else {
        e.preventDefault();
        focusCell(rowIndex, sqIndex, "right");
      }
    } else if (key === "ArrowRight") {
      e.preventDefault();
      focusCell(rowIndex, sqIndex, "right");
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      focusCell(rowIndex, sqIndex, "left");
    } else if (key === "ArrowDown") {
      e.preventDefault();
      focusCell(rowIndex, sqIndex, "down");
    } else if (key === "ArrowUp") {
      e.preventDefault();
      focusCell(rowIndex, sqIndex, "up");
    }
  };

  const handleClearAll = () => {
    if (!window.confirm("Are you sure you want to clear all entered marks for all students? This cannot be undone until you save/submit.")) {
      return;
    }
    setRows(prev =>
      prev.map(row => {
        const clearedMarks = { ...row.marks };
        for (const key of Object.keys(clearedMarks)) {
          clearedMarks[key] = null;
        }
        return {
          ...row,
          isAbsent: false,
          marks: clearedMarks,
          calculatedTotal: 0,
        };
      })
    );
    showToast("All marks cleared locally. Remember to click Save Draft to persist.", "success");
  };

  const handleFillDemoMarks = () => {
    setRows(prev =>
      prev.map(row => {
        const demoMarks = { ...row.marks };
        const isAbsent = Math.random() < 0.05;
        
        if (isAbsent) {
          for (const key of Object.keys(demoMarks)) {
            demoMarks[key] = null;
          }
          return {
            ...row,
            isAbsent: true,
            marks: demoMarks,
            calculatedTotal: 0,
          };
        }

        for (const sq of subQuestions) {
          const randomVal = Math.random();
          let mark = 0;
          if (randomVal < 0.08) {
            mark = 0;
          } else if (randomVal < 0.25) {
            mark = Math.floor(sq.maxMarks * 0.5);
          } else if (randomVal < 0.85) {
            mark = Math.floor(sq.maxMarks * 0.8);
          } else {
            mark = sq.maxMarks;
          }
          demoMarks[sq.id] = Math.max(0, Math.min(sq.maxMarks, mark));
        }

        return {
          ...row,
          isAbsent: false,
          marks: demoMarks,
          calculatedTotal: calculateRowTotal(false, demoMarks, subQuestions),
        };
      })
    );
    showToast("Demo marks filled locally. Click Save Draft to save.", "success");
  };

  const handleSave = async (isDraft: boolean = true) => {
    // Validate first
    const errors: string[] = [];
    const entriesToSave: any[] = [];

    for (const row of rows) {
      for (const sq of subQuestions) {
        const val = row.marks[sq.id];
        if (!row.isAbsent && val !== null) {
          if (val < 0 || val > sq.maxMarks) {
            errors.push(`Row ${row.rollNumber}: Q${sq.questionNo}${sq.subLabel} marks ${val} exceeds max ${sq.maxMarks}`);
          }
        }
        entriesToSave.push({
          studentId: row.studentId,
          subQuestionId: sq.id,
          marksObtained: row.isAbsent ? null : val,
          isAbsent: row.isAbsent,
        });
      }
    }

    if (errors.length > 0) {
      showToast(errors[0], "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mid-exam/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          entries: entriesToSave,
          isDraft,
        })
      });
      if (res.ok) {
        showToast(isDraft ? "Draft saved successfully!" : "Marks submitted successfully!", "success");
        await loadGridData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to save", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const role = (session?.user as any)?.role;
  const isAdmin = ["ADMIN", "HOD", "DIRECTOR", "PRINCIPAL"].includes(role);
  const isLocked = paper?.isLocked ?? false;
  const canEdit = !isLocked || isAdmin;

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  if (!paper) return <div className="flex min-h-screen items-center justify-center text-slate-500">Marks grid not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-[98%] px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors">
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-bold text-slate-900">
                  {paper.subjectName ? `${paper.subjectName} (${paper.subjectCode})` : "Enter Student Marks"}
                </h1>
                <p className="text-xs text-slate-500">
                  {paper.examType.replace("_", " ")} · Year {paper.year} Sem {paper.semester} Sec {paper.sectionName} · Max {paper.totalMarks} marks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {paper.isLocked && (
                <span className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                  <FaUserSlash size={10} /> Locked / Published
                </span>
              )}

              <button
                onClick={downloadExcel}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
                title="Download marks spreadsheet offline"
              >
                <FaFileDownload className="text-green-600" />
                Download Excel
              </button>

              {canEdit && (
                <>
                  <button
                    onClick={handleFillDemoMarks}
                    className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 shadow-sm hover:bg-purple-100 transition-all"
                    title="Populate random demo marks for testing"
                  >
                    <FaClipboardList className="text-purple-600" />
                    Fill Demo Marks
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 transition-all"
                    title="Clear all student marks locally"
                  >
                    <FaTimes className="text-red-600" />
                    Clear All
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                    Save Draft
                  </button>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                  >
                    <FaCheck /> Submit Draft
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[98%] px-4 py-8 sm:px-6">
        {/* Helper Notice */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Slick Navigation Enabled</p>
            <p>Use keyboard arrow keys <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">←</kbd> <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">→</kbd> or <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">Enter</kbd> to enter marks horizontally for the same student, and <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↑</kbd> <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↓</kbd> to navigate vertically between students.</p>
          </div>
        </div>

        {/* Student Marks Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-100">
          {/* Top Scrollbar synchronized with the table */}
          <div 
            ref={topScrollbarRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden border-b border-slate-100 bg-slate-50/20"
            style={{ height: "12px" }}
          >
            <div style={{ width: `${tableScrollWidth}px`, height: "1px" }} />
          </div>

          <div 
            ref={tableContainerRef}
            onScroll={handleTableScroll}
            className="overflow-x-auto max-h-[70vh] overflow-y-auto"
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="sticky top-0 left-0 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 z-30 w-36 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05),_0_2px_4px_rgba(0,0,0,0.02)]">Student Detail</th>
                  <th className="sticky top-0 bg-slate-50 px-2 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center w-16 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">Status</th>
                  {subQuestions.map(sq => (
                    <th key={sq.id} className="sticky top-0 bg-slate-50 px-1 py-2 text-center min-w-[55px] w-14 border-l border-slate-100 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                      <p className="text-[11px] font-bold text-slate-800">{sq.label}</p>
                      <p className="text-[10px] font-extrabold text-blue-600">Max:{sq.maxMarks}</p>
                      <p className="text-[9px] font-semibold text-slate-400">{sq.coMapping}</p>
                      {sq.choiceGroupNo && (
                        <span className="mt-0.5 inline-block rounded bg-purple-50 px-0.5 py-0.1 text-[8px] font-semibold text-purple-600 border border-purple-100">
                          CG{sq.choiceGroupNo}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="sticky top-0 right-0 bg-blue-50 z-30 px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 text-center w-20 border-l border-slate-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05),_0_2px_4px_rgba(0,0,0,0.02)]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rowIndex) => (
                  <tr
                    key={row.studentId}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      row.isAbsent ? "bg-red-50/20 text-slate-400" : ""
                    }`}
                  >
                    {/* Student Info */}
                    <td className="sticky left-0 bg-white hover:bg-slate-50/50 px-3 py-2 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100">
                      <p className="font-semibold text-slate-900 text-xs truncate max-w-[130px]" title={row.name}>{row.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{row.rollNumber}</p>
                    </td>

                    {/* Absent Toggle Button */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => canEdit && handleAbsentToggle(row.studentId)}
                        disabled={!canEdit}
                        className={`inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10px] font-medium transition-all ${
                          row.isAbsent
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        {row.isAbsent ? "Absent" : "Present"}
                      </button>
                    </td>

                    {/* Subquestion Inputs */}
                    {subQuestions.map((sq, sqIndex) => {
                      const marksVal = row.marks[sq.id];
                      const exceedsMax = marksVal !== null && marksVal > sq.maxMarks;
                      const isNegative = marksVal !== null && marksVal < 0;
                      const hasError = exceedsMax || isNegative;

                      return (
                        <td key={sq.id} className="px-1 py-1 border-l border-slate-100 align-middle text-center">
                          <input
                            ref={el => {
                              gridRefs.current[`${row.studentId}_${sq.id}`] = el;
                            }}
                            type="number"
                            value={marksVal === null ? "" : marksVal}
                            onChange={e => handleMarksChange(row.studentId, sq.id, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, rowIndex, sqIndex)}
                            disabled={row.isAbsent || !canEdit}
                            className={`w-full max-w-[48px] h-7 mx-auto block rounded-lg border px-1 py-0.5 text-center text-xs font-bold focus:outline-none focus:ring-1 transition-all ${
                              row.isAbsent
                                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                                : hasError
                                ? "border-red-500 focus:ring-red-200 text-red-600 bg-red-50/50"
                                : "border-slate-200 focus:ring-blue-100 hover:border-slate-300 focus:border-blue-500 text-slate-800"
                            }`}
                            placeholder="-"
                            min={0}
                            max={sq.maxMarks}
                            step={0.5}
                          />
                        </td>
                      );
                    })}

                    {/* Calculated Student Total */}
                    <td className="sticky right-0 bg-blue-50 z-10 px-3 py-2 text-center font-bold border-l border-slate-200 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <span className={row.isAbsent ? "text-red-500 font-mono text-xs" : "text-blue-800 text-xs"}>
                        {row.isAbsent ? "AB" : `${row.calculatedTotal} / ${paper.totalMarks}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Actions */}
        {canEdit && (
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={handleFillDemoMarks}
              className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-6 py-3 text-sm font-medium text-purple-700 shadow-sm hover:bg-purple-100 transition-all"
            >
              <FaClipboardList /> Fill Demo Marks
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-6 py-3 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 transition-all"
            >
              <FaTimes /> Clear All Marks
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-900 transition-colors disabled:opacity-50"
            >
              {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
              Save Draft
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <FaCheck /> Submit Draft
            </button>
          </div>
        )}
      </div>

      {/* Toast popup */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
