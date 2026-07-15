"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBook, FaCalendarAlt, FaFileAlt, FaSpinner, FaUpload, FaTrash, FaCheckCircle,
  FaArrowLeft, FaExclamationTriangle, FaPlus, FaSave, FaListOl, FaGraduationCap,
  FaTimes, FaColumns, FaCompress, FaExpand
} from "react-icons/fa";
import Link from "next/link";
import LogoSpinner from "@/components/LogoSpinner";
import { calculateStudentTotal } from "@/lib/mid-exam-calc";
import { formatISTDate } from "@/lib/dateUtils";

interface Mapping {
  id: string;
  facultyId: string;
  subject: { id: string; name: string; code: string; type: string; year: string; semester: string; departmentId: string; isElective?: boolean };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
  batch?: string | null;
}

interface RubricItem {
  description: string;
  marks: number;
}

interface StructuredScheme {
  version: number;
  type: "structured";
  rubrics: Record<string, RubricItem[]>;
}

function parseSchemeText(text: string): StructuredScheme | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.type === "structured" && parsed.rubrics) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

function normalizeUnitName(name: string): string {
  if (!name) return "";
  return name.toUpperCase().replace(/[^A-Z]/g, "");
}

function parseLecturePlan(dbValue: any) {
  const defaultPlan = [
    { unit: "Unit I", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit II", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit III", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit IV", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit V", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] }
  ];

  if (!dbValue || !Array.isArray(dbValue) || dbValue.length === 0) {
    return defaultPlan;
  }

  // Check if it's already in the new format (array of unit-grouped objects)
  if (dbValue[0] && 'topics' in dbValue[0]) {
    const plan = [...defaultPlan];
    dbValue.forEach((unitData: any) => {
      const uIdx = plan.findIndex(p => p.unit.toLowerCase() === (unitData.unit || "").toLowerCase());
      if (uIdx !== -1) {
        plan[uIdx] = {
          unit: plan[uIdx].unit,
          title: unitData.title || "",
          references: unitData.references || "",
          topics: Array.isArray(unitData.topics) && unitData.topics.length > 0
            ? unitData.topics.map((t: any) => ({
                topic: t.topic || "",
                plannedPeriods: parseInt(t.plannedPeriods) || 1
              }))
            : [{ topic: "", plannedPeriods: 1 }]
        };
      }
    });
    return plan;
  }

  // It's in the old flat format, group it
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
    // Check if this row was acting as a unit header
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

  // Ensure each unit has at least one topic row
  plan.forEach(u => {
    if (u.topics.length === 0) {
      u.topics.push({ topic: "", plannedPeriods: 1 });
    }
  });

  return plan;
}

const StructuredSchemeEditor: React.FC<{
  examType: "MID_I" | "MID_II";
  paper: any;
  schemeText: string;
  onChange: (val: string) => void;
}> = ({ examType, paper, schemeText, onChange }) => {
  const [mode, setMode] = useState<"structured" | "free">("free");
  const [rubrics, setRubrics] = useState<Record<string, RubricItem[]>>({});

  useEffect(() => {
    const parsed = parseSchemeText(schemeText);
    if (parsed) {
      setMode("structured");
      setRubrics(parsed.rubrics || {});
    } else {
      if (schemeText.trim() !== "") {
        setMode("free");
      } else if (paper) {
        setMode("structured");
        const initialRubrics: Record<string, RubricItem[]> = {};
        paper.questions?.forEach((q: any) => {
          q.subQuestions?.forEach((sq: any) => {
            const key = `${q.questionNo}_${sq.subLabel}`;
            initialRubrics[key] = [{ description: "", marks: sq.maxMarks || 0 }];
          });
        });
        setRubrics(initialRubrics);
      } else {
        setMode("free");
      }
    }
  }, [schemeText, paper]);

  const updateRubricItems = (key: string, items: RubricItem[]) => {
    const updated = { ...rubrics, [key]: items };
    setRubrics(updated);
    onChange(JSON.stringify({ version: 1, type: "structured", rubrics: updated }));
  };

  const addRow = (key: string) => {
    const items = rubrics[key] ? [...rubrics[key]] : [];
    items.push({ description: "", marks: 0 });
    updateRubricItems(key, items);
  };

  const removeRow = (key: string, index: number) => {
    const items = rubrics[key] ? [...rubrics[key]] : [];
    if (items.length > 1) {
      items.splice(index, 1);
      updateRubricItems(key, items);
    }
  };

  const handleChange = (key: string, index: number, field: keyof RubricItem, value: any) => {
    const items = rubrics[key] ? [...rubrics[key]] : [];
    if (items[index]) {
      if (field === "marks") {
        items[index].marks = parseInt(value) || 0;
      } else {
        items[index].description = value;
      }
      updateRubricItems(key, items);
    }
  };

  if (!paper) {
    return (
      <div className="flex flex-col gap-2">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-xs font-semibold">
          ⚠️ No {examType === "MID_I" ? "MID-I" : "MID-II"} exam question paper has been registered or mapped for this subject.
          Please upload or map a question paper to enable the structured scheme builder, or type/paste free-text rubrics below.
        </div>
        <textarea
          rows={6}
          value={schemeText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter scheme of evaluation in free text..."
          className="w-full rounded-xl border border-slate-300 p-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border border-slate-200 p-4 rounded-xl bg-slate-50/10">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <span className="font-bold text-xs text-slate-700 uppercase">{examType === "MID_I" ? "MID-I" : "MID-II"} Rubrics Builder</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("Switch to Free Text Mode? This may clear structured layout if you write new text.")) {
                setMode("free");
                onChange("");
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === "free"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Free Text Mode
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("structured");
              const initialRubrics: Record<string, RubricItem[]> = {};
              paper.questions?.forEach((q: any) => {
                q.subQuestions?.forEach((sq: any) => {
                  const key = `${q.questionNo}_${sq.subLabel}`;
                  initialRubrics[key] = [{ description: "", marks: sq.maxMarks || 0 }];
                });
              });
              setRubrics(initialRubrics);
              onChange(JSON.stringify({ version: 1, type: "structured", rubrics: initialRubrics }));
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              mode === "structured"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Question-wise Mode
          </button>
        </div>
      </div>

      {mode === "free" ? (
        <textarea
          rows={8}
          value={schemeText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter scheme of evaluation in free text..."
          className="w-full rounded-xl border border-slate-300 p-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
        />
      ) : (
        <div className="flex flex-col gap-6">
          {paper.questions?.map((q: any) => (
            <div key={q.id || q.questionNo} className="border border-slate-100 rounded-xl p-3 bg-white shadow-sm">
              <h5 className="font-extrabold text-slate-800 text-xs uppercase mb-3 pb-1 border-b border-slate-100">
                Question {q.questionNo}
              </h5>
              
              <div className="flex flex-col gap-4">
                {q.subQuestions?.map((sq: any) => {
                  const key = `${q.questionNo}_${sq.subLabel}`;
                  const items = rubrics[key] || [{ description: "", marks: sq.maxMarks || 0 }];
                  const totalAllotted = items.reduce((sum, item) => sum + (item.marks || 0), 0);
                  const isTotalMismatch = totalAllotted !== sq.maxMarks;

                  return (
                    <div key={sq.id || sq.subLabel} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start border-b border-dashed border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="md:col-span-4 flex flex-col gap-1">
                        <span className="font-bold text-xs text-teal-850">
                          ({sq.subLabel}) {sq.questionText || "Sub-question details"}
                        </span>
                        <div className="flex gap-2 flex-wrap text-[10px] font-semibold text-slate-400">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">CO{sq.coMapping}</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded">{sq.btLevel}</span>
                          <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">Max: {sq.maxMarks}M</span>
                        </div>
                      </div>

                      <div className="md:col-span-8 flex flex-col gap-2">
                        {items.map((item, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleChange(key, index, "description", e.target.value)}
                              placeholder="e.g. Diagram / Formula / Derivation steps..."
                              className="flex-grow rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={item.marks}
                                onChange={(e) => handleChange(key, index, "marks", e.target.value)}
                                placeholder="Marks"
                                className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                min={0}
                                max={sq.maxMarks}
                              />
                              <span className="text-[10px] font-bold text-slate-400">M</span>
                            </div>
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(key, index)}
                                className="text-red-500 hover:text-red-700 p-1 text-xs font-bold cursor-pointer"
                                title="Remove rubric detail row"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        
                        <div className="flex justify-between items-center mt-1 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => addRow(key)}
                            className="text-[11px] text-teal-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            + Add Rubric Row
                          </button>
                          
                          {isTotalMismatch && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ⚠️ Rubric total ({totalAllotted}M) mismatch with Max Marks ({sq.maxMarks}M)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function FacultyCourseFilesPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; isCurrent: boolean }[]>([]);
  const [selectedAY, setSelectedAY] = useState("");
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<Mapping | null>(null);

  // Group mappings by subject.id and batch
  const displayMappings = useMemo(() => {
    const groups: Record<string, { key: string; subject: any; academicYear: any; batch: string | null; sections: { id: string; name: string }[]; mappingIds: string[]; facultyId: string }> = {};

    for (const m of mappings) {
      const key = `${m.subject.id}_${m.batch || "no-batch"}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          subject: m.subject,
          academicYear: m.academicYear,
          batch: m.batch || null,
          sections: [],
          mappingIds: [],
          facultyId: m.facultyId
        };
      }
      if (!groups[key].sections.some(s => s.id === m.section.id)) {
        groups[key].sections.push(m.section);
      }
      groups[key].mappingIds.push(m.id);
    }

    const list = Object.values(groups);
    for (const item of list) {
      item.sections.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [mappings]);

  // Course file specific state
  const [cfData, setCfData] = useState<any>(null);
  const [fetchingCf, setFetchingCf] = useState(false);

  // Forms inputs
  const [teachingSupportText, setTeachingSupportText] = useState("");
  const [lecturePlan, setLecturePlan] = useState<{
    unit: string;
    title: string;
    references: string;
    topics: { topic: string; plannedPeriods: number }[];
  }[]>([
    { unit: "Unit I", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit II", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit III", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit IV", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] },
    { unit: "Unit V", title: "", references: "", topics: [{ topic: "", plannedPeriods: 1 }] }
  ]);
  const [assignmentQuestions, setAssignmentQuestions] = useState<{ unit: string; questions: string[] }[]>([
    { unit: "Unit I", questions: ["", ""] },
    { unit: "Unit II", questions: ["", ""] },
    { unit: "Unit III", questions: ["", ""] },
    { unit: "Unit IV", questions: ["", ""] },
    { unit: "Unit V", questions: ["", ""] }
  ]);
  const [remedialClasses, setRemedialClasses] = useState<{ date: string; topics: string; studentRolls: string[] }[]>([]);

  // Direct text/evaluation scheme states
  const [mid1SchemeText, setMid1SchemeText] = useState("");
  const [mid2SchemeText, setMid2SchemeText] = useState("");
  const [tentativeCompletionDate, setTentativeCompletionDate] = useState("");

  // Cloning modal states
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSourceMappingId, setCloneSourceMappingId] = useState("");
  const [cloneMid1Text, setCloneMid1Text] = useState(true);
  const [cloneMid2Text, setCloneMid2Text] = useState(true);

  // Files paths
  const [academicCalendarPath, setAcademicCalendarPath] = useState("");
  const [mid1SchemePath, setMid1SchemePath] = useState("");
  const [mid2SchemePath, setMid2SchemePath] = useState("");
  const [prevPapersPaths, setPrevPapersPaths] = useState<string[]>([]);

  // Slow learners threshold
  const [thresholdType, setThresholdType] = useState<"40" | "50" | "custom">("40");
  const [customThreshold, setCustomThreshold] = useState<number>(40);

  const [showSlowLearnersModal, setShowSlowLearnersModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Active section inside the checklist for input editing
  const [activeFormTab, setActiveFormTab] = useState<"lecture" | "assignments" | "remedial" | "support" | "uploads" | "schemes">("lecture");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Loading indicator for file uploads
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch initial Academic Years
  useEffect(() => {
    fetch("/api/academic-years")
      .then(res => res.json())
      .then(data => {
        setAcademicYears(data);
        const current = data.find((ay: any) => ay.isCurrent);
        if (current) setSelectedAY(current.id);
        else if (data.length > 0) setSelectedAY(data[0].id);
      })
      .catch(err => {
        console.error("Error fetching academic years:", err);
        showToast("Failed to load academic years", "error");
      });
  }, []);

  // Helper to update a unit title
  const handleUnitTitleChange = (unitIdx: number, title: string) => {
    const copy = [...lecturePlan];
    copy[unitIdx].title = title;
    setLecturePlan(copy);
  };

  // Helper to update unit references
  const handleUnitReferencesChange = (unitIdx: number, references: string) => {
    const copy = [...lecturePlan];
    copy[unitIdx].references = references;
    setLecturePlan(copy);
  };

  // Helper to update a topic's field
  const handleTopicChange = (unitIdx: number, topicIdx: number, field: "topic" | "plannedPeriods", val: any) => {
    const copy = [...lecturePlan];
    if (field === "plannedPeriods") {
      copy[unitIdx].topics[topicIdx].plannedPeriods = parseInt(val) || 0;
    } else {
      copy[unitIdx].topics[topicIdx].topic = val;
    }
    setLecturePlan(copy);
  };

  // Helper to add a topic to a unit
  const handleAddTopic = (unitIdx: number) => {
    const copy = [...lecturePlan];
    copy[unitIdx].topics.push({ topic: "", plannedPeriods: 1 });
    setLecturePlan(copy);
  };

  // Helper to remove a topic from a unit
  const handleRemoveTopic = (unitIdx: number, topicIdx: number) => {
    const copy = [...lecturePlan];
    copy[unitIdx].topics.splice(topicIdx, 1);
    if (copy[unitIdx].topics.length === 0) {
      copy[unitIdx].topics.push({ topic: "", plannedPeriods: 1 });
    }
    setLecturePlan(copy);
  };

  // Auto-calculated totals
  const getUnitHours = (unit: typeof lecturePlan[0]) => {
    return unit.topics.reduce((sum, t) => sum + (t.plannedPeriods || 0), 0);
  };

  const getGrandTotalHours = () => {
    return lecturePlan.reduce((sum, u) => sum + getUnitHours(u), 0);
  };

  // Handler to clone scheme of evaluation from another mapping
  const handleCloneScheme = async () => {
    if (!cloneSourceMappingId) return;
    const sourceMapping = mappings.find(m => m.id === cloneSourceMappingId);
    if (!sourceMapping) return;
    
    try {
      const res = await fetch(
        `/api/course-files?academicYearId=${sourceMapping.academicYear.id}&departmentId=${sourceMapping.subject.departmentId}&year=${sourceMapping.subject.year}&semester=${sourceMapping.subject.semester}&sectionId=${sourceMapping.section.id}&subjectId=${sourceMapping.subject.id}&batch=${sourceMapping.batch || ""}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const cf = data.courseFile;
      if (cf) {
        let clonedCount = 0;
        if (cloneMid1Text && cf.mid1SchemeText) {
          setMid1SchemeText(cf.mid1SchemeText);
          clonedCount++;
        }
        if (cloneMid2Text && cf.mid2SchemeText) {
          setMid2SchemeText(cf.mid2SchemeText);
          clonedCount++;
        }
        if (clonedCount > 0) {
          showToast("Scheme of Evaluation cloned successfully! (Click 'Save Changes' to save)", "success");
        } else {
          showToast("Source course file has no scheme of evaluation text to clone.", "error");
        }
      } else {
        showToast("No course file found for the source subject.", "error");
      }
      setShowCloneModal(false);
    } catch (err: any) {
      showToast("Failed to clone scheme: " + err.message, "error");
    }
  };

  // Fetch mappings when Academic Year changes
  useEffect(() => {
    if (!selectedAY) return;
    setLoading(true);
    fetch(`/api/faculty-mappings?academicYearId=${selectedAY}`)
      .then(res => res.json())
      .then(data => {
        setMappings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching mappings:", err);
        showToast("Failed to load subject mappings", "error");
        setLoading(false);
      });
  }, [selectedAY]);

  // Load Course File details once a subject-section mapping is selected
  const selectSubjectMapping = async (mapping: Mapping) => {
    setSelectedMapping(mapping);
    setFetchingCf(true);
    try {
      const res = await fetch(
        `/api/course-files?academicYearId=${mapping.academicYear.id}&departmentId=${mapping.subject.departmentId}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&sectionId=${mapping.section.id}&subjectId=${mapping.subject.id}&batch=${mapping.batch || ""}`
      );
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setCfData(data);

      const cf = data.courseFile;
      const syllabusUnits = data.subject?.syllabus?.units;

      if (cf) {
        setTeachingSupportText(cf.teachingSupportText || "");
        
        let loadedPlan = parseLecturePlan(cf.lecturePlan);
        if (syllabusUnits && Array.isArray(syllabusUnits)) {
          loadedPlan = loadedPlan.map(p => {
            if (!p.title) {
              const matchedUnit = syllabusUnits.find(su => 
                su.name && normalizeUnitName(su.name) === normalizeUnitName(p.unit)
              );
              if (matchedUnit) {
                return { 
                  ...p, 
                  title: (matchedUnit.title || "")
                    .replace(/<[^>]*>/g, "")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, " ")
                    .trim()
                };
              }
            }
            return p;
          });
        }
        setLecturePlan(loadedPlan);
        setMid1SchemeText(cf.mid1SchemeText || "");
        setMid2SchemeText(cf.mid2SchemeText || "");
        setTentativeCompletionDate(cf.tentativeCompletionDate || "");
        
        if (cf.assignmentQuestions && Array.isArray(cf.assignmentQuestions)) {
          setAssignmentQuestions(cf.assignmentQuestions);
        } else {
          setAssignmentQuestions([
            { unit: "Unit I", questions: ["", ""] },
            { unit: "Unit II", questions: ["", ""] },
            { unit: "Unit III", questions: ["", ""] },
            { unit: "Unit IV", questions: ["", ""] },
            { unit: "Unit V", questions: ["", ""] }
          ]);
        }
        setRemedialClasses(cf.remedialClasses || []);
        setAcademicCalendarPath(cf.academicCalendarPath || "");
        setMid1SchemePath(cf.mid1SchemePath || "");
        setMid2SchemePath(cf.mid2SchemePath || "");
        setPrevPapersPaths(cf.prevPapersPaths || []);
      } else {
        // Reset inputs
        setTeachingSupportText("");
        
        let defaultPlan = parseLecturePlan(null);
        if (syllabusUnits && Array.isArray(syllabusUnits)) {
          defaultPlan = defaultPlan.map(p => {
            const matchedUnit = syllabusUnits.find(su => 
              su.name && normalizeUnitName(su.name) === normalizeUnitName(p.unit)
            );
            if (matchedUnit) {
              return { 
                ...p, 
                title: (matchedUnit.title || "")
                  .replace(/<[^>]*>/g, "")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&nbsp;/g, " ")
                  .trim()
              };
            }
            return p;
          });
        }
        setLecturePlan(defaultPlan);
        setMid1SchemeText("");
        setMid2SchemeText("");
        setTentativeCompletionDate("");

        setAssignmentQuestions([
          { unit: "Unit I", questions: ["", ""] },
          { unit: "Unit II", questions: ["", ""] },
          { unit: "Unit III", questions: ["", ""] },
          { unit: "Unit IV", questions: ["", ""] },
          { unit: "Unit V", questions: ["", ""] }
        ]);
        setRemedialClasses([]);
        setAcademicCalendarPath("");
        setMid1SchemePath("");
        setMid2SchemePath("");
        setPrevPapersPaths([]);
      }
    } catch (err: any) {
      console.error(err);
      showToast("Error loading course file details: " + err.message, "error");
    } finally {
      setFetchingCf(false);
    }
  };

  // Handle Save
  const handleSave = async () => {
    if (!selectedMapping) return;
    setSaving(true);
    try {
      const res = await fetch("/api/course-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedMapping.academicYear.id,
          departmentId: selectedMapping.subject.departmentId,
          year: selectedMapping.subject.year,
          semester: selectedMapping.subject.semester,
          sectionId: selectedMapping.section.id,
          subjectId: selectedMapping.subject.id,
          facultyId: selectedMapping.facultyId || (session?.user as any)?.facultyId || (session?.user as any)?.id || "system",
          teachingSupportText,
          assignmentQuestions,
          lecturePlan,
          remedialClasses,
          academicCalendarPath,
          mid1SchemePath,
          mid2SchemePath,
          prevPapersPaths,
          mid1SchemeText,
          mid2SchemeText,
          tentativeCompletionDate
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      showToast("Course file saved successfully!", "success");
      // Reload details to keep state in sync
      selectSubjectMapping(selectedMapping);
    } catch (err: any) {
      showToast(err.message || "Failed to save course file", "error");
    } finally {
      setSaving(false);
    }
  };

  // Upload file API handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "calendar" | "mid1" | "mid2" | "prev") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verify it is a PDF
    if (file.type !== "application/pdf") {
      showToast("Please upload PDF files only.", "error");
      return;
    }

    setUploadingFile(target);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/course-files/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (target === "calendar") setAcademicCalendarPath(data.url);
      else if (target === "mid1") setMid1SchemePath(data.url);
      else if (target === "mid2") setMid2SchemePath(data.url);
      else if (target === "prev") setPrevPapersPaths([...prevPapersPaths, data.url]);

      showToast(`${file.name} uploaded successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploadingFile(null);
      e.target.value = ""; // clear file input
    }
  };

  if (status === "loading" || loading) {
    return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;
  }

  // Active threshold value
  const activeThreshold = thresholdType === "custom" ? customThreshold : parseInt(thresholdType);

  // Calculate slow learners list and progress
  const getSlowLearnersData = () => {
    if (!cfData || !cfData.students) {
      return { slowLearners: [], progressStudents: [] };
    }

    const students = cfData.students || [];
    const mid1Paper = cfData.mid1Paper;
    const mid2Paper = cfData.mid2Paper;
    const mid1Marks = cfData.mid1Marks || [];
    const mid2Marks = cfData.mid2Marks || [];

    const mid1MarksMap: Record<string, number> = {};
    const mid1AbsentMap: Record<string, boolean> = {};
    const mid2MarksMap: Record<string, number> = {};
    const smid2AbsentMap: Record<string, boolean> = {};

    if (mid1Paper) {
      const choiceGroups1 = mid1Paper.choiceGroups || [];
      const questions1 = (mid1Paper.questions || []).map((q: any) => ({
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
      const questions2 = (mid2Paper.questions || []).map((q: any) => ({
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
        smid2AbsentMap[student.id] = isAbs;
      }
    }

    const maxMarks1 = mid1Paper?.totalMarks || 30;
    const maxMarks2 = mid2Paper?.totalMarks || 30;

    const slowLearners = students.map((student: any) => {
      const isAbs = mid1AbsentMap[student.id];
      const score = mid1MarksMap[student.id] || 0;
      const pct = isAbs ? 0 : Math.round((score / maxMarks1) * 100);
      return {
        ...student,
        score,
        pct,
        isAbsent: isAbs
      };
    }).filter((student: any) => {
      if (student.isAbsent) return false;
      return student.pct < activeThreshold;
    });

    const progressStudents = students.map((student: any) => {
      const isAbs1 = mid1AbsentMap[student.id];
      const score1 = mid1MarksMap[student.id] || 0;
      const pct1 = isAbs1 ? 0 : Math.round((score1 / maxMarks1) * 100);
      const wasSlow = !isAbs1 && pct1 < activeThreshold;

      const isAbs2 = smid2AbsentMap[student.id];
      const score2 = mid2MarksMap[student.id] || 0;
      const pct2 = isAbs2 ? 0 : Math.round((score2 / maxMarks2) * 100);
      const improved = !isAbs2 && pct2 >= activeThreshold;

      return {
        ...student,
        score1,
        pct1,
        isAbsent1: isAbs1,
        wasSlow,
        score2,
        pct2,
        isAbsent2: isAbs2,
        improved
      };
    }).filter((student: any) => {
      return student.wasSlow && student.improved;
    });

    return { slowLearners, progressStudents };
  };

  const { slowLearners, progressStudents } = getSlowLearnersData();

  const hasLecturePlan = lecturePlan.some(u => u.topics.some(t => t.topic.trim() !== ""));

  // Helper to detect missing/pending items
  const getPendingItems = () => {
    const pending: string[] = [];
    if (selectedMapping && cfData) {
      if (!cfData.subject?.syllabus) pending.push("Syllabus details");
      if (!cfData.subject?.syllabus?.objectives) pending.push("Course Objectives & Outcomes");
      if (!cfData.coPoMappings?.length) pending.push("CO-PO Mappings");
      if (!academicCalendarPath) pending.push("Academic Calendar Upload");
      if (!hasLecturePlan) pending.push("Lecture Plan entries");
      if (!cfData.students?.length) pending.push("Registered Student Roster");
      if (!cfData.timetable?.length) pending.push("Faculty Timetable mapping");
      if (teachingSupportText.trim().length <= 10) pending.push("Teaching Support Material details");
      if (!assignmentQuestions.some(q => q.questions.some(qn => qn.trim().length > 2))) pending.push("Assignment Questions");
      if (!cfData.mid1Paper) pending.push("I Mid Exam Question Paper");
      if (!mid1SchemePath && !mid1SchemeText) pending.push("I Mid Exam Scheme of Evaluation");
      if (!cfData.mid1Marks?.length) pending.push("I Mid Exam Marks List");
      if (!remedialClasses.length) pending.push("Remedial Classes & Logs");
      if (!cfData.mid2Paper) pending.push("II Mid Exam Question Paper");
      if (!mid2SchemePath && !mid2SchemeText) pending.push("II Mid Exam Scheme of Evaluation");
      if (!cfData.mid2Marks?.length) pending.push("II Mid Exam Marks List");
      if (!cfData.internalMarks?.length) pending.push("Final Sessional Marks (OBE)");
      if (!prevPapersPaths.length) pending.push("Previous Semester Question Papers");
      if (!cfData.semesterResults?.length) pending.push("Semester End Results data");
    }
    return pending;
  };

  const handlePrintClick = () => {
    if (!selectedMapping) return;
    const pending = getPendingItems();
    if (pending.length > 0) {
      setShowPendingModal(true);
    } else {
      const printUrl = `/faculty/course-files/print?academicYearId=${selectedMapping.academicYear.id}&departmentId=${selectedMapping.subject.departmentId}&year=${selectedMapping.subject.year}&semester=${selectedMapping.subject.semester}&sectionId=${selectedMapping.section.id}&subjectId=${selectedMapping.subject.id}&threshold=${activeThreshold}&batch=${selectedMapping.batch || ""}`;
      window.open(printUrl, "_blank");
    }
  };

  const handleForcePrint = () => {
    if (!selectedMapping) return;
    setShowPendingModal(false);
    const printUrl = `/faculty/course-files/print?academicYearId=${selectedMapping.academicYear.id}&departmentId=${selectedMapping.subject.departmentId}&year=${selectedMapping.subject.year}&semester=${selectedMapping.subject.semester}&sectionId=${selectedMapping.section.id}&subjectId=${selectedMapping.subject.id}&threshold=${activeThreshold}&batch=${selectedMapping.batch || ""}`;
    window.open(printUrl, "_blank");
  };

  // Dynamic counts for completion status
  const totalItems = 23;
  let completedCount = 0;

  if (selectedMapping && cfData) {
    // 1. Syllabus - Auto (always complete if subject exists)
    if (cfData.subject?.syllabus) completedCount++;
    // 2. Objectives - Auto
    if (cfData.subject?.syllabus?.objectives) completedCount++;
    // 3. CO-PO - Auto
    if (cfData.coPoMappings?.length > 0) completedCount++;
    // 4. Academic Calendar - Manual Upload
    if (academicCalendarPath) completedCount++;
    // 5. Lecture Plan & Text Books - Auto (Text books) & Manual (Lecture plan has rows)
    if (hasLecturePlan) completedCount++;
    // 6. Student List - Auto
    if (cfData.students?.length > 0) completedCount++;
    // 7. Timetable - Auto
    if (cfData.timetable?.length > 0) completedCount++;
    // 8. Teaching support - Manual
    if (teachingSupportText.trim().length > 10) completedCount++;
    // 9. Assignments - Manual
    if (assignmentQuestions.some(q => q.questions.some(qn => qn.trim().length > 2))) completedCount++;
    // 10. Mid 1 paper - Auto
    if (cfData.mid1Paper) completedCount++;
    // 11. Mid 1 scheme - Manual (Text or Path)
    if (mid1SchemePath || mid1SchemeText) completedCount++;
    // 12. Mid 1 marks - Auto
    if (cfData.mid1Marks?.length > 0) completedCount++;
    // 13. Slow learners - Auto
    completedCount++; // Dynamic calculation
    // 14. Remedial classes - Manual
    if (remedialClasses.length > 0) completedCount++;
    // 15. Mid 2 paper - Auto
    if (cfData.mid2Paper) completedCount++;
    // 16. Mid 2 scheme - Manual (Text or Path)
    if (mid2SchemePath || mid2SchemeText) completedCount++;
    // 17. Mid 2 marks - Auto
    if (cfData.mid2Marks?.length > 0) completedCount++;
    // 18. Slow learners progress - Auto
    completedCount++; // Dynamic calculation
    // 19. Mid marks CO mapping - Auto
    if (cfData.mid1Paper || cfData.mid2Paper) completedCount++;
    // 20. Sessional marks - Auto
    if (cfData.internalMarks?.length > 0) completedCount++;
    // 21. Previous papers - Manual
    if (prevPapersPaths.length > 0) completedCount++;
    // 22. Semester Results - Auto
    if (cfData.semesterResults?.length > 0) completedCount++;
    // 23. CO PO Attainment - Auto
    completedCount++; // Dynamic calculation
  }

  const completionPct = Math.round((completedCount / totalItems) * 100);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Toast alerts */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 text-white ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
            >
              <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
              <span className="font-medium text-sm">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back navigation header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedMapping ? (
              <button
                onClick={() => {
                  setSelectedMapping(null);
                  setCfData(null);
                }}
                className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FaArrowLeft className="h-4.5 w-4.5" /> Back to Subjects
              </button>
            ) : (
              <Link
                href="/faculty"
                className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FaArrowLeft className="h-4.5 w-4.5" /> Gateway
              </Link>
            )}
            <h1 className="text-2xl font-bold text-slate-800">Subject Course Files</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">Academic Year:</span>
            <select
              value={selectedAY}
              onChange={(e) => setSelectedAY(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              disabled={!!selectedMapping}
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Subject selector Grid */}
        {!selectedMapping ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayMappings.length === 0 ? (
              <div className="col-span-full rounded-xl bg-white border border-slate-200 p-8 text-center text-slate-500 font-medium">
                No subjects assigned to you for the selected Academic Year.
              </div>
            ) : (
              displayMappings.map((dm) => {
                const primaryMapping = mappings.find(m => m.id === dm.mappingIds[0]) || mappings[0];
                const sectionNames = dm.sections.map(s => s.name).join(", ");
                return (
                  <div
                    key={dm.key}
                    onClick={() => selectSubjectMapping(primaryMapping)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden hover:border-teal-400"
                  >
                    <div className="absolute top-0 right-0 h-16 w-16 bg-teal-50/50 rounded-bl-full flex items-center justify-center group-hover:bg-teal-50 transition-colors">
                      <FaBook className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {dm.subject.code}
                        </span>
                        {dm.batch && (
                          <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Batch: {dm.batch}
                          </span>
                        )}
                        {dm.sections.length > 1 && (
                          <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Shared Workspace
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg group-hover:text-teal-700 transition-colors pr-8">
                        {dm.subject.name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-2 font-medium">
                        Sections: {sectionNames} • Year {dm.subject.year}, Sem {dm.subject.semester}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-xs font-medium text-slate-400">
                        Click to manage Course File
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-teal-600">
                        Open Workspace →
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* WORKSPACE VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Progress & Checklist */}
            {!isSidebarCollapsed && (
              <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="font-bold text-slate-800 text-lg">{selectedMapping.subject.name}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {selectedMapping.batch ? `Batch ${selectedMapping.batch}` : `Section ${selectedMapping.section.name}`} ({selectedMapping.subject.code})
                    </p>
                    {selectedMapping.batch && (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                          Batch: {selectedMapping.batch}
                        </span>
                      </div>
                    )}
                    {cfData?.mappedSections && cfData.mappedSections.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                        <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 border border-teal-200">
                          Shared Workspace
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          for Sections: {cfData.mappedSections.map((s: any) => s.name).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1">
                    Faculty Workspace
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                  <div className="flex justify-between items-center text-sm font-semibold mb-2">
                    <span className="text-slate-600">Course File Checklist</span>
                    <span className="text-teal-600">{completedCount} / {totalItems} ({completionPct}%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Generate / Print trigger */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handlePrintClick}
                    className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 text-sm transition-colors shadow-sm cursor-pointer"
                  >
                    <FaFileAlt className="h-4 w-4" /> View Print Booklet
                  </button>

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex justify-center items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-sm transition-colors shadow-sm disabled:opacity-60"
                  >
                    {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>

                {/* Slow Learners Configuration */}
                <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                  <div className="flex items-center gap-2 text-orange-800 font-bold text-sm mb-3">
                    <FaGraduationCap className="h-4.5 w-4.5" />
                    Slow Learners Calculator Settings
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">Pass Threshold</label>
                      <select
                        value={thresholdType}
                        onChange={(e) => setThresholdType(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                      >
                        <option value="40">Below 40%</option>
                        <option value="50">Below 50%</option>
                        <option value="custom">Custom Score</option>
                      </select>
                    </div>
                    {thresholdType === "custom" && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-1">Percentage (1-100)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={customThreshold}
                          onChange={(e) => setCustomThreshold(Math.max(1, Math.min(100, parseInt(e.target.value) || 0)))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Checklist details list */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm max-h-[500px] overflow-y-auto">
                <h3 className="font-bold text-slate-800 text-sm mb-3 px-2 flex justify-between items-center">
                  <span>Checklist Index</span>
                  <span className="text-xs text-slate-400 font-medium">Auto = System Generated</span>
                </h3>
                <ul className="divide-y divide-slate-100 text-xs">
                  {/* 1 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">1. Syllabus</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 2 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">2. Course Objectives & Outcomes</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 3 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">3. CO-PO / PSO Mapping Table</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 4 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">4. Academic Calendar</span>
                    {academicCalendarPath ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Upload</span>
                    )}
                  </li>
                  {/* 5 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">5. Lecture Plan & Text Books</span>
                    {hasLecturePlan ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Completed</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Table</span>
                    )}
                  </li>
                  {/* 6 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">6. Student Roster Ranks</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 7 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">7. Mapped Class Timetable</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 8 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">8. Teaching Support Materials</span>
                    {teachingSupportText.trim().length > 10 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Completed</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Text</span>
                    )}
                  </li>
                  {/* 9 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">9. Assignment Questions (I-V)</span>
                    {assignmentQuestions.some(q => q.questions.some(qn => qn.trim().length > 2)) ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Completed</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Items</span>
                    )}
                  </li>
                  {/* 10 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">10. I Mid Question Paper</span>
                    {cfData?.mid1Paper ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">🛑 Paper Not Built</span>
                    )}
                  </li>
                  {/* 11 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">11. I Mid Scheme of Evaluation</span>
                    {mid1SchemeText ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">🟢 Text Added</span>
                    ) : mid1SchemePath ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing</span>
                    )}
                  </li>
                  {/* 12 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">12. I Mid Exam Marks List</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 13 */}
                  <li className="flex flex-col gap-1.5 py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-slate-600 font-medium">13. Dynamic Slow Learners List</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSlowLearnersModal(true)}
                          className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2 py-0.5 rounded font-semibold transition-colors"
                        >
                          View List
                        </button>
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 Auto Calculated</span>
                      </div>
                    </div>
                  </li>
                  {/* 14 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">14. Remedial Classes & Logs</span>
                    {remedialClasses.length > 0 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Logs Added</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Log</span>
                    )}
                  </li>
                  {/* 15 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">15. II Mid Question Paper</span>
                    {cfData?.mid2Paper ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">🛑 Paper Not Built</span>
                    )}
                  </li>
                  {/* 16 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">16. II Mid Scheme of Evaluation</span>
                    {mid2SchemeText ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">🟢 Text Added</span>
                    ) : mid2SchemePath ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing</span>
                    )}
                  </li>
                  {/* 17 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">17. II Mid Exam Marks List</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 18 */}
                  <li className="flex flex-col gap-1.5 py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <div className="flex justify-between items-center w-full">
                      <span className="text-slate-600 font-medium">18. Slow Learners Progress Status</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowProgressModal(true)}
                          className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2 py-0.5 rounded font-semibold transition-colors"
                        >
                          View List
                        </button>
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 Auto Calculated</span>
                      </div>
                    </div>
                  </li>
                  {/* 19 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">19. Mid Marks mappings with COs</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 20 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">20. Final Sessional Marks (OBE)</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                  </li>
                  {/* 21 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">21. Previous Question Papers</span>
                    {prevPapersPaths.length > 0 ? (
                      <span className="text-blue-600 font-semibold flex items-center gap-1">✅ {prevPapersPaths.length} Uploaded</span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1">⚠️ Missing Upload</span>
                    )}
                  </li>
                  {/* 22 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">22. Semester-End Results Summary</span>
                    {cfData?.semesterResults?.length > 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 System Auto</span>
                    ) : (
                      <span className="text-red-500 font-semibold flex items-center gap-1">🛑 Grades Not Posted</span>
                    )}
                  </li>
                  {/* 23 */}
                  <li className="flex justify-between items-center py-2.5 px-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-slate-600 font-medium">23. CO PO Attainment Attained Level</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">🟢 Auto Calculated</span>
                  </li>
                </ul>
              </div>
            </div>
            )}

            {/* Right Column: Dynamic Form Editors */}
            <div className={`${isSidebarCollapsed ? "lg:col-span-12" : "lg:col-span-7"} flex flex-col gap-6`}>
              {fetchingCf ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm flex flex-col justify-center items-center gap-4">
                  <FaSpinner className="h-8 w-8 text-teal-600 animate-spin" />
                  <p className="text-slate-500 font-semibold text-sm">Fetching workspace details from DB...</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-visible">
                  {/* Tabs header */}
                  <div className="sticky top-16 z-20 flex border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm flex-wrap items-center justify-between shadow-sm rounded-t-2xl">
                    <div className="flex flex-wrap flex-1">
                      <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="px-4 py-4 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 bg-slate-100/50 hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={isSidebarCollapsed ? "Show Sidebar & Checklist" : "Hide Sidebar & Expand Editor"}
                      >
                        {isSidebarCollapsed ? (
                          <>
                            <FaExpand className="h-3 w-3 text-teal-600 animate-pulse" />
                            <span className="text-teal-700 font-bold uppercase tracking-wider">Show Checklist</span>
                          </>
                        ) : (
                          <>
                            <FaCompress className="h-3 w-3 text-slate-500" />
                            <span className="text-slate-600 font-semibold uppercase tracking-wider">Maximize Editor</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveFormTab("lecture")}
                        className={`flex-1 min-w-[120px] py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "lecture" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                      >
                        Lecture Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormTab("assignments")}
                        className={`flex-1 min-w-[120px] py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "assignments" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                      >
                        Assignments
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormTab("remedial")}
                        className={`flex-1 min-w-[120px] py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "remedial" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                      >
                        Remedial Logs
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormTab("support")}
                        className={`flex-1 min-w-[120px] py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "support" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                      >
                        Support Materials
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormTab("schemes")}
                        className={`flex-1 min-w-[120px] py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "schemes" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                      >
                        Evaluation Schemes
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFormTab("uploads")}
                        className={`flex-1 min-w-[120px] py-4 text-xs sm:text-sm font-bold border-b-2 transition-all ${activeFormTab === "uploads" ? "border-teal-600 text-teal-700 bg-white" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                      >
                        File Uploads
                      </button>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 border-l border-slate-100 bg-slate-50/10 self-stretch flex-wrap">
                      <button
                        type="button"
                        onClick={handlePrintClick}
                        className="flex justify-center items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 text-xs transition-colors shadow-sm cursor-pointer"
                      >
                        <FaFileAlt className="h-3 w-3" /> Print Booklet
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex justify-center items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 text-xs transition-colors shadow-sm disabled:opacity-60"
                      >
                        {saving ? <FaSpinner className="h-3 w-3 animate-spin" /> : <FaSave className="h-3 w-3" />}
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Tab Contents */}
                  <div className="p-6">
                    {/* 1. LECTURE PLAN */}
                    {activeFormTab === "lecture" && (
                      <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-2">
                          <h4 className="font-bold text-slate-800 text-md">Unit-wise Lecture Plan Periods</h4>
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                            Total Subject Hours: {getGrandTotalHours()}
                          </span>
                        </div>

                        {lecturePlan.map((u, uIdx) => {
                          const unitHours = getUnitHours(u);
                          const syllabusUnits = cfData?.subject?.syllabus?.units;
                          const matchedSyllabusUnit = syllabusUnits && Array.isArray(syllabusUnits)
                            ? syllabusUnits.find(su => su.name && normalizeUnitName(su.name) === normalizeUnitName(u.unit))
                            : null;
                          const unitTopics = matchedSyllabusUnit && matchedSyllabusUnit.content
                            ? matchedSyllabusUnit.content.split(",").map((s: string) => s.replace(/<[^>]*>/g, "").trim()).filter(Boolean)
                            : [];
                          return (
                            <div key={u.unit} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col gap-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-800 text-sm">{u.unit} Configuration</span>
                                <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                  Unit Total: {unitHours} hours
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Unit Title</label>
                                  <input
                                    type="text"
                                    value={u.title}
                                    onChange={(e) => handleUnitTitleChange(uIdx, e.target.value)}
                                    placeholder="e.g. Thermodynamics, Electromagnetism"
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">References (Textbooks, Chapters, etc.)</label>
                                  <input
                                    type="text"
                                    value={u.references}
                                    onChange={(e) => handleUnitReferencesChange(uIdx, e.target.value)}
                                    placeholder="e.g. T1(Ch.19,20 & 21), T2(Ch.17,19 & 21)"
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-bold text-slate-500">Topics & Details</span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddTopic(uIdx)}
                                    className="flex items-center gap-1 text-[10px] font-semibold bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 px-2 py-1 rounded transition-colors cursor-pointer"
                                  >
                                    <FaPlus className="h-2 w-2" /> Add Topic
                                  </button>
                                </div>

                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                  <table className="min-w-full text-xs text-left text-slate-600">
                                    <thead className="bg-slate-50/50 text-slate-600 uppercase font-bold border-b border-slate-200">
                                      <tr>
                                        <th className="px-3 py-1.5 w-10">S.No</th>
                                        <th className="px-3 py-1.5 w-full">Topic Details / Syllabus covered</th>
                                        <th className="px-3 py-1.5 text-center w-24">No. of Hours</th>
                                        <th className="px-3 py-1.5 text-center w-12">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {u.topics.map((t, tIdx) => (
                                        <tr key={tIdx} className="hover:bg-slate-50/30">
                                          <td className="px-3 py-1 text-slate-400 font-semibold">{tIdx + 1}</td>
                                          <td className="px-3 py-1">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="text"
                                                value={t.topic}
                                                onChange={(e) => handleTopicChange(uIdx, tIdx, "topic", e.target.value)}
                                                placeholder="Enter topic details..."
                                                className="w-full border-b border-transparent hover:border-slate-200 focus:border-teal-500 py-1 bg-transparent text-xs font-semibold text-slate-700 outline-none"
                                              />
                                              {unitTopics.length > 0 && (
                                                <select
                                                  onChange={(e) => {
                                                    if (e.target.value) {
                                                      const currentVal = t.topic;
                                                      const newVal = currentVal ? `${currentVal}, ${e.target.value}` : e.target.value;
                                                      handleTopicChange(uIdx, tIdx, "topic", newVal);
                                                      e.target.value = ""; // Reset
                                                    }
                                                  }}
                                                  className="max-w-[120px] rounded border border-slate-200 bg-slate-50 text-[10px] text-slate-600 font-bold p-1 focus:outline-none cursor-pointer"
                                                >
                                                  <option value="">+ Add Topic</option>
                                                  {unitTopics.map((topicStr: string, idx: number) => (
                                                    <option key={idx} value={topicStr}>
                                                      {topicStr.length > 40 ? topicStr.slice(0, 40) + "..." : topicStr}
                                                    </option>
                                                  ))}
                                                </select>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-1 text-center">
                                            <input
                                              type="number"
                                              min="1"
                                              value={t.plannedPeriods}
                                              onChange={(e) => handleTopicChange(uIdx, tIdx, "plannedPeriods", e.target.value)}
                                              className="w-16 rounded border border-slate-200 text-center py-0.5 text-xs font-semibold text-slate-700 bg-white"
                                            />
                                          </td>
                                          <td className="px-3 py-1 text-center">
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveTopic(uIdx, tIdx)}
                                              className="text-red-500 hover:text-red-700 cursor-pointer"
                                            >
                                              <FaTrash className="h-3 w-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Tentative Completion Date Input */}
                        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <h5 className="font-bold text-slate-800 text-xs">Tentative Syllabus Completion Date</h5>
                            <p className="text-[10px] text-slate-400">Enter the planned syllabus completion date (e.g. 27.01.2024).</p>
                          </div>
                          <input
                            type="text"
                            value={tentativeCompletionDate}
                            onChange={(e) => setTentativeCompletionDate(e.target.value)}
                            placeholder="e.g. 27.01.2024"
                            className="w-48 rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>

                        {/* Save Button for Lecture Plan */}
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                          >
                            {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                            Save Lecture Plan
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 5. EVALUATION SCHEMES */}
                    {activeFormTab === "schemes" && (
                      <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-2">
                          <h4 className="font-bold text-slate-800 text-md">Mid Exam Schemes of Evaluation</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCloneModal(true);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3.5 py-2 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <FaFileAlt className="h-3.5 w-3.5" /> Clone Scheme of Evaluation
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                          <div className="flex flex-col gap-2">
                            <label className="font-bold text-slate-700 text-xs">MID-I Scheme of Evaluation Rubrics / Solutions</label>
                            <span className="text-[10px] text-slate-400 font-medium">Configure detailed question-wise step marks/rubrics or type free text.</span>
                            <StructuredSchemeEditor
                              examType="MID_I"
                              paper={cfData?.mid1Paper}
                              schemeText={mid1SchemeText}
                              onChange={setMid1SchemeText}
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <label className="font-bold text-slate-700 text-xs">MID-II Scheme of Evaluation Rubrics / Solutions</label>
                            <span className="text-[10px] text-slate-400 font-medium">Configure detailed question-wise step marks/rubrics or type free text.</span>
                            <StructuredSchemeEditor
                              examType="MID_II"
                              paper={cfData?.mid2Paper}
                              schemeText={mid2SchemeText}
                              onChange={setMid2SchemeText}
                            />
                          </div>
                        </div>

                        {/* Save Button for Evaluation Schemes */}
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                          >
                            {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                            Save Evaluation Schemes
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. ASSIGNMENT QUESTIONS */}
                    {activeFormTab === "assignments" && (
                      <div className="flex flex-col gap-6">
                        <h4 className="font-bold text-slate-800 text-md">Unit-wise Assignment Questions (Item 9)</h4>
                        {assignmentQuestions.map((unitQ, unitIdx) => (
                          <div key={unitQ.unit} className="border border-slate-200 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="font-bold text-slate-700 text-sm">{unitQ.unit} Assignment</h5>
                              <button
                                onClick={() => {
                                  const copy = [...assignmentQuestions];
                                  copy[unitIdx].questions.push("");
                                  setAssignmentQuestions(copy);
                                }}
                                className="text-xs text-teal-600 font-semibold hover:underline"
                              >
                                + Add Question
                              </button>
                            </div>
                            <div className="flex flex-col gap-2">
                              {unitQ.questions.map((qText, qIdx) => (
                                <div key={qIdx} className="flex gap-2 items-center">
                                  <span className="text-slate-400 font-medium text-xs w-6">Q{qIdx + 1}.</span>
                                  <input
                                    type="text"
                                    value={qText}
                                    onChange={(e) => {
                                      const copy = [...assignmentQuestions];
                                      copy[unitIdx].questions[qIdx] = e.target.value;
                                      setAssignmentQuestions(copy);
                                    }}
                                    className="flex-grow rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                    placeholder="Enter assignment question content..."
                                  />
                                  <button
                                    onClick={() => {
                                      const copy = [...assignmentQuestions];
                                      copy[unitIdx].questions.splice(qIdx, 1);
                                      setAssignmentQuestions(copy);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <FaTrash className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}

                        {/* Save Button for Assignments */}
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                          >
                            {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                            Save Assignments
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 3. REMEDIAL LOGS */}
                    {activeFormTab === "remedial" && (
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-slate-800 text-md">Remedial Classes for Slow Learners (Item 14)</h4>
                          <button
                            onClick={() => setRemedialClasses([...remedialClasses, { date: "", topics: "", studentRolls: [] }])}
                            className="flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 px-3 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors"
                          >
                            <FaPlus className="h-3 w-3" /> Add Remedial Log
                          </button>
                        </div>

                        {remedialClasses.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                            No remedial logs recorded yet. Add logs to record topics and student attendance.
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            {remedialClasses.map((item, idx) => (
                              <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 relative">
                                <button
                                  onClick={() => {
                                    const copy = [...remedialClasses];
                                    copy.splice(idx, 1);
                                    setRemedialClasses(copy);
                                  }}
                                  className="absolute top-4 right-4 text-red-500 hover:text-red-700"
                                >
                                  <FaTrash className="h-3.5 w-3.5" />
                                </button>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Date Conducted</label>
                                    <input
                                      type="date"
                                      value={item.date}
                                      onChange={(e) => {
                                        const copy = [...remedialClasses];
                                        copy[idx].date = e.target.value;
                                        setRemedialClasses(copy);
                                      }}
                                      className="rounded-lg border border-slate-300 p-2 text-xs w-full"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Topics Discussed</label>
                                    <input
                                      type="text"
                                      value={item.topics}
                                      onChange={(e) => {
                                        const copy = [...remedialClasses];
                                        copy[idx].topics = e.target.value;
                                        setRemedialClasses(copy);
                                      }}
                                      className="rounded-lg border border-slate-300 p-2 text-xs w-full font-medium"
                                      placeholder="e.g. Solving Mid 1 numerical questions"
                                    />
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                                    Attending Student Roll Numbers (Comma Separated)
                                  </label>
                                  <input
                                    type="text"
                                    value={item.studentRolls.join(", ")}
                                    onChange={(e) => {
                                      const copy = [...remedialClasses];
                                      copy[idx].studentRolls = e.target.value.split(",").map(r => r.trim()).filter(Boolean);
                                      setRemedialClasses(copy);
                                    }}
                                    className="rounded-lg border border-slate-300 p-2 text-xs w-full font-medium"
                                    placeholder="e.g. 23811A0501, 23811A0503"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Save Button for Remedial Logs */}
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                          >
                            {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                            Save Remedial Logs
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. SUPPORT MATERIALS */}
                    {activeFormTab === "support" && (
                      <div>
                        <h4 className="font-bold text-slate-800 text-md mb-4">Teaching Support Materials (Item 8)</h4>
                        <p className="text-xs text-slate-500 mb-3 font-medium">
                          Provide links (such as Google Drive, OneDrive) or descriptions of notes, slides, web links, or videos used.
                        </p>
                        <textarea
                          value={teachingSupportText}
                          onChange={(e) => setTeachingSupportText(e.target.value)}
                          className="w-full min-h-[250px] rounded-xl border border-slate-300 p-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Example:
- Unit 1 PowerPoint PDF: https://drive.google.com/open?id=xxxxxx
- Virtual Laboratory simulations link: https://vlab.co.in/
- Text book chapters PDF shared on MSTeams..."
                        />

                        {/* Save Button for Support Materials */}
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                          >
                            {saving ? <FaSpinner className="h-4 w-4 animate-spin" /> : <FaSave className="h-4 w-4" />}
                            Save Support Materials
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 5. UPLOADS */}
                    {activeFormTab === "uploads" && (
                      <div className="flex flex-col gap-6">
                        <h4 className="font-bold text-slate-800 text-md">Document File Uploads (PDF format only)</h4>

                        {/* Item 4: Academic Calendar */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">Academic Calendar</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload the current semester calendar.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "calendar" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "calendar")}
                                  disabled={uploadingFile === "calendar"}
                                />
                              </label>
                            </div>
                          </div>
                          {academicCalendarPath && (
                            <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-slate-700 shadow-sm">
                              <span className="text-emerald-700 flex items-center gap-1.5">
                                <FaCheckCircle className="h-4 w-4" /> Calendar attached!
                              </span>
                              <button
                                onClick={() => setAcademicCalendarPath("")}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Admin Configured Academic Calendar & Holidays */}
                          {cfData && ((cfData as any).timeline || ((cfData as any).holidays && (cfData as any).holidays.length > 0)) ? (
                            <div className="mt-4 bg-white rounded-lg border border-slate-200 p-4 text-xs text-slate-700 shadow-sm space-y-3">
                              <h6 className="font-bold text-slate-800 text-sm border-b pb-1.5 flex items-center justify-between">
                                <span>📅 Admin Configured Calendar</span>
                                <span className="text-[10px] text-slate-500 font-normal">Active Session: {(cfData as any).academicYear?.name} (B.Tech Year {selectedMapping?.subject?.year} Sem {selectedMapping?.subject?.semester})</span>
                              </h6>
                              {(cfData as any).timeline ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Classwork Period</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">
                                      {formatISTDate((cfData as any).timeline.classworkStart)} - {formatISTDate((cfData as any).timeline.classworkEnd)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">MID-I Exams</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">
                                      {formatISTDate((cfData as any).timeline.mid1Start)} - {formatISTDate((cfData as any).timeline.mid1End)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">MID-II Exams</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">
                                      {formatISTDate((cfData as any).timeline.mid2Start)} - {formatISTDate((cfData as any).timeline.mid2End)}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[9px]">Semester Exams</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">
                                      {formatISTDate((cfData as any).timeline.semExamStart)} - {formatISTDate((cfData as any).timeline.semExamEnd)}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-slate-500 italic">No academic timeline milestones defined for this Year & Semester.</div>
                              )}
                              
                              {(cfData as any).holidays && (cfData as any).holidays.length > 0 && (
                                <div className="border-t pt-2.5 mt-2">
                                  <span className="font-semibold text-slate-500 block mb-1">Declared Holidays:</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                                    {(cfData as any).holidays.map((h: any) => (
                                      <div key={h.id} className="bg-slate-50 p-1.5 rounded border border-slate-100 flex justify-between items-center text-[10px]">
                                        <span className="font-bold text-slate-700 truncate max-w-[130px]" title={h.name}>{h.name}</span>
                                        <span className="text-slate-500 font-semibold shrink-0">{formatISTDate(h.date)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 text-xs text-slate-400 italic">No administrative academic calendar or holidays configured for this session yet.</div>
                          )}
                        </div>

                        {/* Item 11: MID-I Scheme */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">MID-I Scheme of Evaluation</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload the evaluation answer key blueprint.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "mid1" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "mid1")}
                                  disabled={uploadingFile === "mid1"}
                                />
                              </label>
                            </div>
                          </div>
                          {mid1SchemePath && (
                            <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-slate-700 shadow-sm">
                              <span className="text-emerald-700 flex items-center gap-1.5">
                                <FaCheckCircle className="h-4 w-4" /> MID-I Scheme attached!
                              </span>
                              <button
                                onClick={() => setMid1SchemePath("")}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Item 16: MID-II Scheme */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">MID-II Scheme of Evaluation</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload the evaluation answer key blueprint.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "mid2" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "mid2")}
                                  disabled={uploadingFile === "mid2"}
                                />
                              </label>
                            </div>
                          </div>
                          {mid2SchemePath && (
                            <div className="mt-3 flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-slate-700 shadow-sm">
                              <span className="text-emerald-700 flex items-center gap-1.5">
                                <FaCheckCircle className="h-4 w-4" /> MID-II Scheme attached!
                              </span>
                              <button
                                onClick={() => setMid2SchemePath("")}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Item 21: Previous Question Papers */}
                        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-bold text-slate-700 text-sm">Previous Question Papers</h5>
                              <p className="text-xs text-slate-500 mt-1 font-medium">
                                Upload past years' semester question papers.
                              </p>
                            </div>
                            <div>
                              <label className="flex items-center gap-1 text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-sm">
                                <FaUpload className="h-3 w-3" />
                                {uploadingFile === "prev" ? "Uploading..." : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, "prev")}
                                  disabled={uploadingFile === "prev"}
                                />
                              </label>
                            </div>
                          </div>
                          {prevPapersPaths.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                              {prevPapersPaths.map((p, pIdx) => (
                                <div key={pIdx} className="flex justify-between items-center bg-white rounded-lg border border-slate-200 p-2 text-xs font-semibold text-slate-700 shadow-sm">
                                  <span className="text-blue-700">Question Paper #{pIdx + 1}</span>
                                  <button
                                    onClick={() => {
                                      const copy = [...prevPapersPaths];
                                      copy.splice(pIdx, 1);
                                      setPrevPapersPaths(copy);
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <FaTrash className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slow Learners Modal */}
      <AnimatePresence>
        {showSlowLearnersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowSlowLearnersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <FaGraduationCap className="text-orange-500 h-5 w-5" />
                    Slow Learners List (Mid-I)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Students who scored below {activeThreshold}% in Mid-I exam.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSlowLearnersModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                {slowLearners.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-semibold text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    No students match the criteria for slow learners under the current {activeThreshold}% threshold.
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                    <table className="min-w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Roll Number</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-center">Mid-I Score</th>
                          <th className="px-4 py-3 text-center">Percentage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {slowLearners.map((student: any) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{student.rollNumber}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{student.name}</td>
                            <td className="px-4 py-2.5 text-center font-semibold text-slate-600">{student.score} / {cfData?.mid1Paper?.totalMarks || 30}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-block bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                {student.pct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSlowLearnersModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slow Learners Progress Status Modal */}
      <AnimatePresence>
        {showProgressModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowProgressModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <FaGraduationCap className="text-emerald-500 h-5 w-5" />
                    Slow Learners Progress Status
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Students who were slow learners in Mid-I (&lt; {activeThreshold}%) but improved to &ge; {activeThreshold}% in Mid-II.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                {progressStudents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-semibold text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    No slow learners show progress status matching this threshold.
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                    <table className="min-w-full text-xs text-left text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Roll Number</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3 text-center">Mid-I %</th>
                          <th className="px-4 py-3 text-center">Mid-II %</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {progressStudents.map((student: any) => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5 font-bold text-slate-900">{student.rollNumber}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-700">{student.name}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600 font-semibold">{student.pct1}%</td>
                            <td className="px-4 py-2.5 text-center text-slate-600 font-semibold">{student.pct2}%</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                Improved
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowProgressModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Items Warning Modal */}
      <AnimatePresence>
        {showPendingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowPendingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="bg-red-50 border-b border-red-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-red-800 text-lg flex items-center gap-2">
                    <FaExclamationTriangle className="text-red-600 h-5 w-5 animate-pulse" />
                    Missing Course File Data
                  </h3>
                  <p className="text-xs text-red-700 mt-1 font-medium">
                    The following checklist items are pending or have no uploaded data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingModal(false)}
                  className="text-red-400 hover:text-red-600 rounded-lg p-1.5 hover:bg-red-100/50 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-grow">
                <p className="text-slate-600 text-xs font-semibold mb-4 leading-relaxed">
                  If you choose to continue printing, the booklet will render empty headings and blank template spaces for these pending items. This ensures the generated booklet is still print-ready.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[40vh] overflow-y-auto">
                  <span className="text-xs font-bold text-slate-500 block mb-2 uppercase tracking-wide">Pending Items ({getPendingItems().length}):</span>
                  <ul className="space-y-1.5">
                    {getPendingItems().map((item, idx) => (
                      <li key={idx} className="text-xs text-slate-700 font-semibold flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowPendingModal(false)}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Go Back & Complete
                </button>
                <button
                  type="button"
                  onClick={handleForcePrint}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm"
                >
                  Yes, Continue to Print
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clone Scheme of Evaluation Modal */}
      <AnimatePresence>
        {showCloneModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setShowCloneModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    <FaFileAlt className="text-blue-600 h-5 w-5" />
                    Clone Scheme of Evaluation
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Copy the evaluation scheme rubrics text from another course file.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Select Source Course File</label>
                  <select
                    value={cloneSourceMappingId}
                    onChange={(e) => setCloneSourceMappingId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Select subject / section...</option>
                    {mappings.filter(m => m.id !== selectedMapping?.id).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.subject.name} ({m.subject.code}) - Sec {m.section.name} [{m.academicYear.name}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-xs font-bold text-slate-500 block">Select Schemes to Clone</label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cloneMid1Text}
                        onChange={(e) => setCloneMid1Text(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      MID-I Scheme of Evaluation
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cloneMid2Text}
                        onChange={(e) => setCloneMid2Text(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      MID-II Scheme of Evaluation
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCloneScheme}
                  disabled={!cloneSourceMappingId || (!cloneMid1Text && !cloneMid2Text)}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Clone Selected
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
