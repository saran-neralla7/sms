"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FaSpinner, FaCalculator, FaChevronDown, FaChevronUp,
  FaChartBar, FaArrowLeft
} from "react-icons/fa";
import { FaFloppyDisk } from "react-icons/fa6";
import { computeAttainments, AttainmentSummary } from "@/lib/attainments";
import StudentMarksGrid from "@/components/StudentMarksGrid";

// ─────────────────────────────────────────────────────────────
const PO_LABELS = ["PO1","PO2","PO3","PO4","PO5","PO6","PO7","PO8","PO9","PO10","PO11","PO12"];

const levelColor = (v: number) => {
  if (v >= 2.5) return "text-emerald-600 font-extrabold";
  if (v >= 1.5) return "text-amber-600 font-bold";
  if (v > 0)   return "text-orange-500 font-bold";
  return "text-slate-400";
};

function flattenSubQuestions(paper: any) {
  if (!paper) return [];
  const sqs: any[] = [];
  const questions = paper.questions || [];
  for (const q of questions) {
    for (const sq of q.subQuestions || []) {
      sqs.push({ id: sq.id, coMapping: sq.coMapping, maxMarks: sq.maxMarks });
    }
  }
  return sqs;
}

function LevelBadge({ level }: { level: number }) {
  const styles: Record<number, string> = {
    3: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    2: "bg-amber-50 text-amber-700 border border-amber-200",
    1: "bg-orange-50 text-orange-700 border border-orange-200",
    0: "bg-slate-50 text-slate-400 border border-slate-200",
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold ${styles[level] || styles[0]}`}>
      {level}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
export default function SubjectAttainmentAdminPage() {
  const searchParams = useSearchParams();

  const academicYearId = searchParams?.get("academicYearId") || "";
  const departmentId   = searchParams?.get("departmentId") || "";
  const year           = searchParams?.get("year") || "";
  const semester       = searchParams?.get("semester") || "";
  const sectionId      = searchParams?.get("sectionId") || "";
  const subjectId      = searchParams?.get("subjectId") || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Attainment settings (editable)
  const [benchmarkPct, setBenchmarkPct] = useState(50);
  const [decimalPlaces, setDecimalPlaces] = useState(2);

  // Computed result
  const [result, setResult] = useState<AttainmentSummary | null>(null);

  // ── Fetch data ──────────────────────────────────────────────
  useEffect(() => {
    if (!academicYearId || !departmentId || !year || !semester || !sectionId || !subjectId) return;
    setLoading(true);
    fetch(
      `/api/course-files?academicYearId=${academicYearId}&departmentId=${departmentId}&year=${year}&semester=${semester}&sectionId=${sectionId}&subjectId=${subjectId}`
    )
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.courseFile) {
          setBenchmarkPct(d.courseFile.benchmarkPct ?? 50);
          setDecimalPlaces(d.courseFile.attainmentDecimal ?? 2);
        }
      })
      .finally(() => setLoading(false));
  }, [academicYearId, departmentId, year, semester, sectionId, subjectId]);

  // ── Re-calculate whenever settings or data change ──────────
  useEffect(() => {
    if (!data || !data.subject) return;

    const syllabus = data.subject?.syllabus;
    const coList: string[] =
      syllabus && Array.isArray(syllabus.outcomes)
        ? syllabus.outcomes.map((o: any) => o.code)
        : ["CO1","CO2","CO3","CO4","CO5"];

    const mid1SQs = flattenSubQuestions(data.mid1Paper);
    const mid2SQs = flattenSubQuestions(data.mid2Paper);
    const allMarks = [...(data.mid1Marks || []), ...(data.mid2Marks || [])];

    const summary = computeAttainments({
      coList,
      mid1SubQuestions: mid1SQs,
      mid2SubQuestions: mid2SQs,
      allMarks,
      benchmarkPct,
      coPoMappings: data.coPoMappings || [],
      coPsoMappings: data.coPsoMappings || [],
      decimalPlaces,
      students: data.students || [],
      semesterResults: data.semesterResults || [],
      subjectCode: data.subject?.code || "",
    });

    setResult(summary);
  }, [data, benchmarkPct, decimalPlaces]);

  // ── Save settings ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg("");
    const res = await fetch("/api/course-files", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicYearId, departmentId, year, semester, sectionId, subjectId,
        benchmarkPct,
        attainmentDecimal: decimalPlaces,
      }),
    });
    if (res.ok) {
      setSaveMsg("Settings saved ✓");
      setTimeout(() => setSaveMsg(""), 2500);
    }
    setSaving(false);
  }, [academicYearId, departmentId, year, semester, sectionId, subjectId, benchmarkPct, decimalPlaces]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <FaSpinner className="h-10 w-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="font-semibold text-slate-600">Loading subject attainment data...</p>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="p-8 text-center text-red-600 font-bold bg-slate-50 min-h-screen flex items-center justify-center">
        <div>
          <p className="mb-4">{data?.error || "Missing query parameters."}</p>
          <Link href="/admin/course-files" className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm transition-all">
            Back to Course Files
          </Link>
        </div>
      </div>
    );
  }

  const subject  = data.subject;
  const syllabus = subject?.syllabus;
  const coList: string[] =
    syllabus && Array.isArray(syllabus.outcomes)
      ? syllabus.outcomes.map((o: any) => o.code)
      : ["CO1","CO2","CO3","CO4","CO5"];

  const coPoMappings  = data.coPoMappings  || [];
  const coPsoMappings = data.coPsoMappings || [];
  const psoList = ([...new Set(coPsoMappings.map((m: any) => m.pso))] as string[]).sort();

  return (
    <div className="min-h-screen bg-slate-50 pb-16">

      {/* ── Sticky Header ──────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/course-files?academicYearId=${academicYearId}&departmentId=${departmentId}&year=${year}&semester=${semester}&sectionId=${sectionId}&view=attainments`}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors"
            >
              <FaArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <FaCalculator className="text-indigo-600 h-5 w-5" />
            <div>
              <h1 className="text-base font-extrabold text-slate-800 leading-tight">Subject Attainment Analysis</h1>
              <p className="text-xs text-slate-500">{subject?.code} – {subject?.name} ({data.faculty?.empName || data.faculty?.name || "No faculty assigned"})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveMsg && <span className="text-xs text-emerald-600 font-semibold">{saveMsg}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {saving ? <FaSpinner className="animate-spin h-4 w-4" /> : <FaFloppyDisk className="h-4 w-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Subject Header Card ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject Details</span>
              <h2 className="text-lg font-extrabold text-slate-800 leading-tight">{subject?.name}</h2>
              <p className="text-sm font-semibold text-indigo-600 mt-1">{subject?.code}</p>
            </div>
            <div className="border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Faculty & Section</span>
              <p className="text-sm font-bold text-slate-700">{data.faculty?.empName || data.faculty?.name || "No faculty assigned"}</p>
              <p className="text-xs text-slate-500 mt-1">Section: {data.section?.name || "—"} | Branch: {data.department?.name || "—"}</p>
            </div>
            <div className="border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Academic Year & Semester</span>
              <p className="text-sm font-bold text-slate-700">{data.academicYear?.name || "—"}</p>
              <p className="text-xs text-slate-500 mt-1">Year / Semester: Year {year} / Sem {semester}</p>
            </div>
          </div>
        </div>

        {/* ── Student Marksheet Grid ─────────────────────────── */}
        <StudentMarksGrid
          students={data.students || []}
          mid1Paper={data.mid1Paper}
          mid2Paper={data.mid2Paper}
          mid1Marks={data.mid1Marks || []}
          mid2Marks={data.mid2Marks || []}
          semesterResults={data.semesterResults || []}
          subjectCode={subject?.code || ""}
          benchmarkPct={benchmarkPct}
        />

        {/* ── Settings Controls Card ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <FaCalculator className="text-indigo-600 h-4 w-4" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Adjustment Parameters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Benchmark Target Score (%)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range" min={40} max={80} step={5}
                  value={benchmarkPct}
                  onChange={e => setBenchmarkPct(Number(e.target.value))}
                  className="flex-1 accent-indigo-600 cursor-pointer"
                />
                <span className="text-sm font-bold text-indigo-700 w-12 text-right">{benchmarkPct}%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Defines the minimum student score to count as passing (for Mid exams and Assignments)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Decimals Rounding
              </label>
              <div className="flex gap-2">
                {[0, 1, 2].map(v => (
                  <button
                    key={v}
                    onClick={() => setDecimalPlaces(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all cursor-pointer ${
                      decimalPlaces === v
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Precision rounding applied to calculated PO and PSO output attainments</p>
            </div>
          </div>
        </div>

        {/* ── Attainment Results Table ───────────────────────── */}
        {result && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">CO Attainment Results</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Benchmark Level: {benchmarkPct}% &nbsp;|&nbsp;&nbsp;
                {data.semesterResults?.length > 0 ? `University records: ${data.semesterResults.length} students` : "University records: Not uploaded"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3 text-left">Course Outcome</th>
                    <th className="p-3 text-center">Questions Mapped</th>
                    <th className="p-3 text-center">Pass % (Internal)</th>
                    <th className="p-3 text-center">Avg Score %</th>
                    <th className="p-3 text-center bg-slate-50">Internal Level</th>
                    <th className="p-3 text-center">Uni Pass %</th>
                    <th className="p-3 text-center bg-slate-50">Uni Level</th>
                    <th className="p-3 text-center bg-indigo-50 text-indigo-900 font-extrabold">Final Direct Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {result.coResults.map(cr => (
                    <tr key={cr.co} className="hover:bg-slate-50/30 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{cr.co}</td>
                      <td className="p-3 text-center">
                        {cr.subQuestions.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1 justify-center">
                            {cr.subQuestions.map((sq, i) => (
                              <span key={i} className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[10px] font-bold">
                                {sq.maxMarks}M
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">–</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {cr.subQuestions.length > 0
                          ? <span className={cr.combinedPassPct >= benchmarkPct ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                              {cr.combinedPassPct.toFixed(1)}%
                            </span>
                          : <span className="text-slate-300">–</span>
                        }
                      </td>
                      <td className="p-3 text-center text-slate-600">{cr.internalScore.toFixed(1)}%</td>
                      <td className="p-3 text-center bg-slate-50/50">
                        <LevelBadge level={cr.internalLevel} />
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {cr.universityPassPct !== null ? `${cr.universityPassPct.toFixed(1)}%` : <span className="text-slate-300 italic text-[10px]">pending</span>}
                      </td>
                      <td className="p-3 text-center bg-slate-50/50">
                        {cr.universityLevel !== null ? <LevelBadge level={cr.universityLevel} /> : <span className="text-slate-300 text-[10px]">–</span>}
                      </td>
                      <td className="p-3 text-center bg-indigo-50/30">
                        <span className={`text-base ${levelColor(cr.finalAttainment)}`}>
                          {cr.finalAttainment.toFixed(decimalPlaces)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CO-PO Mapping Matrix ───────────────────────────── */}
        {result && coPoMappings.length > 0 && (
          <COPOMatrix
            title="CO-PO Attainment Matrix"
            coList={coList}
            headerList={PO_LABELS}
            mappings={coPoMappings}
            coAttainments={Object.fromEntries(result.coResults.map(r => [r.co, r.finalAttainment]))}
            finalAttainments={result.poAttainments}
            headerKey="po"
            decimalPlaces={decimalPlaces}
          />
        )}

        {/* ── CO-PSO Mapping Matrix ──────────────────────────── */}
        {result && coPsoMappings.length > 0 && (
          <COPOMatrix
            title="CO-PSO Attainment Matrix"
            coList={coList}
            headerList={psoList}
            mappings={coPsoMappings}
            coAttainments={Object.fromEntries(result.coResults.map(r => [r.co, r.finalAttainment]))}
            finalAttainments={result.psoAttainments}
            headerKey="pso"
            decimalPlaces={decimalPlaces}
          />
        )}

        {/* ── PO Attainment Bar Chart ────────────────────────── */}
        {result && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <FaChartBar className="text-indigo-600 h-4 w-4" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Direct PO Attainment Visual Profile</h2>
            </div>
            <div className="flex items-end gap-2.5 h-36 border-b border-slate-100 pb-2 px-2">
              {PO_LABELS.map(po => {
                const val = result.poAttainments[po] ?? 0;
                const pct = (val / 3) * 100;
                return (
                  <div key={po} className="flex flex-col items-center flex-1 gap-1 h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-700">{val > 0 ? val.toFixed(decimalPlaces) : ""}</span>
                    <div
                      className="w-full rounded-t transition-all max-w-[24px]"
                      style={{
                        height: `${Math.max(pct, 2)}%`,
                        backgroundColor: val >= 2.5 ? "#10b981" : val >= 1.5 ? "#f59e0b" : val > 0 ? "#f97316" : "#cbd5e1"
                      }}
                      title={`${po}: ${val.toFixed(2)}`}
                    />
                    <span className="text-[9px] text-slate-400 font-bold mt-1">{po}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-5 mt-4 text-[10px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> ≥ 2.5 High</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> ≥ 1.5 Medium</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> &gt; 0 Low</span>
            </div>
          </div>
        )}

        {/* Empty marks alert */}
        {result && result.coResults.every(r => r.subQuestions.length === 0) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-xs font-semibold flex items-center gap-2">
            ⚠️ No mid-exam papers or assignment questionnaires are mapped for this subject. Direct attainments cannot be computed until question mappings and marks are stored.
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CO-PO / CO-PSO Matrix Component (Helper)
// ─────────────────────────────────────────────────────────────
function COPOMatrix({
  title, coList, headerList, mappings, coAttainments, finalAttainments, headerKey, decimalPlaces
}: {
  title: string;
  coList: string[];
  headerList: string[];
  mappings: any[];
  coAttainments: Record<string, number>;
  finalAttainments: Record<string, number>;
  headerKey: "po" | "pso";
  decimalPlaces: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const getMappingWeight = (co: string, header: string) => {
    const m = mappings.find((x: any) => x.co === co && x[headerKey] === header);
    return m?.weight ?? null;
  };

  const getCellAttainment = (co: string, header: string) => {
    const w = getMappingWeight(co, header);
    if (!w) return null;
    const coAtt = coAttainments[co] ?? 0;
    return ((w / 3) * coAtt);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h2>
        {expanded ? <FaChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <FaChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-3 text-left border-r border-slate-200 sticky left-0 bg-slate-50 z-10">CO</th>
                <th className="p-3 text-center border-r border-slate-200 bg-indigo-50/50 text-indigo-900 font-extrabold">Final Attainment</th>
                {headerList.map(h => (
                  <th key={h} className="p-3 text-center border-slate-200 border-r last:border-r-0 min-w-[64px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {coList.map(co => (
                <tr key={co} className="hover:bg-slate-50/20 transition-colors">
                  <td className="p-3 font-bold text-slate-900 border-r border-slate-200 sticky left-0 bg-white z-10">{co}</td>
                  <td className="p-3 text-center border-r border-slate-200 bg-indigo-50/20 font-bold">
                    <span className={levelColor(coAttainments[co] ?? 0)}>
                      {(coAttainments[co] ?? 0).toFixed(decimalPlaces)}
                    </span>
                  </td>
                  {headerList.map(h => {
                    const w = getMappingWeight(co, h);
                    const cell = getCellAttainment(co, h);
                    return (
                      <td key={h} className="p-3 text-center border-r border-slate-100 last:border-r-0">
                        {w ? (
                          <div className="flex flex-col items-center">
                            <span className="text-slate-400 text-[10px] font-bold">Map: {w}</span>
                            <span className={`font-bold text-xs ${levelColor(cell ?? 0)}`}>
                              {(cell ?? 0).toFixed(decimalPlaces)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-200">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Overall Attainment Row */}
              <tr className="bg-indigo-50/40 border-t border-slate-200 font-bold">
                <td className="p-3 text-xs font-extrabold text-indigo-950 border-r border-slate-200 sticky left-0 bg-indigo-50 uppercase z-10">
                  {headerKey.toUpperCase()} Attainment
                </td>
                <td className="p-3 border-r border-slate-200 bg-indigo-50/30" />
                {headerList.map(h => (
                  <td key={h} className="p-3 text-center border-r border-slate-100 last:border-r-0">
                    {finalAttainments[h] !== undefined ? (
                      <span className={`text-sm ${levelColor(finalAttainments[h])}`}>
                        {finalAttainments[h].toFixed(decimalPlaces)}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">–</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
