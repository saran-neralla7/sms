"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  FaArrowLeft, FaSpinner, FaDownload, FaChartBar,
  FaClipboardList, FaCheckCircle, FaExclamationTriangle,
  FaCalendarAlt, FaBuilding, FaLayerGroup, FaClock
} from "react-icons/fa";
import { FaCircleInfo, FaFloppyDisk } from "react-icons/fa6";

// ─────────────────────────────────────────────────────────────
const PO_LIST  = ["PO1","PO2","PO3","PO4","PO5","PO6","PO7","PO8","PO9","PO10","PO11","PO12"];
const PSO_LIST = ["PSO1","PSO2","PSO3"];

function gapColor(gap: number | null) {
  if (gap === null) return "text-slate-400";
  if (gap <= 5)  return "text-emerald-600 font-bold";
  if (gap <= 15) return "text-amber-600 font-bold";
  return "text-rose-600 font-bold";
}

function attColor(v: number) {
  if (v >= 2.5) return "#10b981"; // Emerald-500
  if (v >= 1.5) return "#f59e0b"; // Amber-500
  if (v > 0)   return "#f97316"; // Orange-500
  return "#cbd5e1"; // Slate-300
}

// ─────────────────────────────────────────────────────────────
export default function BatchRollupPage() {
  const { data: session } = useSession();
  const sp = useSearchParams();

  // Selector states
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedAY, setSelectedAY] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [year, setYear] = useState("1");
  const [semester, setSemester] = useState("I");
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState("");

  const [loading,  setLoading]  = useState(true);
  const [selectorsLoading, setSelectorsLoading] = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [exporting,setExporting]= useState(false);
  const [data,     setData]     = useState<any>(null);
  const [saveMsg,  setSaveMsg]  = useState("");

  // Local survey state – mirrors poRatings / psoRatings
  const [poRatings,  setPoRatings]  = useState<Record<string, string>>({});
  const [psoRatings, setPsoRatings] = useState<Record<string, string>>({});

  // ── Fetch academic years & departments initially ───────────
  useEffect(() => {
    setSelectorsLoading(true);
    Promise.all([
      fetch("/api/academic-years").then(res => res.json()),
      fetch("/api/departments").then(res => res.json())
    ])
      .then(([years, depts]) => {
        setAcademicYears(years);
        setDepartments(depts);

        // Read query params first, or use defaults
        const paramAY = sp?.get("academicYearId");
        const currentAY = years.find((ay: any) => ay.isCurrent);
        if (paramAY && years.some((y: any) => y.id === paramAY)) {
          setSelectedAY(paramAY);
        } else if (currentAY) {
          setSelectedAY(currentAY.id);
        } else if (years.length > 0) {
          setSelectedAY(years[0].id);
        }

        const paramDept = sp?.get("departmentId");
        if (paramDept && depts.some((d: any) => d.id === paramDept)) {
          setSelectedDept(paramDept);
        } else if (depts.length > 0) {
          setSelectedDept(depts[0].id);
        }

        const paramYear = sp?.get("year");
        if (paramYear) setYear(paramYear);

        const paramSem = sp?.get("semester");
        if (paramSem) setSemester(paramSem);

        setSelectorsLoading(false);
      })
      .catch(err => {
        console.error("Error loading selectors", err);
        setSelectorsLoading(false);
      });
  }, [sp]);

  // ── Fetch sections when department changes ──────────────────
  useEffect(() => {
    if (!selectedDept) return;
    fetch(`/api/sections?departmentId=${selectedDept}`)
      .then(res => res.json())
      .then(data => {
        setSections(data);
        const paramSection = sp?.get("sectionId");
        if (paramSection && data.some((s: any) => s.id === paramSection)) {
          setSelectedSection(paramSection);
        } else if (data.length > 0) {
          setSelectedSection(data[0].id);
        } else {
          setSelectedSection("");
        }
      })
      .catch(console.error);
  }, [selectedDept, sp]);

  // ── Fetch rollup data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!selectedAY || !selectedDept || !year || !semester || !selectedSection) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/course-files/rollup?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      // Seed survey inputs from saved values
      const saved = json.programSurvey ?? {};
      const pr: Record<string,string> = {};
      const psr: Record<string,string> = {};
      PO_LIST.forEach(po   => { pr[po]   = saved.poRatings?.[po]  != null ? String(saved.poRatings[po])  : ""; });
      PSO_LIST.forEach(pso => { psr[pso] = saved.psoRatings?.[pso] != null ? String(saved.psoRatings[pso]) : ""; });
      setPoRatings(pr);
      setPsoRatings(psr);
    } catch (e: any) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAY, selectedDept, year, semester, selectedSection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Save survey ────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedAY || !selectedDept || !year || !semester) return;
    setSaving(true); setSaveMsg("");
    const poObj: Record<string,number>  = {};
    const psoObj: Record<string,number> = {};
    PO_LIST.forEach(po   => { if (poRatings[po]  !== "") poObj[po]   = parseFloat(poRatings[po]);  });
    PSO_LIST.forEach(pso => { if (psoRatings[pso] !== "") psoObj[pso] = parseFloat(psoRatings[pso]); });
    const res = await fetch("/api/course-files/rollup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ academicYearId: selectedAY, departmentId: selectedDept, year, semester, poRatings: poObj, psoRatings: psoObj }),
    });
    if (res.ok) {
      setSaveMsg("Survey saved ✓");
      setTimeout(() => setSaveMsg(""), 2500);
      fetchData();
    }
    setSaving(false);
  };

  // ── Export ─────────────────────────────────────────────────
  const handleExport = () => {
    if (!selectedAY || !selectedDept || !year || !semester || !selectedSection) return;
    setExporting(true);
    const url = `/api/course-files/export?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`;
    const a = document.createElement("a"); a.href = url; a.click();
    setTimeout(() => setExporting(false), 2500);
  };

  // ── Derived calculations ───────────────────────────────────
  function getPORating(po: string)  { return parseFloat(poRatings[po]  || "0") || 0; }
  function getPSORating(pso: string){ return parseFloat(psoRatings[pso] || "0") || 0; }

  const subjects: any[] = data?.subjects ?? [];
  const allKeys = [...PO_LIST, ...PSO_LIST];

  // Batch average mapping weight for a PO/PSO
  function getBatchAvgMapping(key: string) {
    if (!subjects.length) return 0;
    const isPSO = key.startsWith("PSO");
    const vals = subjects
      .map((s: any) => {
        const mappingMap = isPSO ? s.avgMappingPSO : s.avgMappingPO;
        return mappingMap?.[key] ?? null;
      })
      .filter((v) => v !== null) as number[];
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
  }

  // Batch average direct attainment for a PO/PSO
  function getBatchAvgDirect(key: string) {
    if (!subjects.length) return 0;
    const isPSO = key.startsWith("PSO");
    const vals = subjects
      .map((s: any) => {
        const directMap = isPSO ? s.psoAttainments : s.poAttainments;
        return directMap?.[key] ?? null;
      })
      .filter((v) => v !== null) as number[];
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 0;
  }

  // Calculated batch metrics (used for visual charts & summary rows)
  function getBatchSummaryMetrics(key: string) {
    const isPSO = key.startsWith("PSO");
    const mapping = getBatchAvgMapping(key);
    const direct = getBatchAvgDirect(key);
    const survey = isPSO ? getPSORating(key) : getPORating(key);

    const direct80 = +(direct * 0.8).toFixed(2);
    const survey20 = +(survey * 0.2).toFixed(2);
    const achieved = +(direct80 + survey20).toFixed(2);
    const target = +(mapping * 0.85).toFixed(2);
    const attained = +(mapping - achieved).toFixed(2);
    const gap = mapping > 0 ? +((attained / mapping) * 100).toFixed(1) : 0;

    return { mapping, direct, direct80, survey, survey20, achieved, target, attained, gap };
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">

      {/* ── Sticky Header ──────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href={`/admin/course-files?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors">
              <FaArrowLeft className="h-3.5 w-3.5" /> Back to Monitor
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <FaChartBar className="h-5 w-5 text-indigo-600" />
            <div>
              <h1 className="text-base font-extrabold text-slate-800 leading-tight">Batch Rollup &amp; Gap Analysis</h1>
              <p className="text-xs text-slate-500">Program Attainment Evaluation Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveMsg && <span className="text-xs text-emerald-600 font-semibold">{saveMsg}</span>}
            <button onClick={handleSave} disabled={saving || !data}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer">
              {saving ? <FaSpinner className="animate-spin h-3.5 w-3.5"/> : <FaFloppyDisk className="h-3.5 w-3.5"/>}
              Save Survey
            </button>
            <button onClick={handleExport} disabled={exporting || !data}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-sm cursor-pointer">
              {exporting ? <FaSpinner className="animate-spin h-3.5 w-3.5"/> : <FaDownload className="h-3.5 w-3.5"/>}
              Download Excel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-8">

        {/* ── Selection Dropdowns ───────────────────────────── */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FaLayerGroup className="h-3.5 w-3.5 text-indigo-600" />
            Select Batch Filter Parameters
          </h2>
          {selectorsLoading ? (
            <div className="flex items-center justify-center py-4">
              <FaSpinner className="h-6 w-6 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {/* Academic Year */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FaCalendarAlt className="h-3 w-3 text-slate-400" /> Academic Year
                </label>
                <select
                  value={selectedAY}
                  onChange={e => setSelectedAY(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select AY</option>
                  {academicYears.map(ay => (
                    <option key={ay.id} value={ay.id}>{ay.name} {ay.isCurrent ? "(Current)" : ""}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FaBuilding className="h-3 w-3 text-slate-400" /> Department
                </label>
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Dept</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FaClock className="h-3 w-3 text-slate-400" /> Year
                </label>
                <select
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="1">I Year</option>
                  <option value="2">II Year</option>
                  <option value="3">III Year</option>
                  <option value="4">IV Year</option>
                </select>
              </div>

              {/* Semester */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FaClock className="h-3 w-3 text-slate-400" /> Semester
                </label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="I">I Semester</option>
                  <option value="II">II Semester</option>
                </select>
              </div>

              {/* Section */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FaLayerGroup className="h-3 w-3 text-slate-400" /> Section
                </label>
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Section</option>
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* ── Main Data View ────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <FaSpinner className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-600 font-semibold">Computing batch rollup data…</p>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-2xl text-center px-4 shadow-sm">
            <FaChartBar className="h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No Data Loaded</h3>
            <p className="text-sm text-slate-500 max-w-md mt-1 font-medium">
              Please choose a valid Academic Year, Department, Year, Semester, and Section from the selectors above to load attainment metrics and gap analysis.
            </p>
          </div>
        ) : (
          <>
            {/* ── Info Banner ──────────────────────────────────── */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-6 py-4 flex items-start gap-3">
              <FaCircleInfo className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                <strong className="text-indigo-900">Evaluation Strategy:</strong> Direct Attainment (80%) is computed from Mid Exam marks &amp; University results per subject.
                Indirect Attainment (20%) comes from the Graduate Exit Survey ratings entered below for each PO/PSO (1–3 scale).
                <br />
                <strong className="text-indigo-900">Target</strong> = Avg Mapping Weight × 0.85 &nbsp;|&nbsp;
                <strong className="text-indigo-900">Achieved</strong> = Direct × 0.8 + Survey × 0.2 &nbsp;|&nbsp;
                <strong className="text-indigo-900">Gap%</strong> = (Target − Achieved) / Target × 100
              </p>
            </div>

            {/* ── Survey Input Grid ────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <FaClipboardList className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Graduate Exit Survey — Indirect Attainment (1–3 scale)</h2>
              </div>

              <div className="mb-6">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Program Outcomes (PO1–PO12)</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3">
                  {PO_LIST.map(po => (
                    <div key={po} className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 text-center">{po}</label>
                      <input
                        type="number" min={1} max={3} step={0.01}
                        value={poRatings[po]}
                        onChange={e => setPoRatings(p => ({ ...p, [po]: e.target.value }))}
                        placeholder="—"
                        className="w-full rounded-lg bg-white border border-slate-200 text-center text-sm font-bold text-slate-800 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Program Specific Outcomes (PSO1–PSO3)</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3" style={{ maxWidth: 400 }}>
                  {PSO_LIST.map(pso => (
                    <div key={pso} className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 text-center">{pso}</label>
                      <input
                        type="number" min={1} max={3} step={0.01}
                        value={psoRatings[pso]}
                        onChange={e => setPsoRatings(p => ({ ...p, [pso]: e.target.value }))}
                        placeholder="—"
                        className="w-full rounded-lg bg-white border border-slate-200 text-center text-sm font-bold text-slate-800 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Batch Average Visual Meters ──────────────────── */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <FaChartBar className="h-4 w-4 text-purple-600" />
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Batch-Average Achieved Attainment vs Target</h2>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-3.5 min-w-max px-2">
                  {allKeys.map(key => {
                    const metrics = getBatchSummaryMetrics(key);
                    const ach = metrics.achieved;
                    const tgt = metrics.target;
                    const maxH = 96;
                    const achH = Math.max((ach / 3) * maxH, 2);
                    const tgtH = Math.max((tgt / 3) * maxH, 2);
                    const gap  = metrics.gap;
                    return (
                      <div key={key} className="flex flex-col items-center gap-1.5" style={{ width: 50 }}>
                        <div className="text-[9px] font-bold text-slate-600">{ach.toFixed(2)}</div>
                        <div className="relative flex items-end gap-1" style={{ height: maxH }}>
                          {/* Target bar */}
                          <div className="w-4 rounded opacity-25 bg-slate-400"
                            style={{ height: tgtH }} title={`Target: ${tgt.toFixed(2)}`} />
                          {/* Achieved bar */}
                          <div className="w-4 rounded transition-all duration-500"
                            style={{ height: achH, backgroundColor: attColor(ach) }}
                            title={`Achieved: ${ach.toFixed(2)}`} />
                        </div>
                        <div className="text-[10px] font-extrabold text-slate-700 mt-1">{key}</div>
                        <div className={`text-[9px] font-extrabold ${gap <= 5 ? "text-emerald-600" : gap <= 15 ? "text-amber-500" : "text-rose-500"}`}>
                          {gap > 0 ? `+${gap}%` : `${gap}%`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-5 mt-4 text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-3">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400 opacity-25 inline-block"/>Target (85% mapping)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/>≥ 2.5 High Achieved</span>
              </div>
            </section>

            {/* ── Rollup Table ─────────────────────────────────── */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <FaClipboardList className="h-4 w-4 text-indigo-600" />
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Subject-wise Rollup Table</h2>
                <span className="ml-auto text-xs text-slate-500 font-bold">{subjects.length} subjects loaded</span>
              </div>

              {subjects.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-semibold">No subjects found for this batch.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-max">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[9px] border-b border-slate-200">
                        <th className="px-3 py-3 text-left sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 min-w-[240px]">Course</th>
                        {allKeys.map(k => (
                          <th key={k} className={`px-2 py-3 text-center min-w-[46px] border-r border-slate-200 last:border-r-0 ${k.startsWith("PSO") ? "bg-purple-50/30 text-purple-900" : ""}`}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                      {subjects.map((sub: any, si: number) => {
                        return (
                          <tr key={si} className="hover:bg-slate-50/30 transition-colors border-b border-slate-200 last:border-b-0">
                            {/* Sticky Left Subject cell */}
                            <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 text-left">
                              <Link
                                href={`/admin/course-files/subject-attainment?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}&subjectId=${sub.id}`}
                                className="font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline text-xs leading-tight block uppercase tracking-wide cursor-pointer"
                              >
                                {sub.subjectCode}
                              </Link>
                              <div className="text-slate-800 text-[10px] font-bold mt-1 max-w-[216px] truncate" title={sub.subjectName}>{sub.subjectName}</div>
                              <div className="text-slate-400 text-[9px] mt-0.5 font-bold">{sub.facultyName || "No faculty"}</div>
                            </td>
                            {/* Direct PO/PSO cells */}
                            {allKeys.map(k => {
                              const v = k.startsWith("PSO") ? sub.psoAttainments?.[k] : sub.poAttainments?.[k];
                              return (
                                <td key={k} className={`px-2 py-3 text-center min-w-[46px] border-r border-slate-100 last:border-r-0 ${k.startsWith("PSO") ? "bg-purple-50/10" : ""}`}>
                                  {v != null ? <span className="font-bold text-teal-600">{v.toFixed(2)}</span> : <span className="text-slate-300 font-bold">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Summary Rows */}
                      {/* 1. MAPPING (Average Mapping Weight) */}
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-800">
                        <td className="px-3 py-3 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-extrabold uppercase text-[10px] text-slate-700">
                          Mapping (Average Weight)
                        </td>
                        {allKeys.map(k => {
                          const v = getBatchAvgMapping(k);
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 text-slate-700 font-bold">
                              {v !== null ? v.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 2. DIRECT ATTAINMENT */}
                      <tr className="bg-white border-t border-slate-200 font-bold text-slate-800">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-extrabold uppercase text-[10px] text-teal-800 bg-teal-50/50">
                          Attainment (Direct)
                        </td>
                        {allKeys.map(k => {
                          const v = getBatchAvgDirect(k);
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 text-teal-700 bg-teal-50/20 font-bold">
                              {v !== null ? v.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 3. Actual Gap without indirect % */}
                      <tr className="bg-white border-t border-slate-200 text-slate-700">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-extrabold uppercase text-[10px]">
                          Actual Gap (Without Survey) %
                        </td>
                        {allKeys.map(k => {
                          const m = getBatchAvgMapping(k);
                          const d = getBatchAvgDirect(k);
                          const gap = (m && m > 0 && d !== null) ? +(((m - d) / m) * 100).toFixed(1) : null;
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 font-bold">
                              {gap !== null ? <span className={gapColor(gap)}>{gap > 0 ? `+${gap}%` : `${gap}%`}</span> : "—"}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 4. 80% of Direct Attainment */}
                      <tr className="bg-white border-t border-slate-200 text-slate-600">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-bold uppercase text-[9px]">
                          80% of Direct Attainment
                        </td>
                        {allKeys.map(k => {
                          const d = getBatchAvgDirect(k);
                          const val = d !== null ? +(d * 0.8).toFixed(2) : null;
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 font-medium">
                              {val !== null ? val.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 5. Survey rating */}
                      <tr className="bg-white border-t border-slate-200 font-bold text-slate-800">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-extrabold uppercase text-[10px] text-amber-800 bg-amber-50/50">
                          Survey Rating (Indirect)
                        </td>
                        {allKeys.map(k => {
                          const isPSO = k.startsWith("PSO");
                          const v = isPSO ? getPSORating(k) : getPORating(k);
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 text-amber-700 bg-amber-50/20 font-bold">
                              {v > 0 ? v.toFixed(2) : "—"}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 6. 20% of Survey */}
                      <tr className="bg-white border-t border-slate-200 text-slate-600">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-bold uppercase text-[9px]">
                          20% of Survey Rating
                        </td>
                        {allKeys.map(k => {
                          const isPSO = k.startsWith("PSO");
                          const v = isPSO ? getPSORating(k) : getPORating(k);
                          const val = v > 0 ? +(v * 0.2).toFixed(2) : 0;
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 font-medium">
                              {val > 0 ? val.toFixed(2) : "0.00"}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 7. Achieved */}
                      <tr className="bg-white border-t border-slate-200 font-bold text-slate-800">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-extrabold uppercase text-[10px] text-indigo-900 bg-indigo-50/50">
                          Achieved Attainment
                        </td>
                        {allKeys.map(k => {
                          const metrics = getBatchSummaryMetrics(k);
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 text-indigo-700 bg-indigo-50/20 font-extrabold">
                              {metrics.achieved.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 8. Attained */}
                      <tr className="bg-white border-t border-slate-200 text-slate-700 font-bold">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-extrabold uppercase text-[10px]">
                          Attained (Diff: Map - Achieved)
                        </td>
                        {allKeys.map(k => {
                          const metrics = getBatchSummaryMetrics(k);
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 font-bold">
                              {metrics.attained.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 9. Target */}
                      <tr className="bg-white border-t border-slate-200 text-slate-600 font-bold">
                        <td className="px-3 py-3 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] z-10 font-bold uppercase text-[9px]">
                          Target (85% of Mapping)
                        </td>
                        {allKeys.map(k => {
                          const metrics = getBatchSummaryMetrics(k);
                          return (
                            <td key={k} className="px-2 py-3 text-center border-r border-slate-200 last:border-r-0 font-medium">
                              {metrics.target.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 10. Gap % */}
                      <tr className="bg-indigo-900 border-t-2 border-indigo-950 font-bold text-white">
                        <td className="px-3 py-3.5 sticky left-0 bg-indigo-950 border-r border-indigo-800 shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10 font-extrabold uppercase text-[10px] text-white">
                          Gap %
                        </td>
                        {allKeys.map(k => {
                          const metrics = getBatchSummaryMetrics(k);
                          const g = metrics.gap;
                          return (
                            <td key={k} className="px-2 py-3.5 text-center border-r border-indigo-800 last:border-r-0 bg-indigo-900 font-extrabold">
                              {g > 0 ? `+${g}%` : `${g}%`}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Legend ───────────────────────────────────────── */}
            <div className="flex flex-wrap gap-5 text-[11px] text-slate-500 font-bold">
              <span className="flex items-center gap-1.5"><FaCheckCircle className="text-emerald-500 h-3.5 w-3.5"/> Gap ≤ 5% — Target Met</span>
              <span className="flex items-center gap-1.5"><FaExclamationTriangle className="text-amber-500 h-3.5 w-3.5"/> Gap 5–15% — Shortfall</span>
              <span className="flex items-center gap-1.5"><FaExclamationTriangle className="text-rose-500 h-3.5 w-3.5"/> Gap &gt; 15% — High Shortfall</span>
              <span className="ml-auto text-slate-400 font-normal">Formula: Achieved = Direct×0.8 + Survey×0.2 &nbsp;|&nbsp; Target = Avg Mapping × 0.85</span>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
