"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaSave,
  FaPlus,
  FaTrash,
  FaSpinner,
  FaInfoCircle,
  FaArrowRight,
  FaBookOpen,
  FaEye,
  FaDownload,
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Syllabus {
  credits: { L: number; T: number; P: number; C: number };
  contactHours: number;
  totalMarks: number;
  prerequisites: string;
  objectives: string[];
  outcomes: { code: string; description: string }[];
  units: { name: string; title: string; mappedCOs: string[]; content: string }[];
  textbooks: string[];
  referenceBooks: string[];
}

const defaultSyllabus: Syllabus = {
  credits: { L: 3, T: 0, P: 0, C: 3 },
  contactHours: 42,
  totalMarks: 100,
  prerequisites: "",
  objectives: ["To introduce ..."],
  outcomes: [
    { code: "CO1", description: "Describe the core concepts of ..." },
    { code: "CO2", description: "Apply principles of ... to solve ..." },
    { code: "CO3", description: "Analyze the performance of ..." },
    { code: "CO4", description: "Design a solution for ..." },
    { code: "CO5", description: "Evaluate the outcome of ..." },
  ],
  units: [
    { name: "UNIT-I", title: "Introduction & Basic Concepts", mappedCOs: ["CO1"], content: "Topics include: ..." },
    { name: "UNIT-II", title: "Core Architecture", mappedCOs: ["CO2"], content: "Topics include: ..." },
    { name: "UNIT-III", title: "Advanced Methods", mappedCOs: ["CO3"], content: "Topics include: ..." },
    { name: "UNIT-IV", title: "Implementation & Tuning", mappedCOs: ["CO4"], content: "Topics include: ..." },
    { name: "UNIT-V", title: "Applications & Case Studies", mappedCOs: ["CO5"], content: "Topics include: ..." },
  ],
  textbooks: ["Author Name, 'Title of the Book', Edition, Publisher, Year."],
  referenceBooks: ["Author Name, 'Title of the Reference Book', Edition, Publisher, Year."],
};

function SyllabusConfigContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = searchParams ? searchParams.get("subjectId") : null;
  const { data: session } = useSession();

  const [subjectInfo, setSubjectInfo] = useState<{ name: string; code: string } | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus>(defaultSyllabus);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSavedOnce, setHasSavedOnce] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSyllabusData = useCallback(async () => {
    if (!subjectId) return;
    try {
      const res = await fetch(`/api/subjects/${subjectId}/syllabus`);
      if (res.ok) {
        const data = await res.json();
        setSubjectInfo({ name: data.name, code: data.code });
        if (data.syllabus) {
          // Merge loaded syllabus with default to prevent missing structure fields
          const merged = {
            ...defaultSyllabus,
            ...data.syllabus,
            credits: { ...defaultSyllabus.credits, ...(data.syllabus.credits || {}) },
          };
          setSyllabus(merged);
          setHasSavedOnce(true);
        } else {
          // Set template defaults
          setSyllabus(defaultSyllabus);
        }
      } else {
        showToast("Failed to load syllabus", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading subject syllabus data", "error");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    if (session) {
      loadSyllabusData();
    }
  }, [session, loadSyllabusData]);

  const handleCreditChange = (field: "L" | "T" | "P" | "C", val: string) => {
    const num = parseFloat(val) || 0;
    setSyllabus((prev) => ({
      ...prev,
      credits: {
        ...prev.credits,
        [field]: num,
      },
    }));
  };

  const handleMetadataChange = (field: "contactHours" | "totalMarks" | "prerequisites", val: string) => {
    setSyllabus((prev) => ({
      ...prev,
      [field]: field === "prerequisites" ? val : parseFloat(val) || 0,
    }));
  };

  // Objectives handlers
  const handleObjectiveChange = (index: number, val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.objectives];
      copy[index] = val;
      return { ...prev, objectives: copy };
    });
  };

  const addObjective = () => {
    setSyllabus((prev) => ({
      ...prev,
      objectives: [...prev.objectives, ""],
    }));
  };

  const removeObjective = (index: number) => {
    setSyllabus((prev) => {
      if (prev.objectives.length <= 1) {
        return { ...prev, objectives: [""] };
      }
      return { ...prev, objectives: prev.objectives.filter((_, i) => i !== index) };
    });
  };

  // Outcomes handlers
  const handleOutcomeChange = (index: number, field: "code" | "description", val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.outcomes];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, outcomes: copy };
    });
  };

  const addOutcome = () => {
    setSyllabus((prev) => {
      const nextCodeNum = prev.outcomes.length + 1;
      return {
        ...prev,
        outcomes: [...prev.outcomes, { code: `CO${nextCodeNum}`, description: "" }],
      };
    });
  };

  const removeOutcome = (index: number) => {
    setSyllabus((prev) => {
      if (prev.outcomes.length <= 1) {
        return { ...prev, outcomes: [{ code: "CO1", description: "" }] };
      }
      return { ...prev, outcomes: prev.outcomes.filter((_, i) => i !== index) };
    });
  };

  // Textbooks handlers
  const handleTextbookChange = (index: number, val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.textbooks];
      copy[index] = val;
      return { ...prev, textbooks: copy };
    });
  };

  const addTextbook = () => {
    setSyllabus((prev) => ({ ...prev, textbooks: [...prev.textbooks, ""] }));
  };

  const removeTextbook = (index: number) => {
    setSyllabus((prev) => {
      if (prev.textbooks.length <= 1) return { ...prev, textbooks: [""] };
      return { ...prev, textbooks: prev.textbooks.filter((_, i) => i !== index) };
    });
  };

  // Reference Books handlers
  const handleReferenceChange = (index: number, val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.referenceBooks];
      copy[index] = val;
      return { ...prev, referenceBooks: copy };
    });
  };

  const addReference = () => {
    setSyllabus((prev) => ({ ...prev, referenceBooks: [...prev.referenceBooks, ""] }));
  };

  const removeReference = (index: number) => {
    setSyllabus((prev) => {
      if (prev.referenceBooks.length <= 1) return { ...prev, referenceBooks: [""] };
      return { ...prev, referenceBooks: prev.referenceBooks.filter((_, i) => i !== index) };
    });
  };

  // Unit handlers
  const handleUnitChange = (index: number, field: "title" | "content", val: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.units];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, units: copy };
    });
  };

  const handleUnitCOToggle = (unitIdx: number, coCode: string) => {
    setSyllabus((prev) => {
      const copy = [...prev.units];
      const mapped = [...copy[unitIdx].mappedCOs];
      if (mapped.includes(coCode)) {
        copy[unitIdx].mappedCOs = mapped.filter((c) => c !== coCode);
      } else {
        copy[unitIdx].mappedCOs = [...mapped, coCode].sort();
      }
      return { ...prev, units: copy };
    });
  };

  const handleSave = async () => {
    // Validate Outcomes
    const invalidOutcomes = syllabus.outcomes.filter(o => !o.code.trim() || !o.description.trim());
    if (invalidOutcomes.length > 0) {
      showToast("All outcomes must have a valid CO code and description", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}/syllabus`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ syllabus }),
      });

      if (res.ok) {
        showToast("Syllabus configuration saved successfully!");
        setHasSavedOnce(true);
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to save syllabus", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error saving syllabus", "error");
    } finally {
      setSaving(false);
    }
  };

  const generateSyllabusPDF = async (mode: "preview" | "download") => {
    try {
      showToast(mode === "download" ? "Downloading syllabus PDF..." : "Preparing preview...", "success");
      
      let logoBase64: string | null = null;
      try {
        const logoRes = await fetch("/logo.png");
        const blob = await logoRes.blob();
        logoBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("Could not load logo", e);
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const margin = 15;
      
      // Header Banner & Logo
      if (logoBase64) {
        const getImageType = (base64: string) => {
          if (base64.startsWith("data:image/png")) return "PNG";
          if (base64.startsWith("data:image/webp")) return "WEBP";
          return "JPEG";
        };
        try {
          doc.addImage(logoBase64, getImageType(logoBase64), 15, 10, 20, 20);
        } catch (e) {
          console.warn("Failed to add logo to PDF");
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(AUTONOMOUS)", 38, 15, { align: "left" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Rushikonda, Visakhapatnam - 530045.", 38, 20, { align: "left" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("COURSE STRUCTURE & SYLLABUS CONFIGURATION SHEET", 38, 25, { align: "left" });

      let currentY = 32;
      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, 210 - margin, currentY);
      currentY += 6;

      // Subject Details Info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Subject Name: ", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(subjectInfo?.name || "N/A", margin + 28, currentY);

      doc.setFont("helvetica", "bold");
      doc.text("Subject Code: ", 210 - margin - 50, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(subjectInfo?.code || "N/A", 210 - margin - 22, currentY);
      currentY += 6;

      doc.line(margin, currentY, 210 - margin, currentY);
      currentY += 6;

      // Section 1: Teaching Methodology Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("1. Teaching Methodology & Credits Structure", margin, currentY);
      currentY += 4;

      const creditsHeaders = [["L", "T", "P", "C", "Contact Hours", "Total Marks"]];
      const creditsRows = [[
        syllabus.credits.L.toString(),
        syllabus.credits.T.toString(),
        syllabus.credits.P.toString(),
        syllabus.credits.C.toString(),
        syllabus.contactHours.toString(),
        syllabus.totalMarks.toString()
      ]];

      autoTable(doc, {
        head: creditsHeaders,
        body: creditsRows,
        startY: currentY,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          halign: "center",
          valign: "middle",
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          font: "helvetica",
          textColor: [40, 40, 40]
        },
        headStyles: {
          fillColor: [240, 243, 246],
          textColor: [30, 41, 59],
          fontSize: 8.5,
          fontStyle: "bold",
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        theme: "grid"
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;

      // Prerequisites
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Prerequisite(s):", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const prereqText = syllabus.prerequisites || "None";
      const prereqLines = doc.splitTextToSize(prereqText, 210 - margin * 2 - 30);
      doc.text(prereqLines, margin + 30, currentY);
      currentY += (prereqLines.length * 4.5) + 3;

      // Section 2: Course Objectives
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("2. Course Objectives", margin, currentY);
      currentY += 5;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      syllabus.objectives.forEach((obj, idx) => {
        const objText = `${idx + 1}. ${obj}`;
        const objLines = doc.splitTextToSize(objText, 210 - margin * 2);
        
        // Page break check
        if (currentY + (objLines.length * 4.5) > 280) {
          doc.addPage();
          currentY = 15;
        }
        
        doc.text(objLines, margin, currentY);
        currentY += (objLines.length * 4.5) + 1.5;
      });
      currentY += 3;

      // Section 3: Course Outcomes
      if (currentY > 260) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("3. Course Outcomes (COs)", margin, currentY);
      currentY += 4;

      const coHeaders = [["CO Code", "Outcome Description"]];
      const coRows = syllabus.outcomes.map(co => [co.code, co.description]);

      autoTable(doc, {
        head: coHeaders,
        body: coRows,
        startY: currentY,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8.5,
          cellPadding: 2,
          halign: "left",
          valign: "middle",
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          font: "helvetica",
          textColor: [40, 40, 40]
        },
        headStyles: {
          fillColor: [240, 243, 246],
          textColor: [30, 41, 59],
          fontSize: 8.5,
          fontStyle: "bold",
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        columnStyles: {
          0: { cellWidth: 20, halign: "center", fontStyle: "bold" }
        },
        theme: "grid"
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;

      // Section 4: Unit-wise Content
      if (currentY > 260) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("4. Unit-wise Content", margin, currentY);
      currentY += 5;

      syllabus.units.forEach((unit) => {
        // Prepare title and mapped COs text
        const unitTitleText = `${unit.name}: ${unit.title} (Mapped COs: ${unit.mappedCOs.join(", ")})`;
        const titleLines = doc.splitTextToSize(unitTitleText, 210 - margin * 2);
        
        const contentLines = doc.splitTextToSize(unit.content, 210 - margin * 2);
        const totalHeight = (titleLines.length * 4.5) + (contentLines.length * 4.5) + 6;

        if (currentY + totalHeight > 280) {
          doc.addPage();
          currentY = 15;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(titleLines, margin, currentY);
        currentY += (titleLines.length * 4.5) + 1.5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(contentLines, margin, currentY);
        currentY += (contentLines.length * 4.5) + 4;
      });

      // Section 5: Textbooks & Reference Books
      if (currentY > 250) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("5. Books & References", margin, currentY);
      currentY += 5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Textbooks:", margin, currentY);
      currentY += 4.5;
      
      doc.setFont("helvetica", "normal");
      syllabus.textbooks.forEach((tb, idx) => {
        const text = `${idx + 1}. ${tb}`;
        const lines = doc.splitTextToSize(text, 210 - margin * 2);
        if (currentY + (lines.length * 4.5) > 280) {
          doc.addPage();
          currentY = 15;
        }
        doc.text(lines, margin, currentY);
        currentY += (lines.length * 4.5) + 1.5;
      });
      currentY += 3;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      if (currentY > 275) {
        doc.addPage();
        currentY = 15;
      }
      doc.text("Reference Books:", margin, currentY);
      currentY += 4.5;

      doc.setFont("helvetica", "normal");
      syllabus.referenceBooks.forEach((ref, idx) => {
        const text = `${idx + 1}. ${ref}`;
        const lines = doc.splitTextToSize(text, 210 - margin * 2);
        if (currentY + (lines.length * 4.5) > 280) {
          doc.addPage();
          currentY = 15;
        }
        doc.text(lines, margin, currentY);
        currentY += (lines.length * 4.5) + 1.5;
      });

      const filename = `Syllabus_${subjectInfo?.code || "Subject"}.pdf`;
      if (mode === "download") {
        doc.save(filename);
        showToast("Syllabus PDF downloaded successfully!", "success");
      } else {
        const pdfBlob = doc.output("blob");
        const blobUrl = URL.createObjectURL(pdfBlob);
        window.open(blobUrl, "_blank");
        showToast("Preview loaded in new tab!", "success");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to generate PDF", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoSpinner fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                <FaArrowLeft /> Back
              </button>
              <div>
                <h1 className="font-bold text-slate-900">Syllabus Configuration</h1>
                <p className="text-xs text-slate-500">
                  {subjectInfo?.name} ({subjectInfo?.code})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => generateSyllabusPDF("preview")}
                className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-200 transition-all cursor-pointer"
              >
                <FaEye /> Preview
              </button>

              <button
                onClick={() => generateSyllabusPDF("download")}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-900 transition-all cursor-pointer"
              >
                <FaDownload /> Download
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                Save Syllabus
              </button>

              <button
                onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${subjectId}`)}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${
                  hasSavedOnce
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 ring-2 ring-emerald-200 animate-pulse cursor-pointer"
                    : "bg-slate-200 text-slate-600 cursor-not-allowed hover:bg-slate-300"
                }`}
              >
                Go to CO-PO Mappings <FaArrowRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Info Guide */}
        <div className="mb-6 flex gap-3 rounded-2xl bg-blue-50 p-4 ring-1 ring-blue-100 shadow-sm">
          <FaInfoCircle className="mt-0.5 text-blue-500 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">LibreOffice Syllabus Layout Editor</p>
            <p className="mt-1">
              Configure the subject syllabus structure below. The list of Course Outcomes (COs) defined here will dynamically populate the question paper mapping forms and the CO-PO correlation matrices.
            </p>
          </div>
        </div>

        {/* The Document Sheet */}
        <div className="rounded-xl border border-slate-300 bg-white p-8 shadow-lg md:p-12">
          {/* Autonomous Document Header Mock */}
          <div className="mb-8 border-b-2 border-double border-slate-400 pb-6 text-center">
            <h2 className="text-lg font-bold tracking-wide text-slate-900 uppercase">
              GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              Rushikonda, Visakhapatnam - 530045.
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800 uppercase">
              Course Structure & Syllabus Configuration Sheet
            </p>
          </div>

          <div className="space-y-8">
            {/* 1. Methodology Credits Grid */}
            <div>
              <h3 className="mb-3 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Teaching Methodology & Credits Structure
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-300">
                <table className="w-full min-w-[500px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300">
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">L</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">T</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">P</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-center w-20">C</th>
                      <th className="px-4 py-2 border-r border-slate-300 text-left">Contact Hours</th>
                      <th className="px-4 py-2 text-left">Total Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.L}
                          onChange={(e) => handleCreditChange("L", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.T}
                          onChange={(e) => handleCreditChange("T", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.P}
                          onChange={(e) => handleCreditChange("P", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.credits.C}
                          onChange={(e) => handleCreditChange("C", e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-center font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <input
                          type="number"
                          value={syllabus.contactHours}
                          onChange={(e) => handleMetadataChange("contactHours", e.target.value)}
                          className="w-full rounded border border-slate-200 px-3 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={syllabus.totalMarks}
                          onChange={(e) => handleMetadataChange("totalMarks", e.target.value)}
                          className="w-full rounded border border-slate-200 px-3 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Prerequisites */}
            <div>
              <h3 className="mb-2 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                Prerequisite(s)
              </h3>
              <input
                type="text"
                value={syllabus.prerequisites}
                onChange={(e) => handleMetadataChange("prerequisites", e.target.value)}
                placeholder="e.g. Basic Mathematics, Programming Concepts in C"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 2. Course Objectives */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2. Course Objectives
                </h3>
                <button
                  type="button"
                  onClick={addObjective}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FaPlus size={10} /> Add Objective
                </button>
              </div>
              <div className="space-y-2">
                {syllabus.objectives.map((obj, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-slate-400 w-6">{index + 1}.</span>
                    <input
                      type="text"
                      value={obj}
                      onChange={(e) => handleObjectiveChange(index, e.target.value)}
                      placeholder={`Enter Course Objective ${index + 1}`}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeObjective(index)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Course Outcomes */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                  3. Course Outcomes (COs)
                </h3>
                <button
                  type="button"
                  onClick={addOutcome}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <FaPlus size={10} /> Add Outcome
                </button>
              </div>
              <div className="space-y-3">
                {syllabus.outcomes.map((co, index) => (
                  <div key={index} className="flex gap-3 items-start border border-slate-100 rounded-lg p-2 hover:bg-slate-50/50 transition-colors">
                    <div className="w-20">
                      <span className="text-xs font-bold text-slate-500 block mb-1">Code</span>
                      <input
                        type="text"
                        value={co.code}
                        onChange={(e) => handleOutcomeChange(index, "code", e.target.value)}
                        placeholder="CO1"
                        className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-500 block mb-1">Outcome Description</span>
                      <textarea
                        rows={2}
                        value={co.description}
                        onChange={(e) => handleOutcomeChange(index, "description", e.target.value)}
                        placeholder={`At the end of the course, student will be able to ...`}
                        className="w-full rounded border border-slate-200 px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOutcome(index)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1 mt-6"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Units Details */}
            <div>
              <h3 className="mb-3 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                4. Unit-wise Content
              </h3>
              <div className="space-y-6">
                {syllabus.units.map((unit, index) => (
                  <div key={index} className="border border-slate-300 rounded-lg p-4 bg-slate-50/30">
                    <div className="mb-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Unit Number</label>
                        <input
                          type="text"
                          value={unit.name}
                          readOnly
                          className="w-full rounded border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 block mb-1">Unit Title</label>
                        <input
                          type="text"
                          value={unit.title}
                          onChange={(e) => handleUnitChange(index, "title", e.target.value)}
                          placeholder="e.g. Introduction to Algorithms"
                          className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Mapped COs checkboxes */}
                    <div className="mb-3">
                      <label className="text-xs font-bold text-slate-500 block mb-1">Mapped Course Outcomes</label>
                      <div className="flex flex-wrap gap-2">
                        {syllabus.outcomes.map((co) => (
                          <button
                            key={co.code}
                            type="button"
                            onClick={() => handleUnitCOToggle(index, co.code)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                              unit.mappedCOs.includes(co.code)
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {co.code}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Unit Content / Topics</label>
                      <textarea
                        rows={4}
                        value={unit.content}
                        onChange={(e) => handleUnitChange(index, "content", e.target.value)}
                        placeholder="Detail the chapters, topics, sections and lab contents if any..."
                        className="w-full rounded border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Textbooks & Reference Books */}
            <div>
              <h3 className="mb-4 border-l-4 border-slate-700 pl-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                5. Books & References
              </h3>

              {/* Textbooks */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Textbooks</h4>
                  <button
                    type="button"
                    onClick={addTextbook}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <FaPlus size={10} /> Add Textbook
                  </button>
                </div>
                <div className="space-y-2">
                  {syllabus.textbooks.map((tb, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <span className="text-xs font-bold text-slate-400 w-6">{index + 1}.</span>
                      <input
                        type="text"
                        value={tb}
                        onChange={(e) => handleTextbookChange(index, e.target.value)}
                        placeholder="Author, 'Book Title', Publisher, Edition, Year"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeTextbook(index)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reference Books */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Reference Books</h4>
                  <button
                    type="button"
                    onClick={addReference}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <FaPlus size={10} /> Add Reference Book
                  </button>
                </div>
                <div className="space-y-2">
                  {syllabus.referenceBooks.map((refB, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <span className="text-xs font-bold text-slate-400 w-6">{index + 1}.</span>
                      <input
                        type="text"
                        value={refB}
                        onChange={(e) => handleReferenceChange(index, e.target.value)}
                        placeholder="Author, 'Book Title', Publisher, Edition, Year"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeReference(index)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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

export default function SyllabusConfigPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LogoSpinner fullScreen={false} />
        </div>
      }
    >
      <SyllabusConfigContent />
    </Suspense>
  );
}
