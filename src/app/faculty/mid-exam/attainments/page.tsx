"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FaSpinner, FaCalculator, FaSliders, FaFloppyDisk, FaChevronDown, FaChevronUp,
  FaCircleCheck, FaCircleXmark, FaChartBar
} from "react-icons/fa6";
import { computeAttainments, AttainmentSummary } from "@/lib/attainments";

// ─────────────────────────────────────────────────────────────
// PO/PSO label helpers
// ─────────────────────────────────────────────────────────────
const PO_LABELS = ["PO1","PO2","PO3","PO4","PO5","PO6","PO7","PO8","PO9","PO10","PO11","PO12"];
const levelColor = (v: number) => {
  if (v >= 2.5) return "text-emerald-700 font-extrabold";
  if (v >= 1.5) return "text-amber-700 font-bold";
  if (v > 0)   return "text-orange-600 font-bold";
  return "text-slate-400";
};

// ─────────────────────────────────────────────────────────────
// Flatten subquestions from paper (handles master paper)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function AttainmentsPage() {
  const { data: session } = useSession();
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
  const [surveyRating, setSurveyRating] = useState<number | "">(2);
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
          setSurveyRating(d.courseFile.surveyRating ?? 2);
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

    const sr = typeof surveyRating === "number" && surveyRating >= 1 ? surveyRating : 1;

    const summary = computeAttainments({
      coList,
      mid1SubQuestions: mid1SQs,
      mid2SubQuestions: mid2SQs,
      allMarks,
      benchmarkPct,
      surveyRating: sr,
      coPoMappings: data.coPoMappings || [],
      coPsoMappings: data.coPsoMappings || [],
      decimalPlaces,
      students: data.students || [],
      semesterResults: data.semesterResults || [],
      subjectCode: data.subject?.code || "",
    });

    setResult(summary);
  }, [data, benchmarkPct, surveyRating, decimalPlaces]);

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
        surveyRating: typeof surveyRating === "number" ? surveyRating : null,
        attainmentDecimal: decimalPlaces,
      }),
    });
    if (res.ok) {
      setSaveMsg("Settings saved ✓");
      setTimeout(() => setSaveMsg(""), 2500);
    }
    setSaving(false);
  }, [academicYearId, departmentId, year, semester, sectionId, subjectId, benchmarkPct, surveyRating, decimalPlaces]);

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <FaSpinner className="h-10 w-10 text-teal-600 animate-spin mx-auto mb-4" />
          <p className="font-semibold text-slate-600">Loading attainment data...</p>
        </div>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        {data?.error || "Missing query parameters. Please open this page from the mid-exam subjects list."}
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

  // Unique PSO list from mappings
  const psoList = ([...new Set(coPsoMappings.map((m: any) => m.pso))] as string[]).sort();

  return (
    <div className="min-h-screen bg-slate-50 pb-16">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <FaCalculator className="text-teal-600 h-5 w-5" />
            <div>
              <h1 className="text-base font-bold text-slate-800">CO-PO Attainment Calculator</h1>
              <p className="text-xs text-slate-500">
                {subject?.code} – {subject?.name}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-60"
          >
            {saving ? <FaSpinner className="animate-spin h-4 w-4" /> : <FaFloppyDisk className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
        {saveMsg && (
          <div className="max-w-7xl mx-auto mt-1">
            <span className="text-xs text-emerald-600 font-semibold">{saveMsg}</span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Controls Card ──────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <FaSliders className="text-teal-600 h-4 w-4" />
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Attainment Settings</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Benchmark % */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Benchmark Percentage (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={40} max={80} step={5}
                  value={benchmarkPct}
                  onChange={e => setBenchmarkPct(Number(e.target.value))}
                  className="flex-1 accent-teal-600"
                />
                <span className="text-sm font-bold text-teal-700 w-10 text-right">{benchmarkPct}%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Students must score ≥ {benchmarkPct}% to be counted as "passed"</p>
            </div>

            {/* Survey Rating */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Course Exit Survey Rating (1–3)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map(v => (
                  <button
                    key={v}
                    onClick={() => setSurveyRating(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      surveyRating === v
                        ? "bg-teal-600 border-teal-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-teal-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">1 = Low, 2 = Medium, 3 = High (course exit survey feedback)</p>
            </div>

            {/* Decimal Places */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Output Decimal Places
              </label>
              <div className="flex gap-2">
                {[0, 1, 2].map(v => (
                  <button
                    key={v}
                    onClick={() => setDecimalPlaces(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                      decimalPlaces === v
                        ? "bg-slate-700 border-slate-700 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Rounding for final PO/PSO attainment output</p>
            </div>
          </div>
        </div>

        {/* ── CO Attainment Table ─────────────────────────────── */}
        {result && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">CO Attainment Results</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Benchmark: {benchmarkPct}% &nbsp;|&nbsp; Survey: {surveyRating}/3 &nbsp;|&nbsp;
                {data.semesterResults?.length > 0 ? `University results: ${data.semesterResults.length} students` : "University results: Not yet uploaded"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <th className="p-3 text-left border-b border-slate-200">CO</th>
                    <th className="p-3 text-center border-b border-slate-200">Questions Mapped</th>
                    <th className="p-3 text-center border-b border-slate-200">Combined Pass %</th>
                    <th className="p-3 text-center border-b border-slate-200">Survey (1–3)</th>
                    <th className="p-3 text-center border-b border-slate-200">Internal Score</th>
                    <th className="p-3 text-center border-b border-slate-200 bg-blue-50">Internal Level</th>
                    <th className="p-3 text-center border-b border-slate-200">Uni Pass %</th>
                    <th className="p-3 text-center border-b border-slate-200 bg-blue-50">Uni Level</th>
                    <th className="p-3 text-center border-b border-slate-200 bg-teal-50 text-teal-800">Final Attainment</th>
                  </tr>
                </thead>
                <tbody>
                  {result.coResults.map(cr => (
                    <tr key={cr.co} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <td className="p-3 font-bold text-slate-800">{cr.co}</td>
                      <td className="p-3 text-center text-slate-600">
                        {cr.subQuestions.length > 0 ? (
                          <span className="inline-flex flex-wrap gap-1 justify-center">
                            {cr.subQuestions.map((sq, i) => (
                              <span key={i} className="bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-[10px]">
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
                          ? <span className={cr.combinedPassPct >= benchmarkPct ? "text-emerald-700 font-bold" : "text-red-600 font-bold"}>
                              {cr.combinedPassPct.toFixed(1)}%
                            </span>
                          : <span className="text-slate-300">–</span>
                        }
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">{surveyRating}</td>
                      <td className="p-3 text-center text-slate-700">{cr.internalScore.toFixed(1)}%</td>
                      <td className="p-3 text-center bg-blue-50">
                        <LevelBadge level={cr.internalLevel} />
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {cr.universityPassPct !== null ? `${cr.universityPassPct.toFixed(1)}%` : <span className="text-slate-300 italic text-[10px]">pending</span>}
                      </td>
                      <td className="p-3 text-center bg-blue-50">
                        {cr.universityLevel !== null ? <LevelBadge level={cr.universityLevel} /> : <span className="text-slate-300 text-[10px]">–</span>}
                      </td>
                      <td className="p-3 text-center bg-teal-50">
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

        {/* ── CO-PO Matrix ───────────────────────────────────── */}
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

        {/* ── CO-PSO Matrix ──────────────────────────────────── */}
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

        {/* ── Attainment Bar Chart ───────────────────────────── */}
        {result && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <FaChartBar className="text-teal-600 h-4 w-4" />
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">PO Attainment Chart</h2>
            </div>
            <div className="flex items-end gap-2 h-36">
              {PO_LABELS.map(po => {
                const val = result.poAttainments[po] ?? 0;
                const pct = (val / 3) * 100;
                return (
                  <div key={po} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-[10px] font-bold text-slate-600">{val > 0 ? val.toFixed(decimalPlaces) : ""}</span>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${Math.max(pct, 2)}%`,
                        backgroundColor: val >= 2.5 ? "#059669" : val >= 1.5 ? "#d97706" : val > 0 ? "#ea580c" : "#e2e8f0"
                      }}
                    />
                    <span className="text-[9px] text-slate-400 font-medium">{po}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> ≥ 2.5 High</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" /> ≥ 1.5 Medium</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-600 inline-block" /> &gt; 0 Low</span>
            </div>
          </div>
        )}

        {/* No marks notice */}
        {result && result.coResults.every(r => r.subQuestions.length === 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 font-medium">
            ⚠ No mid-exam question papers found for this subject. Please create and submit Mid-I / Mid-II papers with marks before viewing attainment.
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Level Badge Component
// ─────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: 0 | 1 | 2 | 3 }) {
  const styles: Record<number, string> = {
    3: "bg-emerald-100 text-emerald-800 ring-emerald-300",
    2: "bg-amber-100 text-amber-800 ring-amber-300",
    1: "bg-orange-100 text-orange-800 ring-orange-300",
    0: "bg-slate-100 text-slate-400 ring-slate-200",
  };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold ring-1 ${styles[level]}`}>
      {level}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// CO-PO / CO-PSO Matrix Component
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h2>
        {expanded ? <FaChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <FaChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold">
                <th className="p-2 text-left border-b border-r border-slate-200 sticky left-0 bg-slate-50">CO</th>
                <th className="p-2 text-center border-b border-r border-slate-200 bg-teal-50 text-teal-700">Attainment</th>
                {headerList.map(h => (
                  <th key={h} className="p-2 text-center border-b border-slate-200 min-w-[60px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coList.map(co => (
                <tr key={co} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-700 border-r border-slate-200 sticky left-0 bg-white">{co}</td>
                  <td className="p-2 text-center border-r border-slate-200 bg-teal-50">
                    <span className={`font-extrabold ${levelColor(coAttainments[co] ?? 0)}`}>
                      {(coAttainments[co] ?? 0).toFixed(decimalPlaces)}
                    </span>
                  </td>
                  {headerList.map(h => {
                    const w = getMappingWeight(co, h);
                    const cell = getCellAttainment(co, h);
                    return (
                      <td key={h} className="p-2 text-center border-slate-100 border-b">
                        {w ? (
                          <div>
                            <div className="text-slate-500 text-[10px]">{w}</div>
                            <div className={`font-bold text-xs ${levelColor(cell ?? 0)}`}>
                              {(cell ?? 0).toFixed(decimalPlaces)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-200">–</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Final attainment row */}
              <tr className="bg-teal-50 font-bold">
                <td className="p-2 text-xs font-extrabold text-teal-800 border-r border-slate-200 sticky left-0 bg-teal-50 uppercase">
                  {headerKey.toUpperCase()} Attainment
                </td>
                <td className="p-2 border-r border-slate-200" />
                {headerList.map(h => (
                  <td key={h} className="p-2 text-center">
                    {finalAttainments[h] !== undefined ? (
                      <span className={`text-sm ${levelColor(finalAttainments[h])}`}>
                        {finalAttainments[h].toFixed(decimalPlaces)}
                      </span>
                    ) : (
                      <span className="text-slate-300">–</span>
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
