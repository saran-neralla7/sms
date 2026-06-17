"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaSave,
  FaCheck,
  FaSpinner,
  FaInfoCircle,
  FaTimes,
  FaClipboardList,
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

const POS = [
  "PO1",
  "PO2",
  "PO3",
  "PO4",
  "PO5",
  "PO6",
  "PO7",
  "PO8",
  "PO9",
  "PO10",
  "PO11",
  "PO12",
];

type MatrixType = Record<string, Record<string, number | null>>;

function CoPoMappingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = searchParams ? searchParams.get("subjectId") : null;
  const { data: session } = useSession();

  const [subjectInfo, setSubjectInfo] = useState<{ name: string; code: string } | null>(null);
  const [cos, setCos] = useState<string[]>(["CO1", "CO2", "CO3", "CO4", "CO5"]);
  const [matrix, setMatrix] = useState<MatrixType>({
    CO1: { PO1: null, PO2: null, PO3: null, PO4: null, PO5: null, PO6: null, PO7: null, PO8: null, PO9: null, PO10: null, PO11: null, PO12: null },
    CO2: { PO1: null, PO2: null, PO3: null, PO4: null, PO5: null, PO6: null, PO7: null, PO8: null, PO9: null, PO10: null, PO11: null, PO12: null },
    CO3: { PO1: null, PO2: null, PO3: null, PO4: null, PO5: null, PO6: null, PO7: null, PO8: null, PO9: null, PO10: null, PO11: null, PO12: null },
    CO4: { PO1: null, PO2: null, PO3: null, PO4: null, PO5: null, PO6: null, PO7: null, PO8: null, PO9: null, PO10: null, PO11: null, PO12: null },
    CO5: { PO1: null, PO2: null, PO3: null, PO4: null, PO5: null, PO6: null, PO7: null, PO8: null, PO9: null, PO10: null, PO11: null, PO12: null },
  });
  const [initialState, setInitialState] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!subjectId) return;
    try {
      const res = await fetch(`/api/mid-exam/co-po-mapping?subjectId=${subjectId}`);
      if (res.ok) {
        const data = await res.json();
        setSubjectInfo(data.subject);

        let activeCOs = ["CO1", "CO2", "CO3", "CO4", "CO5"];
        if (data.subject?.syllabus) {
          const syllabusObj = data.subject.syllabus as any;
          if (Array.isArray(syllabusObj.outcomes) && syllabusObj.outcomes.length > 0) {
            activeCOs = syllabusObj.outcomes.map((co: any) => co.code || co.id || co);
          }
        }
        setCos(activeCOs);

        const loadedMatrix: MatrixType = {};
        activeCOs.forEach((co) => {
          loadedMatrix[co] = {};
          POS.forEach((po) => {
            loadedMatrix[co][po] = null;
          });
        });

        if (Array.isArray(data.mappings)) {
          data.mappings.forEach((m: any) => {
            if (loadedMatrix[m.co] && m.po in loadedMatrix[m.co]) {
              loadedMatrix[m.co][m.po] = m.weight;
            }
          });
        }

        setMatrix(loadedMatrix);
        setInitialState(JSON.stringify(loadedMatrix));
      } else {
        showToast("Failed to load CO-PO mappings", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading CO-PO mappings", "error");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

  const handleInputChange = (co: string, po: string, value: string) => {
    // Allow only "", "1", "2", "3"
    if (value === "" || /^[1-3]$/.test(value)) {
      setMatrix((prev) => ({
        ...prev,
        [co]: {
          ...prev[co],
          [po]: value === "" ? null : parseInt(value),
        },
      }));
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    coIndex: number,
    poIndex: number
  ) => {
    const key = e.key;
    let nextCoIdx = coIndex;
    let nextPoIdx = poIndex;

    if (key === "ArrowUp") {
      e.preventDefault();
      nextCoIdx = Math.max(0, coIndex - 1);
    } else if (key === "ArrowDown") {
      e.preventDefault();
      nextCoIdx = Math.min(cos.length - 1, coIndex + 1);
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      nextPoIdx = poIndex - 1;
      if (nextPoIdx < 0) {
        if (coIndex > 0) {
          nextCoIdx = coIndex - 1;
          nextPoIdx = POS.length - 1;
        } else {
          nextPoIdx = 0;
        }
      }
    } else if (key === "ArrowRight" || key === "Enter" || (key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      nextPoIdx = poIndex + 1;
      if (nextPoIdx >= POS.length) {
        if (coIndex < cos.length - 1) {
          nextCoIdx = coIndex + 1;
          nextPoIdx = 0;
        } else {
          nextPoIdx = POS.length - 1;
        }
      }
    } else if (key === "Tab" && e.shiftKey) {
      e.preventDefault();
      nextPoIdx = poIndex - 1;
      if (nextPoIdx < 0) {
        if (coIndex > 0) {
          nextCoIdx = coIndex - 1;
          nextPoIdx = POS.length - 1;
        } else {
          nextPoIdx = 0;
        }
      }
    } else {
      return;
    }

    const nextCo = cos[nextCoIdx];
    const nextPo = POS[nextPoIdx];
    const refKey = `${nextCo}_${nextPo}`;
    const inputEl = inputRefs.current[refKey];
    if (inputEl) {
      inputEl.focus();
      setTimeout(() => {
        inputEl.select();
      }, 10);
    }
  };

  const handleClearAll = () => {
    if (!window.confirm("Are you sure you want to clear all mappings?")) return;
    const cleared: MatrixType = {};
    cos.forEach((co) => {
      cleared[co] = {};
      POS.forEach((po) => {
        cleared[co][po] = null;
      });
    });
    setMatrix(cleared);
    showToast("Matrix cleared locally. Click Save to persist.", "success");
  };

  const handleSave = async () => {
    const flatMappings: Array<{ co: string; po: string; weight: number | null }> = [];
    cos.forEach((co) => {
      POS.forEach((po) => {
        flatMappings.push({
          co,
          po,
          weight: matrix[co]?.[po] ?? null,
        });
      });
    });

    setSaving(true);
    try {
      const res = await fetch("/api/mid-exam/co-po-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          mappings: flatMappings,
        }),
      });

      if (res.ok) {
        showToast("CO-PO Mappings saved successfully!", "success");
        setInitialState(JSON.stringify(matrix));
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to save mappings", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  // Calculations
  const columnAverages = POS.map((po) => {
    let sum = 0;
    let count = 0;
    cos.forEach((co) => {
      const val = matrix[co]?.[po];
      if (val !== null && val !== undefined) {
        sum += val;
        count++;
      }
    });
    return count > 0 ? sum / count : null;
  });

  const activeAverages = columnAverages.filter((v) => v !== null) as number[];
  const overallAverage =
    activeAverages.length > 0
      ? activeAverages.reduce((a, b) => a + b, 0) / activeAverages.length
      : 0;

  const isChanged = initialState !== JSON.stringify(matrix);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-12">
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-bold text-slate-900">CO - PO Mapping Matrix</h1>
                <p className="text-xs text-slate-500">
                  {subjectInfo?.name} ({subjectInfo?.code})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isChanged && (
                <span className="animate-pulse rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                  Unsaved Changes
                </span>
              )}
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 transition-all"
              >
                <FaTimes /> Clear All
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Info Guide */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">Keyboard Navigation & Rules</p>
            <p className="mt-1">
              Type correlation values <code className="font-bold bg-white px-1 rounded border">1</code> (Low),{" "}
              <code className="font-bold bg-white px-1 rounded border">2</code> (Medium), or{" "}
              <code className="font-bold bg-white px-1 rounded border">3</code> (High). Leave empty for no correlation.
            </p>
            <p className="mt-0.5">
              Use arrow keys <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">←</kbd>{" "}
              <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">→</kbd>{" "}
              <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↑</kbd>{" "}
              <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">↓</kbd> or{" "}
              <kbd className="bg-white px-1 py-0.5 rounded border shadow-sm">Enter</kbd> to quickly navigate cells like in Excel.
            </p>
          </div>
        </div>

        {/* Matrix Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-100">
          <table className="w-full border-collapse text-left table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 w-32">
                  {subjectInfo?.code || "CO-PO"}
                </th>
                {POS.map((po) => (
                  <th
                    key={po}
                    className="px-1 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800 border-l border-slate-100"
                  >
                    {po}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cos.map((co, coIndex) => (
                <tr key={co} className="hover:bg-slate-50/40 transition-colors">
                  {/* Row Label */}
                  <td className="px-4 py-2 font-bold text-slate-900 text-xs bg-slate-50/10">
                    {co}
                  </td>
                  {/* Inputs */}
                  {POS.map((po, poIndex) => {
                    const cellVal = matrix[co][po];
                    return (
                      <td
                        key={po}
                        className="px-1 py-1.5 border-l border-slate-100 align-middle text-center"
                      >
                        <input
                          ref={(el) => {
                            inputRefs.current[`${co}_${po}`] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[1-3]*"
                          maxLength={1}
                          value={cellVal === null ? "" : cellVal}
                          onChange={(e) => handleInputChange(co, po, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, coIndex, poIndex)}
                          className="w-full max-w-[40px] h-8 mx-auto block rounded-lg border border-slate-200 px-1 py-0.5 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 transition-all hover:border-slate-300"
                          placeholder=""
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Column-wise Average Row */}
              <tr className="bg-blue-50/30 border-t-2 border-slate-200">
                <td className="px-4 py-3 font-bold text-slate-900 text-xs">avg</td>
                {columnAverages.map((avg, poIdx) => (
                  <td
                    key={POS[poIdx]}
                    className="px-1 py-3 text-center text-xs font-extrabold text-blue-700 border-l border-slate-200"
                  >
                    {avg !== null ? avg.toFixed(2) : ""}
                  </td>
                ))}
              </tr>

              {/* Total Average Row */}
              <tr className="bg-blue-50/60 border-t border-slate-200">
                <td className="px-4 py-3 font-bold text-slate-900 text-xs">total avg</td>
                <td
                  colSpan={12}
                  className="px-4 py-3 text-center text-sm font-black text-blue-900 tracking-wider"
                >
                  {overallAverage > 0 ? overallAverage.toFixed(2) : "0.00"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default function CoPoMappingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LogoSpinner fullScreen={false} />
        </div>
      }
    >
      <CoPoMappingContent />
    </Suspense>
  );
}
