"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FaArrowLeft,
  FaSave,
  FaSpinner,
  FaInfoCircle,
  FaTimes,
  FaPlus,
  FaTrash,
  FaClipboardList,
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

type MatrixType = Record<string, Record<string, number | null>>;

function CoPsoMappingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = searchParams ? searchParams.get("subjectId") : null;
  const { data: session } = useSession();

  const [subjectInfo, setSubjectInfo] = useState<{ name: string; code: string } | null>(null);
  const [cos, setCos] = useState<string[]>(["CO1", "CO2", "CO3", "CO4", "CO5"]);
  const [psos, setPsos] = useState<string[]>(["PSO1", "PSO2", "PSO3"]);
  const [matrix, setMatrix] = useState<MatrixType>({
    CO1: { PSO1: null, PSO2: null, PSO3: null },
    CO2: { PSO1: null, PSO2: null, PSO3: null },
    CO3: { PSO1: null, PSO2: null, PSO3: null },
    CO4: { PSO1: null, PSO2: null, PSO3: null },
    CO5: { PSO1: null, PSO2: null, PSO3: null },
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
      const res = await fetch(`/api/mid-exam/co-pso-mapping?subjectId=${subjectId}`);
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

        // Determine PSOs from loaded mappings or default to PSO1-PSO3
        let activePsos = ["PSO1", "PSO2", "PSO3"];
        if (Array.isArray(data.mappings) && data.mappings.length > 0) {
          const uniquePsos = Array.from(
            new Set<string>(data.mappings.map((m: any) => m.pso))
          );
          if (uniquePsos.length > 0) {
            // Sort PSOs numerically
            activePsos = uniquePsos.sort((a, b) => {
              const numA = parseInt(a.replace(/\D/g, "")) || 0;
              const numB = parseInt(b.replace(/\D/g, "")) || 0;
              return numA - numB;
            });
          }
        }
        setPsos(activePsos);

        const loadedMatrix: MatrixType = {};
        activeCOs.forEach((co) => {
          loadedMatrix[co] = {};
          activePsos.forEach((pso) => {
            loadedMatrix[co][pso] = null;
          });
        });

        if (Array.isArray(data.mappings)) {
          data.mappings.forEach((m: any) => {
            if (loadedMatrix[m.co] && m.pso in loadedMatrix[m.co]) {
              loadedMatrix[m.co][m.pso] = m.weight;
            }
          });
        }

        setMatrix(loadedMatrix);
        setInitialState(JSON.stringify({ psos: activePsos, matrix: loadedMatrix }));
      } else {
        showToast("Failed to load CO-PSO mappings", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error loading CO-PSO mappings", "error");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

  const handleInputChange = (co: string, pso: string, value: string) => {
    // Allow only "", "1", "2", "3"
    if (value === "" || /^[1-3]$/.test(value)) {
      setMatrix((prev) => ({
        ...prev,
        [co]: {
          ...prev[co],
          [pso]: value === "" ? null : parseInt(value),
        },
      }));
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    coIndex: number,
    psoIndex: number
  ) => {
    const key = e.key;
    let nextCoIdx = coIndex;
    let nextPsoIdx = psoIndex;

    if (key === "ArrowUp") {
      e.preventDefault();
      nextCoIdx = Math.max(0, coIndex - 1);
    } else if (key === "ArrowDown") {
      e.preventDefault();
      nextCoIdx = Math.min(cos.length - 1, coIndex + 1);
    } else if (key === "ArrowLeft") {
      e.preventDefault();
      nextPsoIdx = psoIndex - 1;
      if (nextPsoIdx < 0) {
        if (coIndex > 0) {
          nextCoIdx = coIndex - 1;
          nextPsoIdx = psos.length - 1;
        } else {
          nextPsoIdx = 0;
        }
      }
    } else if (key === "ArrowRight" || key === "Enter" || (key === "Tab" && !e.shiftKey)) {
      e.preventDefault();
      nextPsoIdx = psoIndex + 1;
      if (nextPsoIdx >= psos.length) {
        if (coIndex < cos.length - 1) {
          nextCoIdx = coIndex + 1;
          nextPsoIdx = 0;
        } else {
          nextPsoIdx = psos.length - 1;
        }
      }
    } else if (key === "Tab" && e.shiftKey) {
      e.preventDefault();
      nextPsoIdx = psoIndex - 1;
      if (nextPsoIdx < 0) {
        if (coIndex > 0) {
          nextCoIdx = coIndex - 1;
          nextPsoIdx = psos.length - 1;
        } else {
          nextPsoIdx = 0;
        }
      }
    } else {
      return;
    }

    const nextCo = cos[nextCoIdx];
    const nextPso = psos[nextPsoIdx];
    const refKey = `${nextCo}_${nextPso}`;
    const inputEl = inputRefs.current[refKey];
    if (inputEl) {
      inputEl.focus();
      setTimeout(() => {
        inputEl.select();
      }, 10);
    }
  };

  const handleAddPso = () => {
    let nextNum = 1;
    psos.forEach((p) => {
      const match = p.match(/^PSO(\d+)$/i);
      if (match) {
        const num = parseInt(match[1]);
        if (num >= nextNum) nextNum = num + 1;
      }
    });
    const newPsoName = `PSO${nextNum}`;
    
    setPsos((prev) => [...prev, newPsoName]);
    setMatrix((prev) => {
      const nextMatrix = { ...prev };
      cos.forEach((co) => {
        if (!nextMatrix[co]) nextMatrix[co] = {};
        nextMatrix[co][newPsoName] = null;
      });
      return nextMatrix;
    });
  };

  const handleDeletePso = (psoToDelete: string) => {
    let hasValues = false;
    cos.forEach((co) => {
      if (matrix[co]?.[psoToDelete] !== null && matrix[co]?.[psoToDelete] !== undefined) {
        hasValues = true;
      }
    });

    if (hasValues) {
      if (
        !window.confirm(
          `PSO "${psoToDelete}" has mapped correlation values. Are you sure you want to delete it?`
        )
      ) {
        return;
      }
    }

    setPsos((prev) => prev.filter((p) => p !== psoToDelete));
    setMatrix((prev) => {
      const nextMatrix = { ...prev };
      cos.forEach((co) => {
        if (nextMatrix[co]) {
          const { [psoToDelete]: _, ...rest } = nextMatrix[co];
          nextMatrix[co] = rest;
        }
      });
      return nextMatrix;
    });
  };

  const handleClearAll = () => {
    if (!window.confirm("Are you sure you want to clear all mappings?")) return;
    const cleared: MatrixType = {};
    cos.forEach((co) => {
      cleared[co] = {};
      psos.forEach((pso) => {
        cleared[co][pso] = null;
      });
    });
    setMatrix(cleared);
    showToast("Matrix cleared locally. Click Save to persist.", "success");
  };

  const handleSave = async () => {
    const flatMappings: Array<{ co: string; pso: string; weight: number | null }> = [];
    cos.forEach((co) => {
      psos.forEach((pso) => {
        flatMappings.push({
          co,
          pso,
          weight: matrix[co]?.[pso] ?? null,
        });
      });
    });

    setSaving(true);
    try {
      const res = await fetch("/api/mid-exam/co-pso-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          mappings: flatMappings,
        }),
      });

      if (res.ok) {
        showToast("CO-PSO Mappings saved successfully!", "success");
        setInitialState(JSON.stringify({ psos, matrix }));
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
  const columnAverages = psos.map((pso) => {
    let sum = 0;
    let count = 0;
    cos.forEach((co) => {
      const val = matrix[co]?.[pso];
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

  const currentStateStr = JSON.stringify({ psos, matrix });
  const isChanged = initialState !== currentStateStr;

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
                <h1 className="font-bold text-slate-900">CO - PSO Mapping Matrix</h1>
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
                onClick={handleAddPso}
                className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100 transition-all"
              >
                <FaPlus /> Add PSO
              </button>
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
              Click <span className="font-bold text-blue-700 hover:underline cursor-pointer" onClick={handleAddPso}>+ Add PSO</span> to create a new PSO column. 
              Click the trash icon (<FaTrash className="inline pb-0.5" />) on any PSO column header to delete that PSO.
            </p>
          </div>
        </div>

        {/* Matrix Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-100">
          <table className="w-full border-collapse text-left table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 w-32">
                  {subjectInfo?.code || "CO-PSO"}
                </th>
                {psos.map((pso, psoIdx) => (
                  <th
                    key={pso}
                    className="px-1 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-800 border-l border-slate-100 relative group"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{pso}</span>
                      <button
                        onClick={() => handleDeletePso(pso)}
                        title={`Delete ${pso}`}
                        className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
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
                  {psos.map((pso, psoIndex) => {
                    const cellVal = matrix[co]?.[pso];
                    return (
                      <td
                        key={pso}
                        className="px-1 py-1.5 border-l border-slate-100 align-middle text-center"
                      >
                        <input
                          ref={(el) => {
                            inputRefs.current[`${co}_${pso}`] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          pattern="[1-3]*"
                          maxLength={1}
                          value={cellVal === null || cellVal === undefined ? "" : cellVal}
                          onChange={(e) => handleInputChange(co, pso, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, coIndex, psoIndex)}
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
                {columnAverages.map((avg, psoIdx) => (
                  <td
                    key={psos[psoIdx]}
                    className="px-1 py-3 text-center text-xs font-extrabold text-blue-700 border-l border-slate-200"
                  >
                    {avg !== null ? avg.toFixed(2) : ""}
                  </td>
                ))}
              </tr>

              {/* Total Average Row */}
              <tr className="bg-blue-50/60 border-t border-slate-200">
                <td className="px-4 py-3 font-bold text-slate-900 text-xs">overall average</td>
                <td
                  colSpan={psos.length}
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

export default function CoPsoMappingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LogoSpinner fullScreen={false} />
        </div>
      }
    >
      <CoPsoMappingContent />
    </Suspense>
  );
}
