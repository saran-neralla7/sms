"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSlidersH, FaFilePdf, FaCheckCircle, FaLock, FaUnlock, FaSpinner,
  FaPlus, FaTrash, FaPen, FaClipboardList, FaDownload, FaEye, FaLayerGroup, FaCalendarAlt, FaFileAlt,
  FaFileExcel, FaPaperPlane, FaFlask
} from "react-icons/fa";
import Modal from "@/components/Modal";
import LogoSpinner from "@/components/LogoSpinner";
import * as XLSX from "xlsx";

// jsPDF imports for report generation
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from "recharts";

interface Scheme {
  id: string;
  name: string;
  subjectType: string;
  mid1MaxMarks: number;
  mid2MaxMarks: number;
  mid1ScaledTo: number;
  mid2ScaledTo: number;
  assignmentMax: number;
  internalMax: number;
  isDefault: boolean;
}

interface Paper {
  id: string;
  examType: string;
  totalMarks: number;
  isFrozen: boolean;
  subjectId: string;
  sectionId: string;
  subject: { id: string; name: string; code: string; type: string; department?: { code: string } };
  section: { id: string; name: string };
  academicYear: { name: string };
  publishRecord: { isLocked: boolean; isPublished: boolean } | null;
  facultyName?: string;
}

export default function AdminMidExamDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Active Admin Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "schemes" | "publish" | "reports" | "co-po-mapping" | "analysis">("dashboard");

  useEffect(() => {
    const savedTab = sessionStorage.getItem("admin_mid_exam_active_tab");
    if (savedTab && ["dashboard", "schemes", "publish", "reports", "co-po-mapping", "analysis"].includes(savedTab)) {
      setActiveTab(savedTab as any);
    }
  }, []);

  // Sync scrollbar refs & state
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  const handleTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      if (tableScrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
        tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      }
    }
  };

  const handleTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      if (topScrollRef.current.scrollLeft !== tableScrollRef.current.scrollLeft) {
        topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
      }
    }
  };

  // Report preview states
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewType, setPreviewType] = useState<"MID_I" | "MID_II" | "ASSIGNMENT" | "FINAL" | "SUBJECT" | null>(null);
  const [previewSubjectId, setPreviewSubjectId] = useState<string>("");
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [fetchingReport, setFetchingReport] = useState<boolean>(false);
  const [showAttendance, setShowAttendance] = useState<boolean>(false);
  const [fetchingAttendance, setFetchingAttendance] = useState<boolean>(false);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, number>>({});
  const [showLabMarks, setShowLabMarks] = useState<boolean>(false);

  const getSubjectStats = (subId: string, subType: string) => {
    if (!previewData || !previewData.rows) {
      return { average: "0.0", countAbove: 0, countBetween: 0, countBelow: 0, countZero: 0, countAbsent: 0 };
    }
    
    let sum = 0;
    let count = 0;
    let countAbove = 0;
    let countBetween = 0;
    let countBelow = 0;
    let countZero = 0;
    let countAbsent = 0;

    const isLab = subType?.toUpperCase() === "LAB";
    let maxMarks = 30;
    if (previewType === "ASSIGNMENT") {
      maxMarks = 10;
    } else if (previewType === "FINAL" && isLab) {
      maxMarks = 50;
    } else if (previewType === "MID_I" && isLab) {
      maxMarks = 50;
    } else if (previewType === "MID_II" && isLab) {
      maxMarks = 50;
    }

    previewData.rows.forEach((row: any) => {
      const marksObj = row.subjects[subId] || { mid1: null, mid2: null, assignment: null, internal: 0 };
      let val: number | null = null;
      if (previewType === "MID_I") {
        val = marksObj.mid1;
      } else if (previewType === "MID_II") {
        val = marksObj.mid2;
      } else if (previewType === "ASSIGNMENT") {
        val = marksObj.assignment;
      } else if (previewType === "FINAL") {
        val = marksObj.internal;
      }

      if (val === null || val === undefined) {
        countAbsent++;
      } else {
        const numVal = Math.round(val);
        sum += numVal;
        count++;

        if (numVal === 0) {
          countZero++;
        }

        const pct = (numVal / maxMarks) * 100;
        if (pct >= 60) {
          countAbove++;
        } else if (pct >= 40) {
          countBetween++;
        } else {
          countBelow++;
        }
      }
    });

    const average = count > 0 ? (sum / count).toFixed(1) : "#DIV/0!";
    return {
      average,
      countAbove,
      countBetween,
      countBelow,
      countZero,
      countAbsent
    };
  };

  const getAttendanceStats = () => {
    if (!previewData || !previewData.rows) {
      return { count75Plus: 0, count65To74: 0, count50To64: 0, countBelow50: 0, countZero: 0, totalCalculated: 0 };
    }
    
    let count75Plus = 0;
    let count65To74 = 0;
    let count50To64 = 0;
    let countBelow50 = 0;
    let countZero = 0;

    previewData.rows.forEach((row: any) => {
      const pct = attendanceMap[row.studentId];
      if (pct === undefined) return;
      if (pct > 75) count75Plus++;
      else if (pct >= 65) count65To74++;
      else if (pct >= 50) count50To64++;
      else if (pct > 0) countBelow50++;
      else countZero++;
    });

    const totalCalculated = count75Plus + count65To74 + count50To64 + countBelow50 + countZero;

    return {
      count75Plus,
      count65To74,
      count50To64,
      countBelow50,
      countZero,
      totalCalculated
    };
  };

  // Keep top scroll width in sync with data table container
  useEffect(() => {
    const updateWidth = () => {
      if (tableScrollRef.current) {
        setTableWidth(tableScrollRef.current.scrollWidth);
      }
    };

    updateWidth();

    // Small delay to ensure table layout is stable
    const timer = setTimeout(updateWidth, 150);

    let observer: ResizeObserver | null = null;
    if (tableScrollRef.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(tableScrollRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [previewData, previewType]);

  // Filters
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedAY, setSelectedAY] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("1");
  const [selectedSem, setSelectedSem] = useState("1");
  const [selectedSection, setSelectedSection] = useState("");

  const isRestored = useRef(false);

  // Save filters to sessionStorage
  useEffect(() => {
    if (isRestored.current && selectedAY) {
      sessionStorage.setItem("mid_exam_filter_ay", selectedAY);
    }
  }, [selectedAY]);

  useEffect(() => {
    if (isRestored.current && selectedDept) {
      sessionStorage.setItem("mid_exam_filter_dept", selectedDept);
    }
  }, [selectedDept]);

  useEffect(() => {
    if (isRestored.current && selectedYear) {
      sessionStorage.setItem("mid_exam_filter_year", selectedYear);
    }
  }, [selectedYear]);

  useEffect(() => {
    if (isRestored.current && selectedSem) {
      sessionStorage.setItem("mid_exam_filter_sem", selectedSem);
    }
  }, [selectedSem]);

  useEffect(() => {
    if (isRestored.current && selectedSection) {
      sessionStorage.setItem("mid_exam_filter_section", selectedSection);
    }
  }, [selectedSection]);

  useEffect(() => {
    sessionStorage.setItem("admin_mid_exam_active_tab", activeTab);
  }, [activeTab]);

  // Analysis states
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [fetchingAnalysis, setFetchingAnalysis] = useState(false);
  const [selectedAnalysisExamType, setSelectedAnalysisExamType] = useState<"MID_I" | "MID_II">("MID_I");

  useEffect(() => {
    setPreviewData(null);
    setPreviewType(null);
    setShowAttendance(false);
    setAttendanceMap({});
    setShowLabMarks(false);
    setAnalysisData(null);
  }, [selectedAY, selectedDept, selectedYear, selectedSem, selectedSection, selectedAnalysisExamType]);

  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [pendingPapers, setPendingPapers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);

  // Client-side filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("ALL");

  const filteredPapers = papers.filter(p => {
    if (selectedExamType !== "ALL" && p.examType !== selectedExamType) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const subjectName = p.subject.name.toLowerCase();
      const subjectCode = p.subject.code.toLowerCase();
      const facultyName = (p.facultyName || "").toLowerCase();
      if (!subjectName.includes(q) && !subjectCode.includes(q) && !facultyName.includes(q)) return false;
    }
    return true;
  });

  const filteredPendingPapers = pendingPapers.filter(pp => {
    if (selectedExamType !== "ALL" && pp.examType !== selectedExamType) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const subjectName = pp.subject.name.toLowerCase();
      const subjectCode = pp.subject.code.toLowerCase();
      const facultyName = (pp.facultyName || "").toLowerCase();
      if (!subjectName.includes(q) && !subjectCode.includes(q) && !facultyName.includes(q)) return false;
    }
    return true;
  });

  // Scheme Modal Form
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [schemeForm, setSchemeForm] = useState({
    id: "",
    name: "",
    subjectType: "THEORY",
    mid1MaxMarks: 30,
    mid2MaxMarks: 30,
    mid1ScaledTo: 20,
    mid2ScaledTo: 20,
    assignmentMax: 10,
    internalMax: 30,
    isDefault: false
  });
  const [savingScheme, setSavingScheme] = useState(false);

  const [selectedReportSubjectId, setSelectedReportSubjectId] = useState("");
  const [consolidatedSection, setConsolidatedSection] = useState("ALL");
  const [reportSubjects, setReportSubjects] = useState<any[]>([]);

  useEffect(() => {
    if (selectedDept && selectedYear && selectedSem) {
      fetch(`/api/subjects?departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}`)
        .then(r => r.json())
        .then(data => {
          setReportSubjects(data || []);
          if (data && data.length > 0) {
            setSelectedReportSubjectId(data[0].id);
          } else {
            setSelectedReportSubjectId("");
          }
        })
        .catch(err => console.error("Error fetching subjects for reports:", err));
    }
  }, [selectedDept, selectedYear, selectedSem]);

  // Lock/Publish Actions Loader
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Publish Confirmation Modals & SMS states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedPaperForPublish, setSelectedPaperForPublish] = useState<any>(null);

  const [smsExamType, setSmsExamType] = useState<"MID_I" | "MID_II">("MID_I");
  const [sendingSMS, setSendingSMS] = useState(false);

  // Send SMS Modal states
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [smsStudents, setSmsStudents] = useState<any[]>([]);
  const [smsSearchQuery, setSmsSearchQuery] = useState("");
  const [selectedSmsStudentIds, setSelectedSmsStudentIds] = useState<Set<string>>(new Set());
  const [loadingSmsStudents, setLoadingSmsStudents] = useState(false);
  const [smsUnpublishedSubjects, setSmsUnpublishedSubjects] = useState<any[]>([]);
  const [allowUnpublishedOverride, setAllowUnpublishedOverride] = useState(false);

  const executePublish = async () => {
    if (!selectedPaperForPublish) return;
    const paperId = selectedPaperForPublish.id;
    setShowPublishModal(false);
    
    setActionLoading(prev => ({ ...prev, [paperId]: true }));
    try {
      const res = await fetch("/api/mid-exam/marks/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId,
          action: "publish"
        })
      });
      if (res.ok) {
        showToast("Marks published successfully!", "success");
        await loadPapers();
      } else {
        const data = await res.json();
        showToast(data.error || "Action failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [paperId]: false }));
    }
  };

  const handleSendMarksSMS = async () => {
    if (!selectedSection) {
      showToast("Please select a specific section to send SMS.", "error");
      return;
    }

    // 1. Client-side check if all theory subjects are published
    const classTheorySubjects = reportSubjects.filter(s => s.type?.toUpperCase() !== "LAB");
    if (classTheorySubjects.length === 0) {
      showToast("No theory subjects found for this class.", "error");
      return;
    }

    const unpublished = classTheorySubjects.filter(sub => {
      const paper = papers.find(p => p.subjectId === sub.id && p.examType === smsExamType && p.sectionId === selectedSection);
      return !paper || !paper.publishRecord?.isPublished;
    });

    setSmsUnpublishedSubjects(unpublished);
    setAllowUnpublishedOverride(false);
    setSmsSearchQuery("");
    setShowSMSModal(true);
    setLoadingSmsStudents(true);
    setSmsStudents([]);
    setSelectedSmsStudentIds(new Set());

    try {
      const res = await fetch(`/api/students?departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}&limit=-1`);
      const data = await res.json();
      if (res.ok && data.data) {
        setSmsStudents(data.data);
        setSelectedSmsStudentIds(new Set(data.data.map((s: any) => s.id)));
      } else {
        showToast(data.error || "Failed to fetch student details.", "error");
      }
    } catch (err) {
      showToast("Error fetching student details.", "error");
    } finally {
      setLoadingSmsStudents(false);
    }
  };

  const executeSendSMS = async () => {
    if (selectedSmsStudentIds.size === 0) {
      showToast("Please select at least one student.", "error");
      return;
    }

    if (smsUnpublishedSubjects.length > 0 && !allowUnpublishedOverride) {
      showToast("Please confirm that you want to proceed with unpublished subjects.", "error");
      return;
    }

    setSendingSMS(true);
    try {
      const res = await fetch("/api/mid-exam/marks/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedAY,
          departmentId: selectedDept,
          year: selectedYear,
          semester: selectedSem,
          sectionId: selectedSection,
          examType: smsExamType,
          studentIds: Array.from(selectedSmsStudentIds),
          allowUnpublished: allowUnpublishedOverride
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "SMS dispatch started in background.", "success");
        setShowSMSModal(false);
      } else {
        showToast(data.error || "Failed to send SMS.", "error");
      }
    } catch (e) {
      showToast("Network error occurred.", "error");
    } finally {
      setSendingSMS(false);
    }
  };

  // Load Filters & initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/academic-years").then(r => r.json()),
      fetch("/api/departments").then(r => r.json()),
      fetch("/api/mid-exam/scheme").then(r => r.json())
    ]).then(([ay, dept, sch]) => {
      setAcademicYears(ay);
      setDepartments(dept);
      setSchemes(sch);

      const savedAY = sessionStorage.getItem("mid_exam_filter_ay");
      const currentAY = savedAY && ay.some((y: any) => y.id === savedAY)
        ? savedAY
        : (ay.find((y: any) => y.isCurrent)?.id || ay[0]?.id || "");
      setSelectedAY(currentAY);

      const savedDept = sessionStorage.getItem("mid_exam_filter_dept");
      const defaultDept = savedDept && dept.some((d: any) => d.id === savedDept)
        ? savedDept
        : (dept[0]?.id || "");
      setSelectedDept(defaultDept);

      const savedYear = sessionStorage.getItem("mid_exam_filter_year");
      if (savedYear) setSelectedYear(savedYear);

      const savedSem = sessionStorage.getItem("mid_exam_filter_sem");
      if (savedSem) setSelectedSem(savedSem);

      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedDept) {
      fetch(`/api/sections?departmentId=${selectedDept}`)
        .then(res => res.json())
        .then(data => {
          setSections(data);
          const savedSection = sessionStorage.getItem("mid_exam_filter_section");
          if (savedSection && data.some((s: any) => s.id === savedSection)) {
            setSelectedSection(savedSection);
          } else {
            setSelectedSection(data[0]?.id || "");
          }
          // Enable sessionStorage updates only after initial filters are fully restored
          setTimeout(() => {
            isRestored.current = true;
          }, 100);
        })
        .catch(err => console.error(err));
    } else {
      setSections([]);
      setSelectedSection("");
      isRestored.current = true;
    }
  }, [selectedDept]);

  const loadPapers = useCallback(async () => {
    if (!selectedAY) return;
    setLoading(true);
    try {
      const sectionQuery = selectedSection ? `&sectionId=${selectedSection}` : "";
      const [papersRes, pendingRes] = await Promise.all([
        fetch(`/api/mid-exam/papers?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}${sectionQuery}`),
        fetch(`/api/mid-exam/papers/pending?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}${sectionQuery}`)
      ]);
      if (papersRes.ok) {
        setPapers(await papersRes.json());
      }
      if (pendingRes.ok) {
        setPendingPapers(await pendingRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAY, selectedDept, selectedYear, selectedSem, selectedSection]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  const fetchAnalysis = useCallback(async () => {
    if (!selectedSection) {
      showToast("Select a Section to view analysis", "error");
      return;
    }
    setFetchingAnalysis(true);
    try {
      const res = await fetch(
        `/api/mid-exam/analysis?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}&examType=${selectedAnalysisExamType}`
      );
      if (!res.ok) {
        showToast("Failed to fetch analysis data", "error");
        return;
      }
      const data = await res.json();
      setAnalysisData(data);
    } catch (e) {
      console.error(e);
      showToast("Error loading analysis data", "error");
    } finally {
      setFetchingAnalysis(false);
    }
  }, [selectedAY, selectedDept, selectedYear, selectedSem, selectedSection, selectedAnalysisExamType]);

  useEffect(() => {
    if (activeTab === "analysis" && selectedSection) {
      fetchAnalysis();
    }
  }, [activeTab, selectedSection, selectedAnalysisExamType, fetchAnalysis]);

  const downloadAnalysisExcel = () => {
    if (!analysisData) return;
    const { metadata, subjectAnalysis, performance, matrix } = analysisData;

    const wb = XLSX.utils.book_new();

    const ws1Data = [
      ["MID EXAM ANALYSIS REPORT"],
      [`Academic Year: ${metadata.academicYear} | Department: ${metadata.department} | Year: ${metadata.year} | Sem: ${metadata.semester} | Section: ${metadata.section}`],
      [`Exam: ${metadata.examType === "MID_I" ? "MID - I" : "MID - II"}`],
      [],
      ["S.No", "Subject Code", "Subject Name", "Class Strength", "Absentees", "Average Marks", "Gap", "Difficulty Index (%)", "Insight", "Remarks"]
    ];

    subjectAnalysis.forEach((sub: any) => {
      ws1Data.push([
        sub.sNo,
        sub.subjectCode,
        sub.subjectName,
        sub.classStrength,
        sub.absentees,
        sub.averageMarks,
        sub.gap,
        sub.difficultyIndex,
        sub.insight,
        sub.remarks
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    XLSX.utils.book_append_sheet(wb, ws1, "Subject Analysis");

    const ws2Data = [
      ["STUDENT COUNTS BY PERFORMANCE LEVELS"],
      [`Academic Year: ${metadata.academicYear} | Department: ${metadata.department} | Section: ${metadata.section}`],
      [],
      ["Performance Level", "High Attendance (>=75%)", "Medium Attendance (65%-74.9%)", "Low Attendance (<65%)", "Total"]
    ];

    performance.forEach((perf: any) => {
      ws2Data.push([
        perf.level,
        perf.high,
        perf.medium,
        perf.low,
        perf.total
      ]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, "Performance Levels");

    const ws3Data = [
      ["CORRELATION MATRIX (ATTENDANCE VS MARKS)"],
      [`Academic Year: ${metadata.academicYear} | Department: ${metadata.department} | Section: ${metadata.section}`],
      [],
      ["Attendance Range", "High Marks (>=18)", "Medium Marks (12-17.9)", "Low Marks (<12)", "Total Students", "Percentage (%)"]
    ];

    matrix.forEach((row: any) => {
      ws3Data.push([
        row.range,
        row.high,
        row.medium,
        row.low,
        row.total,
        row.percentage
      ]);
    });

    const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
    XLSX.utils.book_append_sheet(wb, ws3, "Correlation Matrix");

    XLSX.writeFile(wb, `Mid_Exam_Analysis_${metadata.departmentCode}_Sem${metadata.semester}_Sec_${metadata.section}_${metadata.examType}.xlsx`);
  };

  const generateAnalysisPDF = async (cachedData: any) => {
    if (!cachedData) return;
    const { metadata, subjectAnalysis, performance, matrix } = cachedData;

    try {
      showToast("Generating PDF report...", "success");

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

      // Header Banner
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", margin, 10, 20, 20);
        } catch (e) {
          console.warn("Failed to add logo to PDF");
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES (AUTONOMOUS)", 38, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Accredited by NAAC | Rushikonda, Visakhapatnam - 530045.", 38, 19);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`DEPARTMENT OF ${(metadata.department || "").toUpperCase()}`, 38, 24);

      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 32, 210 - margin, 32);

      // Report Info
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`MID EXAM PERFORMANCE & ATTENDANCE ANALYSIS REPORT`, margin, 39);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Academic Year: ${metadata.academicYear}`, margin, 45);
      doc.text(`Year / Sem: B.Tech ${metadata.year} Year / Sem ${metadata.semester}`, margin, 50);
      doc.text(`Section: Section ${metadata.section}`, 140, 45);
      doc.text(`Exam: ${metadata.examType === "MID_I" ? "MID - I" : "MID - II"} (30 Marks)`, 140, 50);

      // Table 1: Subject-wise Analysis
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("1. Subject-wise Performance Analysis", margin, 58);

      const subHeaders = [["S.No", "Code", "Subject Name", "Abs", "Avg", "Gap", "Diff %"]];
      const subRows = subjectAnalysis.map((sub: any) => [
        sub.sNo,
        sub.subjectCode,
        sub.subjectName,
        sub.absentees,
        sub.averageMarks,
        sub.gap,
        sub.difficultyIndex
      ]);

      autoTable(doc, {
        head: subHeaders,
        body: subRows,
        startY: 61,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, halign: "center", cellPadding: 2, lineColor: [210, 210, 210], lineWidth: 0.1 },
        columnStyles: {
          2: { halign: "left" }
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" }
      });

      // Table 2: Student Counts by Performance Levels
      let nextY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("2. Student Distribution by Performance Levels", margin, nextY);

      const perfHeaders = [["Performance Level", "High Attendance (>=75%)", "Med Attendance (65%-74.9%)", "Low Attendance (<65%)", "Total"]];
      const perfRows = [
        ["Top Performers (>=18)", performance.topHigh, performance.topMedium, performance.topLow, performance.topTotal],
        ["Middle Performers (12-17.9)", performance.middleHigh, performance.middleMedium, performance.middleLow, performance.middleTotal],
        ["Low Performers (<12)", performance.lowHigh, performance.lowMedium, performance.lowLow, performance.lowTotal]
      ];

      autoTable(doc, {
        head: perfHeaders,
        body: perfRows,
        startY: nextY + 3,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, halign: "center", cellPadding: 2.5, lineColor: [210, 210, 210], lineWidth: 0.1 },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" }
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" }
      });

      // Table 3: Correlation Matrix
      nextY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text("3. Correlation Matrix (Attendance vs Academic Performance)", margin, nextY);

      const matrixHeaders = [["Attendance Range", "High Marks (>=18)", "Med Marks (12-17.9)", "Low Marks (<12)", "Total", "Pct %"]];
      const matrixRows = matrix.map((row: any) => [
        row.range,
        row.high,
        row.medium,
        row.low,
        row.total,
        row.percentage
      ]);

      autoTable(doc, {
        head: matrixHeaders,
        body: matrixRows,
        startY: nextY + 3,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, halign: "center", cellPadding: 2.5, lineColor: [210, 210, 210], lineWidth: 0.1 },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold" }
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" }
      });

      // Footer
      nextY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Signature of HOD / Coordinator", margin + 5, nextY);
      doc.text("Signature of Director / Principal", 140, nextY);

      doc.save(`Mid_Exam_Analysis_${metadata.departmentCode}_Sem${metadata.semester}_Sec_${metadata.section}_${metadata.examType}.pdf`);
      showToast("PDF report generated successfully", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate PDF", "error");
    }
  };

  // Lock / Unlock / Publish handler
  const handlePaperAction = async (paperId: string, action: "lock" | "unlock" | "publish") => {
    if (action === "publish") {
      const paper = papers.find(p => p.id === paperId);
      if (paper) {
        setSelectedPaperForPublish(paper);
        setShowPublishModal(true);
      }
      return;
    }

    setActionLoading(prev => ({ ...prev, [paperId]: true }));
    try {
      const res = await fetch("/api/mid-exam/marks/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId, action })
      });
      if (res.ok) {
        showToast(`Paper successfully ${action}ed!`, "success");
        await loadPapers();
      } else {
        const data = await res.json();
        showToast(data.error || "Action failed", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [paperId]: false }));
    }
  };

  const handleUnfreezePaper = async (paperId: string) => {
    setActionLoading(prev => ({ ...prev, [paperId]: true }));
    try {
      const res = await fetch(`/api/mid-exam/papers/${paperId}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unfreeze" })
      });
      if (res.ok) {
        showToast("Paper successfully unfrozen!", "success");
        await loadPapers();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to unfreeze", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [paperId]: false }));
    }
  };

  const handleFreezePaper = async (paperId: string) => {
    setActionLoading(prev => ({ ...prev, [paperId]: true }));
    try {
      const res = await fetch(`/api/mid-exam/papers/${paperId}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "freeze" })
      });
      if (res.ok) {
        showToast("Paper successfully frozen!", "success");
        await loadPapers();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to freeze", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [paperId]: false }));
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm("Are you sure you want to delete this question paper? This will permanently delete the paper and all associated student marks entered for it. This cannot be undone.")) return;
    setActionLoading(prev => ({ ...prev, [paperId]: true }));
    try {
      const res = await fetch(`/api/mid-exam/papers/${paperId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Question paper successfully deleted!", "success");
        await loadPapers();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to delete paper", "error");
      }
    } catch (e) {
      showToast("Network error", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [paperId]: false }));
    }
  };

  // Scheme actions
  const handleSaveScheme = async () => {
    if (!schemeForm.name) { showToast("Name is required", "error"); return; }
    setSavingScheme(true);
    try {
      const isEdit = !!schemeForm.id;
      const url = "/api/mid-exam/scheme";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schemeForm)
      });
      if (res.ok) {
        showToast(isEdit ? "Scheme updated!" : "Scheme created!", "success");
        setShowSchemeModal(false);
        // Reload schemes
        const sch = await fetch("/api/mid-exam/scheme").then(r => r.json());
        setSchemes(sch);
      } else {
        showToast("Failed to save scheme", "error");
      }
    } finally {
      setSavingScheme(false);
    }
  };

  const handleDeleteScheme = async (id: string) => {
    if (!confirm("Are you sure you want to delete this evaluation scheme?")) return;
    try {
      const res = await fetch(`/api/mid-exam/scheme?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Scheme deleted!", "success");
        setSchemes(schemes.filter(s => s.id !== id));
      } else {
        showToast("Failed to delete", "error");
      }
    } catch (e) {
      showToast("Error occurred", "error");
    }
  };

  const handleViewClassReport = async (reportType: "MID_I" | "MID_II" | "ASSIGNMENT" | "FINAL") => {
    if (!selectedSection) {
      showToast("Select a Section to view reports", "error");
      return;
    }
    setFetchingReport(true);
    try {
      const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}`);
      if (!res.ok) {
        showToast("Failed to fetch report data", "error");
        return;
      }
      const data = await res.json();
      setPreviewData(data);
      setPreviewType(reportType);
      setShowAttendance(false);
      setAttendanceMap({});
      // Scroll to preview element smoothly
      setTimeout(() => {
        document.getElementById("report-preview-pane")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e) {
      console.error(e);
      showToast("Failed to load report", "error");
    } finally {
      setFetchingReport(false);
    }
  };

  const handleViewConsolidatedReport = async () => {
    if (!consolidatedSection) {
      showToast("Select a Section option", "error");
      return;
    }
    setFetchingReport(true);
    try {
      const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${consolidatedSection}`);
      if (!res.ok) {
        showToast("Failed to fetch report data", "error");
        return;
      }
      const data = await res.json();
      setPreviewData(data);
      setPreviewType("FINAL");
      setPreviewSubjectId("");
      setShowAttendance(false);
      setAttendanceMap({});
      // Scroll to preview element smoothly
      setTimeout(() => {
        document.getElementById("report-preview-pane")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e) {
      console.error(e);
      showToast("Failed to load report", "error");
    } finally {
      setFetchingReport(false);
    }
  };

  const handleViewSubjectReport = async () => {
    if (!selectedSection) {
      showToast("Select a Section to view reports", "error");
      return;
    }
    if (!selectedReportSubjectId) {
      showToast("Select a Subject to view detailed report", "error");
      return;
    }
    setFetchingReport(true);
    try {
      const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}`);
      if (!res.ok) {
        showToast("Failed to fetch report data", "error");
        return;
      }
      const data = await res.json();
      setPreviewData(data);
      setPreviewType("SUBJECT");
      setPreviewSubjectId(selectedReportSubjectId);
      setShowAttendance(false);
      setAttendanceMap({});
      // Scroll to preview element smoothly
      setTimeout(() => {
        document.getElementById("report-preview-pane")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e) {
      console.error(e);
      showToast("Failed to load report", "error");
    } finally {
      setFetchingReport(false);
    }
  };

  const fetchAttendance = async () => {
    if (!previewData || !previewType) return;
    if (showAttendance) {
      setShowAttendance(false);
      return;
    }

    if (Object.keys(attendanceMap).length > 0) {
      setShowAttendance(true);
      return;
    }

    setFetchingAttendance(true);
    try {
      const year = previewData.meta.year;
      const semester = previewData.meta.semester;
      const promises = previewData.rows.map(async (row: any) => {
        try {
          const res = await fetch(`/api/students/${row.studentId}/stats?year=${year}&semester=${semester}`);
          if (res.ok) {
            const data = await res.json();
            if (previewType === "SUBJECT") {
              const subStat = data.subjects?.find((s: any) => s.id === previewSubjectId);
              return { studentId: row.studentId, pct: subStat ? subStat.percentage : (data.overall?.percentage ?? 0) };
            } else {
              return { studentId: row.studentId, pct: data.overall?.percentage ?? 0 };
            }
          }
        } catch (e) {
          console.error(e);
        }
        return { studentId: row.studentId, pct: 0 };
      });
      const results = await Promise.all(promises);
      const map: Record<string, number> = {};
      results.forEach(r => {
        map[r.studentId] = r.pct;
      });
      setAttendanceMap(map);
      setShowAttendance(true);
    } catch (e) {
      console.error(e);
      showToast("Failed to fetch attendance data", "error");
    } finally {
      setFetchingAttendance(false);
    }
  };

  const downloadExcel = async () => {
    if (!previewData || !previewType) return;

    const includeAttendance = confirm("Would you like to include the Attendance column in the Excel report?");
    let currentAttendanceMap = attendanceMap;

    if (includeAttendance) {
      if (Object.keys(currentAttendanceMap).length === 0) {
        setFetchingAttendance(true);
        try {
          const year = previewData.meta.year;
          const semester = previewData.meta.semester;
          const promises = previewData.rows.map(async (row: any) => {
            try {
              const res = await fetch(`/api/students/${row.studentId}/stats?year=${year}&semester=${semester}`);
              if (res.ok) {
                const data = await res.json();
                if (previewType === "SUBJECT") {
                  const subStat = data.subjects?.find((s: any) => s.id === previewSubjectId);
                  return { studentId: row.studentId, pct: subStat ? subStat.percentage : (data.overall?.percentage ?? 0) };
                } else {
                  return { studentId: row.studentId, pct: data.overall?.percentage ?? 0 };
                }
              }
            } catch (e) {
              console.error(e);
            }
            return { studentId: row.studentId, pct: 0 };
          });
          const results = await Promise.all(promises);
          const map: Record<string, number> = {};
          results.forEach(r => {
            map[r.studentId] = r.pct;
          });
          currentAttendanceMap = map;
          setAttendanceMap(map);
          setShowAttendance(true);
        } catch (e) {
          console.error(e);
          alert("Failed to load attendance for Excel export.");
        } finally {
          setFetchingAttendance(false);
        }
      }
    }

    const rowsList: any[] = [];
    rowsList.push([`${previewType === "SUBJECT" ? "SUBJECT DETAILED EVALUATION SHEET" : previewType.replace("_", " ") + " MARKS MEMO"}`]);
    rowsList.push([`Department: ${previewData.meta.department}`]);
    rowsList.push([`Academic Year: ${previewData.meta.academicYear} | B.Tech Year: ${previewData.meta.year} | Semester: ${previewData.meta.semester} | Section: ${previewData.meta.section}`]);
    if (previewType === "SUBJECT") {
      const subName = reportSubjects.find(s => s.id === previewSubjectId)?.name || "";
      rowsList.push([`Subject: ${subName}`]);
    }
    rowsList.push([]);

    if (previewType !== "SUBJECT") {
      const headers = ["S.No", "Roll Number", "Student Name"];
      if (includeAttendance) {
        headers.push("Attendance (%)");
      }
      const filteredSubjects = previewData.subjects.filter((sub: any) => {
        const isLab = sub.type?.toUpperCase() === "LAB";
        if (isLab) return previewType === "FINAL" ? true : showLabMarks;
        return true;
      });
      filteredSubjects.forEach((sub: any) => {
        const isLab = sub.type?.toUpperCase() === "LAB";
        let marksSuffix = "";
        if (isLab) {
          marksSuffix = previewType === "MID_I" ? "MID I 50M" : previewType === "MID_II" ? "MID II 50M" : previewType === "ASSIGNMENT" ? "Assign 10M" : "Final 50M";
        } else {
          marksSuffix = previewType === "MID_I" ? "MID I 30M" : previewType === "MID_II" ? "MID II 30M" : previewType === "ASSIGNMENT" ? "Assign 10M" : "Final 30M";
        }
        headers.push(`${sub.shortName || sub.name} (${marksSuffix})`);
      });
      rowsList.push(headers);

      previewData.rows.forEach((row: any, idx: number) => {
        const rowData: any[] = [idx + 1, row.rollNumber, row.name];
        if (includeAttendance) {
          rowData.push(currentAttendanceMap[row.studentId] !== undefined ? `${currentAttendanceMap[row.studentId]}%` : "");
        }
        filteredSubjects.forEach((sub: any) => {
          const marksObj = row.subjects[sub.id] || {};
          let val: number | null = null;
          if (previewType === "MID_I") val = marksObj.mid1;
          else if (previewType === "MID_II") val = marksObj.mid2;
          else if (previewType === "ASSIGNMENT") val = marksObj.assignment;
          else if (previewType === "FINAL") val = marksObj.internal;

          rowData.push(val !== null ? Math.round(val) : "");
        });
        rowsList.push(rowData);
      });
    } else {
      const headers = ["S.No", "Roll Number", "Student Name"];
      if (includeAttendance) {
        headers.push("Attendance (%)");
      }
      headers.push("MID-I (30M)", "MID-I (20M)", "MID-II (30M)", "MID-II (20M)", "MID Avg (20M)", "Assign (10M)", "Final (30M)");
      rowsList.push(headers);

      previewData.rows.forEach((row: any, idx: number) => {
        const marksObj = row.subjects[previewSubjectId] || {};
        const m1 = marksObj.mid1Scaled;
        const m2 = marksObj.mid2Scaled;
        const available = [m1, m2].filter(v => v !== null && v !== undefined) as number[];
        const midAvgVal = available.length > 0 ? available.reduce((a, b) => a + b, 0) / available.length : null;

        const rowData: any[] = [idx + 1, row.rollNumber, row.name];
        if (includeAttendance) {
          rowData.push(currentAttendanceMap[row.studentId] !== undefined ? `${currentAttendanceMap[row.studentId]}%` : "");
        }

        const fields = [
          marksObj.mid1,
          marksObj.mid1Scaled,
          marksObj.mid2,
          marksObj.mid2Scaled,
          midAvgVal,
          marksObj.assignment,
          marksObj.internal
        ];

        fields.forEach(val => {
          rowData.push(val !== null && val !== undefined ? Math.round(val) : "");
        });
        rowsList.push(rowData);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rowsList);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    let filename = "";
    if (previewType === "SUBJECT") {
      filename = `Subject_Detailed_Report_${previewData.meta.departmentCode}_Sem${previewData.meta.semester}_Sec_${previewData.meta.section}.xlsx`;
    } else {
      filename = `${previewType}_Marks_Report_${previewData.meta.departmentCode}_Sem${previewData.meta.semester}_Sec_${previewData.meta.section}.xlsx`;
    }

    XLSX.writeFile(wb, filename);
  };

  // Generate strict, high-alignment landscape PDF reports
  const generateClassReportPDF = async (reportType: "MID_I" | "MID_II" | "ASSIGNMENT" | "FINAL", cachedData?: any) => {
    if (!selectedSection) {
      showToast("Select a Section to generate reports", "error");
      return;
    }

    try {
      showToast("Generating PDF report...", "success");
      let data = cachedData;
      if (!data) {
        const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}`);
        if (!res.ok) {
          showToast("Failed to fetch report data", "error");
          return;
        }
        data = await res.json();
      }

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
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const meta = data.meta;
      const subjects = (data.subjects || []).filter((sub: any) => {
        const isLab = sub.type?.toUpperCase() === "LAB";
        if (isLab) return reportType === "FINAL" ? true : showLabMarks;
        return true;
      });
      const rows = data.rows || [];

      // A4 Landscape is 297mm x 210mm
      const margin = 12;

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
      doc.setFontSize(13);
      doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(AUTONOMOUS)", 40, 15, { align: "left" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Rushikonda, Visakhapatnam - 530045.", 40, 20, { align: "left" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const deptText = "DEPARTMENT OF " + (meta.department || "").toUpperCase();
      const deptLines = doc.splitTextToSize(deptText, 297 - 40 - margin);
      let currentY = 25;
      deptLines.forEach((line: string) => {
        doc.text(line, 40, currentY, { align: "left" });
        currentY += 5;
      });

      doc.setFontSize(11);
      let reportTitle = "";
      if (reportType === "MID_I") reportTitle = "MID-I MARKS MEMO";
      else if (reportType === "MID_II") reportTitle = "MID-II MARKS MEMO";
      else if (reportType === "ASSIGNMENT") reportTitle = "ASSIGNMENTS MARKS MEMO";
      else if (reportType === "FINAL") reportTitle = "FINAL INTERNAL MARKS MEMO";

      doc.text(`${reportTitle} - B.TECH ${meta.year} YEAR / ${meta.semester} SEMESTER`, 40, currentY, { align: "left" });
      currentY += 4;

      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, 297 - margin, currentY);

      // Class details table
      const detailsY = currentY + 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Academic Year: ${meta.academicYear}`, margin, detailsY);
      doc.text(`Section: ${meta.section}`, 297 - margin - 40, detailsY);

      const tableStartY = detailsY + 6;

      // Build Headers dynamically
      const headers = [["S.No", "Roll Number", "Student Name"]];
      for (const sub of subjects) {
        let colHeader = sub.shortName || sub.code;
        const isLab = sub.type?.toUpperCase() === "LAB";
        if (reportType === "MID_I") colHeader += isLab ? `\nMID I (50M)` : `\nMID I (30M)`;
        else if (reportType === "MID_II") colHeader += isLab ? `\nMID II (50M)` : `\nMID II (30M)`;
        else if (reportType === "ASSIGNMENT") colHeader += `\nASSIGN (10M)`;
        else if (reportType === "FINAL") colHeader += isLab ? `\nFINAL (50M)` : `\nFINAL (30M)`;
        headers[0].push(colHeader);
      }

      // Build Table Data rows
      const tableRows = rows.map((r: any, idx: number) => {
        const rowData = [
          (idx + 1).toString(),
          r.rollNumber,
          r.name
        ];

        for (const sub of subjects) {
          const marks = r.subjects[sub.id] || { mid1: null, mid2: null, assignment: null, internal: 0 };
          let displayVal = "";
          if (reportType === "MID_I") {
            displayVal = marks.mid1 !== null ? Math.round(marks.mid1).toString() : "AB";
          } else if (reportType === "MID_II") {
            displayVal = marks.mid2 !== null ? Math.round(marks.mid2).toString() : "AB";
          } else if (reportType === "ASSIGNMENT") {
            displayVal = marks.assignment !== null ? Math.round(marks.assignment).toString() : "0";
          } else if (reportType === "FINAL") {
            displayVal = Math.round(marks.internal).toString();
          }
          rowData.push(displayVal);
        }

        return rowData;
      });

      // AutoTable styles
      autoTable(doc, {
        head: headers,
        body: tableRows,
        startY: tableStartY,
        margin: { left: margin, right: margin, bottom: 28 },
        styles: {
          fontSize: 8,
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
          fontSize: 7.5,
          fontStyle: "bold",
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 28, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 45, halign: "left" }
        },
        theme: "grid"
      });

      // Signature lines on every page (for FINAL) or last page (for others)
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.height;
      const sigY = pageHeight - 18;

      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);

        if (reportType === "FINAL") {
          doc.line(margin, sigY, margin + 45, sigY);
          doc.text("Signature of the HOD", margin + 22.5, sigY + 5, { align: "center" });

          doc.line(297 - margin - 45, sigY, 297 - margin, sigY);
          doc.text("Signature of the Director", 297 - margin - 22.5, sigY + 5, { align: "center" });
        } else {
          if (i === totalPages) {
            doc.line(margin, sigY, margin + 45, sigY);
            doc.text("Signature of the Faculty", margin + 22.5, sigY + 5, { align: "center" });

            doc.line(148 - 30, sigY, 148 + 30, sigY);
            doc.text("Signature of the Faculty Coordinator", 148, sigY + 5, { align: "center" });

            doc.line(297 - margin - 45, sigY, 297 - margin, sigY);
            doc.text("Signature of the HOD", 297 - margin - 22.5, sigY + 5, { align: "center" });
          }
        }
      }

      let filename = "";
      if (reportType === "MID_I") filename = `MID_I_Marks_Memo_${meta.departmentCode}_Sem${selectedSem}_Sec_${meta.section}.pdf`;
      else if (reportType === "MID_II") filename = `MID_II_Marks_Memo_${meta.departmentCode}_Sem${selectedSem}_Sec_${meta.section}.pdf`;
      else if (reportType === "ASSIGNMENT") filename = `Assignment_Marks_Memo_${meta.departmentCode}_Sem${selectedSem}_Sec_${meta.section}.pdf`;
      else if (reportType === "FINAL") filename = `Final_Internal_Marks_Memo_${meta.departmentCode}_Sem${selectedSem}_Sec_${meta.section}.pdf`;

      doc.save(filename);
      showToast("PDF generated successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("PDF generation failed", "error");
    }
  };

  const generateSubjectReportPDF = async (cachedData?: any) => {
    if (!selectedSection) {
      showToast("Select a Section to generate reports", "error");
      return;
    }
    if (!selectedReportSubjectId) {
      showToast("Select a Subject to generate detailed report", "error");
      return;
    }

    try {
      showToast("Generating Detailed Subject PDF...", "success");
      let data = cachedData;
      if (!data) {
        const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${selectedAY}&departmentId=${selectedDept}&year=${selectedYear}&semester=${selectedSem}&sectionId=${selectedSection}`);
        if (!res.ok) {
          showToast("Failed to fetch report data", "error");
          return;
        }
        data = await res.json();
      }

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

      const meta = data.meta;
      const subjects = data.subjects || [];
      const rows = data.rows || [];

      const targetSubject = reportSubjects.find(s => s.id === selectedReportSubjectId);
      const subjectName = targetSubject ? targetSubject.name : "Subject";
      const subjectCode = targetSubject ? targetSubject.code : "";

      // A4 Portrait is 210mm x 297mm
      const margin = 12;

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
      doc.setFontSize(10.5);
      doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND PG COURSES(AUTONOMOUS)", 40, 15, { align: "left" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Rushikonda, Visakhapatnam - 530045.", 40, 20, { align: "left" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const deptText = "DEPARTMENT OF " + (meta.department || "").toUpperCase();
      const deptLines = doc.splitTextToSize(deptText, 210 - 40 - margin);
      let currentY = 25;
      deptLines.forEach((line: string) => {
        doc.text(line, 40, currentY, { align: "left" });
        currentY += 4.5;
      });

      doc.setFontSize(9.5);
      const subjectTitleText = `SUBJECT EVALUATION SHEET - ${subjectName.toUpperCase()} (${subjectCode})`;
      const subjectTitleLines = doc.splitTextToSize(subjectTitleText, 210 - 40 - margin);
      subjectTitleLines.forEach((line: string) => {
        doc.text(line, 40, currentY, { align: "left" });
        currentY += 4.5;
      });
      currentY -= 0.5;

      doc.setLineWidth(0.2);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, 210 - margin, currentY);

      // Class details
      const detailsY = currentY + 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Academic Year: ${meta.academicYear}`, margin, detailsY);
      doc.text(`Section: ${meta.section} (B.Tech ${meta.year} Yr / ${meta.semester} Sem)`, 210 - margin - 75, detailsY);

      const tableStartY = detailsY + 6;

      // Build Headers
      const headers = [
        [
          "S.No", 
          "Roll Number", 
          "Student Name", 
          "MID-I\n(30M)", 
          "MID-I\n(20M)", 
          "MID-II\n(30M)", 
          "MID-II\n(20M)", 
          "MID Avg\n(20M)",
          "Assign\n(10M)", 
          "Final\n(30M)"
        ]
      ];

      // Build Table Data rows
      const tableRows = rows.map((r: any, idx: number) => {
        const marks = r.subjects[selectedReportSubjectId] || { mid1: null, mid1Scaled: null, mid2: null, mid2Scaled: null, assignment: null, internal: 0 };
        const m1 = marks.mid1Scaled;
        const m2 = marks.mid2Scaled;
        const available = [m1, m2].filter(v => v !== null && v !== undefined) as number[];
        const midAvgVal = available.length > 0 ? available.reduce((a, b) => a + b, 0) / available.length : null;
        
        return [
          (idx + 1).toString(),
          r.rollNumber,
          r.name,
          marks.mid1 !== null ? Math.round(marks.mid1).toString() : "AB",
          marks.mid1Scaled !== null ? Math.round(marks.mid1Scaled).toString() : "AB",
          marks.mid2 !== null ? Math.round(marks.mid2).toString() : "AB",
          marks.mid2Scaled !== null ? Math.round(marks.mid2Scaled).toString() : "AB",
          midAvgVal !== null ? Math.round(midAvgVal).toString() : "AB",
          marks.assignment !== null ? Math.round(marks.assignment).toString() : "0",
          Math.round(marks.internal).toString()
        ];
      });

      // Calculate averages for PDF footer
      const getAvgPDF = (extractor: (marks: any) => number | null) => {
        let sum = 0;
        let count = 0;
        rows.forEach((r: any) => {
          const marks = r.subjects[selectedReportSubjectId] || {};
          const val = extractor(marks);
          if (val !== null && val !== undefined) {
            sum += val;
            count++;
          }
        });
        return count > 0 ? (sum / count).toFixed(1) : "N/A";
      };

      const getMidAvgClassPDF = () => {
        let sum = 0;
        let count = 0;
        rows.forEach((r: any) => {
          const marks = r.subjects[selectedReportSubjectId] || {};
          const m1 = marks.mid1Scaled;
          const m2 = marks.mid2Scaled;
          const available = [m1, m2].filter(v => v !== null && v !== undefined) as number[];
          if (available.length > 0) {
            sum += available.reduce((a, b) => a + b, 0) / available.length;
            count++;
          }
        });
        return count > 0 ? (sum / count).toFixed(1) : "N/A";
      };

      const footerRow = [
        "",
        "",
        "Class Average",
        getAvgPDF((m) => m.mid1),
        getAvgPDF((m) => m.mid1Scaled),
        getAvgPDF((m) => m.mid2),
        getAvgPDF((m) => m.mid2Scaled),
        getMidAvgClassPDF(),
        getAvgPDF((m) => m.assignment),
        getAvgPDF((m) => m.internal)
      ];

      // AutoTable styles
      autoTable(doc, {
        head: headers,
        body: tableRows,
        foot: [footerRow],
        startY: tableStartY,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8.5,
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
          fontSize: 8,
          fontStyle: "bold",
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        footStyles: {
          fillColor: [240, 243, 246],
          textColor: [30, 41, 59],
          fontSize: 8,
          fontStyle: "bold",
          lineWidth: 0.2,
          lineColor: [180, 180, 180]
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 45, halign: "left" },
          3: { cellWidth: 15 },
          4: { cellWidth: 15 },
          5: { cellWidth: 15 },
          6: { cellWidth: 15 },
          7: { cellWidth: 17, fontStyle: "bold" },
          8: { cellWidth: 15 },
          9: { cellWidth: 16, fontStyle: "bold" }
        },
        theme: "grid"
      });

      // Signature lines
      const finalY = (doc as any).lastAutoTable.finalY || 200;
      const pageHeight = doc.internal.pageSize.height;

      let sigY = finalY + 16;
      if (sigY > pageHeight - 20) {
        doc.addPage();
        sigY = 30;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.line(margin, sigY, margin + 40, sigY);
      doc.text("Signature of the Faculty", margin + 20, sigY + 5, { align: "center" });

      doc.line(105 - 25, sigY, 105 + 25, sigY);
      doc.text("Signature of the Faculty Coordinator", 105, sigY + 5, { align: "center" });

      doc.line(210 - margin - 40, sigY, 210 - margin, sigY);
      doc.text("Signature of the HOD", 210 - margin - 20, sigY + 5, { align: "center" });

      doc.save(`Subject_Marks_Memo_${subjectCode}_Sem${selectedSem}_Sec_${meta.section}.pdf`);
      showToast("Subject Memo generated successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("PDF generation failed", "error");
    }
  };

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">

        {/* Top Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Academic Evaluation Control Panel</h1>
            <p className="mt-1 text-slate-500">Configure evaluation schemes, publish exam marks, and print university assessment memos</p>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Year</span>
              <select value={selectedAY} onChange={e => setSelectedAY(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {academicYears.map(ay => <option key={ay.id} value={ay.id}>{ay.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Dept</span>
              <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {departments.map(d => <option key={d.id} value={d.id}>{d.code}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Year</span>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["1", "2", "3", "4"].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sem</span>
              <select value={selectedSem} onChange={e => setSelectedSem(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {["1", "2"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Section</span>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>Sec {s.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Exam Type</span>
              <select value={selectedExamType} onChange={e => setSelectedExamType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="ALL">All MIDs</option>
                <option value="MID_I">MID I</option>
                <option value="MID_II">MID II</option>
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Search</span>
              <input
                type="text"
                placeholder="Subject / Faculty..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <div className="mb-8 flex gap-2 border-b border-slate-200 pb-2">
          {(["dashboard", "schemes", "publish", "reports", "co-po-mapping", "analysis"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab === "co-po-mapping" ? "CO-PO MAPPING" : tab === "analysis" ? "PERFORMANCE ANALYSIS" : tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Panels */}
        <div className="min-h-[400px]">
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Stat panel */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">Total Question Papers</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">{papers.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">Frozen & Ready</p>
                  <p className="mt-2 text-3xl font-extrabold text-amber-600">{papers.filter(p => p.isFrozen).length}</p>
                </div>
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">Published to Production</p>
                  <p className="mt-2 text-3xl font-extrabold text-emerald-600">{papers.filter(p => p.publishRecord?.isPublished).length}</p>
                </div>
              </div>

              {/* Recent activity grid */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Class Question Paper Status</h3>
                {filteredPapers.length === 0 ? (
                  <p className="text-slate-400 text-sm">
                    {papers.length === 0 ? "No question papers created in the selected semester." : "No question papers matching search criteria."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                          <th className="pb-3">Subject</th>
                          <th className="pb-3">Section</th>
                          <th className="pb-3">Exam</th>
                          <th className="pb-3 text-center">Freeze Status</th>
                          <th className="pb-3 text-center">ERP Publish Status</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {filteredPapers.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="py-3 font-semibold text-slate-800">
                              <div>
                                {p.subject.name}{" "}
                                <span className="font-mono text-xs font-normal text-slate-400">({p.subject.code})</span>
                                {p.subject.department?.code && (
                                  <span className="ml-2 inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                    {p.subject.department.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-normal text-slate-500 mt-0.5">Faculty: <span className="font-semibold text-blue-600">{p.facultyName || "Not Assigned"}</span></div>
                            </td>
                            <td className="py-3 text-slate-600">Sec {p.section.name}</td>
                            <td className="py-3 text-slate-600 font-medium">{p.examType.replace("_", " ")}</td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.isFrozen ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                              }`}>
                                {p.isFrozen ? "Frozen" : "Draft"}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                p.publishRecord?.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {p.publishRecord?.isPublished ? "Published" : "Pending"}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <a
                                  href={`/faculty/mid-exam/marks/${p.id}`}
                                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                  title="View and edit entered student marks"
                                >
                                  <FaEye size={10} /> View Marks
                                </a>
                                {p.isFrozen && (
                                  <a
                                    href={`/faculty/mid-exam/paper/${p.id}`}
                                    className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                    title="View and print question paper"
                                  >
                                    <FaFileAlt size={10} /> View Paper
                                  </a>
                                )}
                                {p.isFrozen ? (
                                  <button
                                    onClick={() => handleUnfreezePaper(p.id)}
                                    disabled={actionLoading[p.id]}
                                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title="Unfreeze paper to allow faculty to edit paper questions and format"
                                  >
                                    <FaUnlock size={10} /> Unfreeze
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleFreezePaper(p.id)}
                                    disabled={actionLoading[p.id]}
                                    className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                                    title="Freeze paper questions and format"
                                  >
                                    <FaLock size={10} /> Freeze
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePaper(p.id)}
                                  disabled={actionLoading[p.id]}
                                  className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                  title="Permanently delete paper and all entered student marks"
                                >
                                  <FaTrash size={10} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pending Question Papers */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Pending Question Papers</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Faculty subject mappings with no Mid-Exam paper created yet.</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
                    {filteredPendingPapers.length} Pending
                  </span>
                </div>
                {filteredPendingPapers.length === 0 ? (
                  <p className="text-slate-400 text-sm">
                    {pendingPapers.length === 0 ? "All assigned papers have been created for the selected filters! 🎉" : "No pending papers matching search criteria."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                          <th className="pb-3">Subject</th>
                          <th className="pb-3">Section</th>
                          <th className="pb-3">Exam Type</th>
                          <th className="pb-3">Assigned Faculty</th>
                          <th className="pb-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {filteredPendingPapers.map((pp, idx) => (
                          <tr key={pp.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-3 font-semibold text-slate-800">
                              <div>
                                {pp.subject.name}{" "}
                                <span className="font-mono text-xs font-normal text-slate-400">({pp.subject.code})</span>
                                {pp.subject.department?.code && (
                                  <span className="ml-2 inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-inset ring-slate-500/10">
                                    {pp.subject.department.code}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-slate-600">Sec {pp.section.name}</td>
                            <td className="py-3 text-slate-600 font-semibold text-indigo-600">{pp.examType.replace("_", " ")}</td>
                            <td className="py-3 text-slate-700 font-medium">{pp.facultyName}</td>
                            <td className="py-3 text-right">
                              <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
                                Not Created
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "schemes" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Configurable Evaluation Schemes</h3>
                  <p className="text-sm text-slate-500">Define theory, practical, or open elective internal marks formulas</p>
                </div>
                <button
                  onClick={() => {
                    setSchemeForm({
                      id: "",
                      name: "",
                      subjectType: "THEORY",
                      mid1MaxMarks: 30,
                      mid2MaxMarks: 30,
                      mid1ScaledTo: 20,
                      mid2ScaledTo: 20,
                      assignmentMax: 10,
                      internalMax: 30,
                      isDefault: false
                    });
                    setShowSchemeModal(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <FaPlus size={12} /> Add Scheme
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {schemes.map(s => (
                  <div key={s.id} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 hover:shadow-md transition-all">
                    {s.isDefault && (
                      <span className="absolute top-4 right-4 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                        Default
                      </span>
                    )}
                    <h4 className="text-lg font-bold text-slate-900">{s.name}</h4>
                    <p className="text-xs text-slate-400 font-semibold uppercase mt-0.5">{s.subjectType}</p>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-400">MID Exams (Max Marks)</p>
                        <p className="font-bold text-slate-700">{s.mid1MaxMarks} marks</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-400">MID Scaling (Scale To)</p>
                        <p className="font-bold text-slate-700">{s.mid1ScaledTo} marks</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-xs text-slate-400">Assignment (Max Marks)</p>
                        <p className="font-bold text-slate-700">{s.assignmentMax} marks</p>
                      </div>
                      <div className="rounded-xl bg-blue-50 p-2.5">
                        <p className="text-xs text-blue-400">Final Internal (Max Marks)</p>
                        <p className="font-bold text-blue-700">{s.internalMax} marks</p>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2 border-t border-slate-50 pt-4">
                      <button
                        onClick={() => {
                          setSchemeForm(s);
                          setShowSchemeModal(true);
                        }}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <FaPen size={12} />
                      </button>
                      {!s.isDefault && (
                        <button
                          onClick={() => handleDeleteScheme(s.id)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <FaTrash size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "publish" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              
              {/* Send SMS to Parents Panel */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900">Send MID MARKS SMS TO PARENTS</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Send a consolidated SMS alert of all theory mid exam marks to parents for the selected class/section.
                  </p>
                </div>
                <div className="flex items-end gap-3 self-start md:self-auto">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Exam Type</span>
                    <select
                      value={smsExamType}
                      onChange={e => setSmsExamType(e.target.value as any)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="MID_I">MID I</option>
                      <option value="MID_II">MID II</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSendMarksSMS}
                    disabled={sendingSMS}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 h-[32px] justify-center"
                  >
                    {sendingSMS ? <FaSpinner className="animate-spin" size={12} /> : <FaPaperPlane size={12} />}
                    Send SMS to Parents
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900">Bulk Secure Marks Publish Engine</h3>
                <p className="text-sm text-slate-500">Lock faculty updates and push finalised granular assessment totals to production ERP marks matrices</p>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                        <th className="px-6 py-4">Subject</th>
                        <th className="px-6 py-4">Section</th>
                        <th className="px-6 py-4">Exam Type</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {filteredPapers.map(p => {
                        const isLocked = p.publishRecord?.isLocked ?? false;
                        const isPublished = p.publishRecord?.isPublished ?? false;
                        const loading = actionLoading[p.id] || false;

                        return (
                          <tr key={p.id}>
                            <td className="px-6 py-4 font-semibold text-slate-800">{p.subject.name} <span className="font-mono text-xs font-normal text-slate-400">({p.subject.code})</span></td>
                            <td className="px-6 py-4 text-slate-600">Sec {p.section.name}</td>
                            <td className="px-6 py-4 text-slate-600 font-semibold">{p.examType.replace("_", " ")}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                isPublished
                                  ? "bg-emerald-100 text-emerald-700"
                                  : isLocked
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {isPublished ? "Published" : isLocked ? "Locked" : "Open for entries"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <a
                                  href={`/faculty/mid-exam/marks/${p.id}`}
                                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                  title="View and edit entered student marks"
                                >
                                  <FaEye size={10} /> View Marks
                                </a>
                                {p.isFrozen && (
                                  <a
                                    href={`/faculty/mid-exam/paper/${p.id}`}
                                    className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                                    title="View and print question paper"
                                  >
                                    <FaFileAlt size={10} /> View Paper
                                  </a>
                                )}
                                {isLocked ? (
                                  <button
                                    onClick={() => handlePaperAction(p.id, "unlock")}
                                    disabled={loading}
                                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <FaUnlock size={10} /> Unlock
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePaperAction(p.id, "lock")}
                                    disabled={loading}
                                    className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                  >
                                    <FaLock size={10} /> Lock
                                  </button>
                                )}

                                {!isPublished && (
                                  <button
                                    onClick={() => handlePaperAction(p.id, "publish")}
                                    disabled={loading || !p.isFrozen}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                    title={!p.isFrozen ? "Paper must be frozen by faculty first" : "Publish to ERP matrices"}
                                  >
                                    {loading ? <FaSpinner className="animate-spin" /> : <FaCheckCircle size={10} />}
                                    Publish Marks
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "reports" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Academic & University Print cell Memos</h3>
                <p className="text-sm text-slate-500">View compiled reports online with dynamic heatmaps or download signature-ready PDFs</p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Class-Wise Reports Card */}
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Class-Wise Reports</h4>
                    <p className="text-xs text-slate-500">Generate section-wide reports for all subjects side-by-side</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target Section</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 font-medium">
                      {sections.find(s => s.id === selectedSection)?.name 
                        ? `Section ${sections.find(s => s.id === selectedSection).name}`
                        : "No Section Selected (Select a section in filters bar)"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => handleViewClassReport("MID_I")}
                      disabled={!selectedSection || fetchingReport}
                      className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "MID_I" ? <FaSpinner className="animate-spin" /> : <FaEye />} View MID-I Memo
                    </button>
                    <button
                      onClick={() => handleViewClassReport("MID_II")}
                      disabled={!selectedSection || fetchingReport}
                      className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "MID_II" ? <FaSpinner className="animate-spin" /> : <FaEye />} View MID-II Memo
                    </button>
                    <button
                      onClick={() => handleViewClassReport("ASSIGNMENT")}
                      disabled={!selectedSection || fetchingReport}
                      className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "ASSIGNMENT" ? <FaSpinner className="animate-spin" /> : <FaEye />} View Assignment Memo
                    </button>
                    <button
                      onClick={() => handleViewClassReport("FINAL")}
                      disabled={!selectedSection || fetchingReport}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "FINAL" ? <FaSpinner className="animate-spin" /> : <FaEye />} View Final Internals
                    </button>
                  </div>
                </div>

                {/* Subject-Wise Reports Card */}
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Subject-Wise Detailed Report</h4>
                    <p className="text-xs text-slate-500">Generate a detailed evaluation sheet for a specific subject</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target Subject</label>
                    <select
                      value={selectedReportSubjectId}
                      onChange={e => setSelectedReportSubjectId(e.target.value)}
                      disabled={reportSubjects.length === 0}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:opacity-70"
                    >
                      {reportSubjects.length === 0 ? (
                        <option value="">No Subjects Found</option>
                      ) : (
                        reportSubjects.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} ({sub.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <button
                    onClick={handleViewSubjectReport}
                    disabled={!selectedSection || !selectedReportSubjectId || fetchingReport}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {fetchingReport && previewType === "SUBJECT" ? <FaSpinner className="animate-spin" /> : <FaEye />} View Subject Report
                  </button>
                </div>

                {/* Final Internal Marks Consolidated Report Card */}
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">Final Internal Marks Consolidated Report</h4>
                      <p className="text-xs text-slate-500 font-medium">Generate final internal marks (Theory: 30, Lab: 50) for a single section or all sections combined.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target Section</label>
                      <select
                        value={consolidatedSection}
                        onChange={e => setConsolidatedSection(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">All Sections</option>
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>
                            Section {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleViewConsolidatedReport}
                    disabled={fetchingReport}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 mt-auto"
                  >
                    {fetchingReport && previewType === "FINAL" && !previewSubjectId ? <FaSpinner className="animate-spin" /> : <FaEye />} View Consolidated Report
                  </button>
                </div>
              </div>

              {/* Report Preview Section */}
              {previewData && previewType && (
                <div id="report-preview-pane" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-6">
                  <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {previewType === "MID_I" && "MID-I Marks Memo"}
                        {previewType === "MID_II" && "MID-II Marks Memo"}
                        {previewType === "ASSIGNMENT" && "Assignments Marks Memo"}
                        {previewType === "FINAL" && "Final Internal Marks Memo"}
                        {previewType === "SUBJECT" && `Subject Detailed Sheet - ${(reportSubjects.find(s => s.id === previewSubjectId)?.name || "").toUpperCase()}`}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Academic Year: {previewData.meta.academicYear} | Section: {previewData.meta.section} 
                        {previewType === "SUBJECT" && ` (B.Tech ${previewData.meta.year} Yr / ${previewData.meta.semester} Sem)`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Heatmap Toggle */}
                      <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 cursor-pointer hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={showHeatmap}
                          onChange={e => setShowHeatmap(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Enable Performance Heatmap
                      </label>

                      {/* Attendance Toggle */}
                      <button
                        onClick={fetchAttendance}
                        disabled={fetchingAttendance}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
                          showAttendance
                            ? "bg-green-600 border-green-600 text-white hover:bg-green-700"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {fetchingAttendance ? (
                          <FaSpinner className="animate-spin" size={12} />
                        ) : (
                          <FaCalendarAlt size={12} />
                        )}
                        {showAttendance ? "Hide Attendance" : "Show Attendance"}
                      </button>

                      {/* Show Lab Marks Toggle */}
                      {previewType !== "SUBJECT" && previewType !== "FINAL" && (
                        <button
                          onClick={() => setShowLabMarks(prev => !prev)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
                            showLabMarks
                              ? "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <FaFlask size={12} />
                          {showLabMarks ? "Hide Lab Marks" : "Show Lab Marks"}
                        </button>
                      )}

                      {/* Download Excel Trigger */}
                      <button
                        onClick={downloadExcel}
                        disabled={fetchingAttendance}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                      >
                        <FaFileExcel size={12} /> Export Excel
                      </button>

                      {/* Download PDF Trigger */}
                      <button
                        onClick={() => {
                          if (previewType === "SUBJECT") {
                            generateSubjectReportPDF(previewData);
                          } else {
                            generateClassReportPDF(previewType, previewData);
                          }
                        }}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                      >
                        <FaDownload size={12} /> Download PDF
                      </button>
                    </div>
                  </div>

                  {/* Heatmap Legend */}
                  {showHeatmap && (
                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 rounded bg-red-500 border border-red-600 inline-block"></span>
                        Critical / Low (&lt; 12 marks on 30M scale)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 rounded bg-amber-500 border border-amber-600 inline-block"></span>
                        Average Performance (12 - 18 marks on 30M scale)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 rounded bg-emerald-500 border border-emerald-600 inline-block"></span>
                        Good / Excellent (&gt; 18 marks on 30M scale)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 rounded bg-slate-400 border border-slate-500 inline-block"></span>
                        AB (Absent)
                      </span>
                    </div>
                  )}

                  {/* Top Scrollbar for easy scrolling */}
                  {tableWidth > 0 && (
                    <div 
                      ref={topScrollRef} 
                      onScroll={handleTopScroll} 
                      className="overflow-x-auto scrollbar-thin"
                      style={{ width: "100%", scrollbarWidth: "thin" }}
                    >
                      <div style={{ width: `${tableWidth}px` }} className="h-[1px]" />
                    </div>
                  )}

                  {/* Data Table */}
                  <div 
                    ref={tableScrollRef}
                    onScroll={handleTableScroll}
                    className="overflow-x-auto rounded-xl border border-slate-150"
                  >
                    {(() => {
                      const filteredSubjects = previewData.subjects.filter((sub: any) => {
                        const isLab = sub.type?.toUpperCase() === "LAB";
                        if (isLab) return previewType === "FINAL" ? true : showLabMarks;
                        return true;
                      });
                      return (
                        <table className="w-full text-left text-xs border-collapse">
                          {previewType !== "SUBJECT" ? (
                            <>
                              {/* Class-Wise Report Headers */}
                              <thead>
                                <tr className="bg-slate-50 border border-black text-slate-600 font-bold uppercase">
                                  <th className="px-4 py-3 text-center border border-black w-12">S.No</th>
                                  <th className="px-4 py-3 text-center border border-black w-28">Roll Number</th>
                                  <th className="px-4 py-3 border border-black">Student Name</th>
                                  {showAttendance && (
                                    <th className="px-4 py-3 text-center border border-black min-w-[90px]">Attendance %</th>
                                  )}
                                  {filteredSubjects.map((sub: any) => (
                                    <th key={sub.id} className="px-4 py-3 text-center border border-black min-w-[75px]">
                                      {sub.shortName || sub.name}
                                      <span className="block text-[9px] font-normal text-slate-400 normal-case mt-0.5">
                                        {sub.type?.toUpperCase() === "LAB" ? (
                                          <>
                                            {previewType === "MID_I" && "MID I (50M)"}
                                            {previewType === "MID_II" && "MID II (50M)"}
                                            {previewType === "ASSIGNMENT" && "Assign (10M)"}
                                            {previewType === "FINAL" && "Final (50M)"}
                                          </>
                                        ) : (
                                          <>
                                            {previewType === "MID_I" && "MID I (30M)"}
                                            {previewType === "MID_II" && "MID II (30M)"}
                                            {previewType === "ASSIGNMENT" && "Assign (10M)"}
                                            {previewType === "FINAL" && "Final (30M)"}
                                          </>
                                        )}
                                      </span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-150 text-slate-700">
                                {previewData.rows.map((row: any, idx: number) => (
                                  <tr key={row.rollNumber} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 text-center border border-black">{idx + 1}</td>
                                    <td className="px-4 py-2.5 text-center border border-black">
                                      <Link href={`/admin/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-bold transition-colors">
                                        {row.rollNumber}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-2.5 border border-black">
                                      <Link href={`/admin/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-medium transition-colors">
                                        {row.name}
                                      </Link>
                                    </td>
                                    {showAttendance && (
                                      <td className="px-4 py-2.5 text-center font-bold border border-black">
                                        {attendanceMap[row.studentId] !== undefined ? `${attendanceMap[row.studentId]}%` : "0%"}
                                      </td>
                                    )}
                                    {filteredSubjects.map((sub: any) => {
                                      const marksObj = row.subjects[sub.id] || { mid1: null, mid2: null, assignment: null, internal: 0 };
                                      let val: number | null = null;
                                      let displayVal = "";
                                      const maxMarks = sub.type?.toUpperCase() === "LAB" ? 50 : (previewType === "ASSIGNMENT" ? 10 : 30);

                                      if (previewType === "MID_I") {
                                        val = marksObj.mid1;
                                        displayVal = val !== null ? Math.round(val).toString() : "AB";
                                      } else if (previewType === "MID_II") {
                                        val = marksObj.mid2;
                                        displayVal = val !== null ? Math.round(val).toString() : "AB";
                                      } else if (previewType === "ASSIGNMENT") {
                                        val = marksObj.assignment;
                                        displayVal = val !== null ? Math.round(val).toString() : "0";
                                      } else if (previewType === "FINAL") {
                                        val = marksObj.internal;
                                        displayVal = val !== null ? Math.round(val).toString() : "0";
                                      }

                                      // Get dynamic color class
                                      let colorClass = "";
                                      if (showHeatmap && displayVal !== "AB" && displayVal !== "") {
                                        const parsedVal = parseFloat(displayVal);
                                        if (!isNaN(parsedVal)) {
                                          const pct = (parsedVal / maxMarks) * 100;
                                          if (pct < 40) colorClass = "bg-red-50 text-red-700 border border-black";
                                          else if (pct <= 60) colorClass = "bg-amber-50 text-amber-700 border border-black";
                                          else colorClass = "bg-emerald-50 text-emerald-700 border border-black";
                                        }
                                      } else if (displayVal === "AB") {
                                        colorClass = "bg-slate-100 text-slate-400 border border-black";
                                      }

                                      return (
                                        <td key={sub.id} className={`px-4 py-2.5 text-center text-sm font-bold border border-black ${colorClass}`}>
                                          {displayVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                              {previewType !== "FINAL" && (
                                <tfoot className="print:hidden">
                                  {/* Column Average Row */}
                                  <tr className="bg-slate-50 border-t border-b border-black font-bold text-slate-800">
                                    <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2.5 text-right border border-black uppercase text-[10px] text-slate-500 font-bold">column average</td>
                                    {filteredSubjects.map((sub: any) => {
                                      const stats = getSubjectStats(sub.id, sub.type);
                                      return (
                                        <td key={sub.id} className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">
                                          {stats.average}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Above 60% Row */}
                                  <tr className="bg-white text-slate-700">
                                    <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students Above 60% (18 and above)</td>
                                    {filteredSubjects.map((sub: any) => {
                                      const stats = getSubjectStats(sub.id, sub.type);
                                      return (
                                        <td key={sub.id} className="px-4 py-2 text-center text-xs font-semibold border border-black">
                                          {stats.countAbove}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Between 60% to 40% Row */}
                                  <tr className="bg-white text-slate-700">
                                    <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students Between 60% to 40% (17 - 12 Marks)</td>
                                    {filteredSubjects.map((sub: any) => {
                                      const stats = getSubjectStats(sub.id, sub.type);
                                      return (
                                        <td key={sub.id} className="px-4 py-2 text-center text-xs font-semibold border border-black">
                                          {stats.countBetween}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Below 40% Row */}
                                  <tr className="bg-white text-slate-700">
                                    <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students Below 40% (11 - 1 Marks)</td>
                                    {filteredSubjects.map((sub: any) => {
                                      const stats = getSubjectStats(sub.id, sub.type);
                                      return (
                                        <td key={sub.id} className="px-4 py-2 text-center text-xs font-semibold border border-black">
                                          {stats.countBelow}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Total No. of Students With zero Marks Row */}
                                  <tr className="bg-white text-slate-700">
                                    <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students With zero Marks</td>
                                    {filteredSubjects.map((sub: any) => {
                                      const stats = getSubjectStats(sub.id, sub.type);
                                      return (
                                        <td key={sub.id} className="px-4 py-2 text-center text-xs font-semibold border border-black">
                                          {stats.countZero}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Total No. of Absentees Row */}
                                  <tr className="bg-white text-slate-700">
                                    <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Absentees</td>
                                    {filteredSubjects.map((sub: any) => {
                                      const stats = getSubjectStats(sub.id, sub.type);
                                      return (
                                        <td key={sub.id} className="px-4 py-2 text-center text-xs font-semibold border border-black">
                                          {stats.countAbsent}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tfoot>
                              )}
                            </>
                          ) : (() => {
                        const getAvg = (extractor: (marks: any) => number | null) => {
                          let sum = 0;
                          let count = 0;
                          previewData.rows.forEach((row: any) => {
                            const marksObj = row.subjects[previewSubjectId] || {};
                            const val = extractor(marksObj);
                            if (val !== null && val !== undefined) {
                              sum += val;
                              count++;
                            }
                          });
                          return count > 0 ? (sum / count).toFixed(1) : "N/A";
                        };

                        const getMidAvgClass = () => {
                          let sum = 0;
                          let count = 0;
                          previewData.rows.forEach((row: any) => {
                            const marksObj = row.subjects[previewSubjectId] || {};
                            const m1 = marksObj.mid1Scaled;
                            const m2 = marksObj.mid2Scaled;
                            const available = [m1, m2].filter(v => v !== null && v !== undefined) as number[];
                            if (available.length > 0) {
                              sum += available.reduce((a, b) => a + b, 0) / available.length;
                              count++;
                            }
                          });
                          return count > 0 ? (sum / count).toFixed(1) : "N/A";
                        };

                        const classAvgMid1 = getAvg((m) => m.mid1);
                        const classAvgMid1Scaled = getAvg((m) => m.mid1Scaled);
                        const classAvgMid2 = getAvg((m) => m.mid2);
                        const classAvgMid2Scaled = getAvg((m) => m.mid2Scaled);
                        const classAvgMidAvg = getMidAvgClass();
                        const classAvgAssign = getAvg((m) => m.assignment);
                        const classAvgInternal = getAvg((m) => m.internal);

                        return (
                          <>
                            {/* Subject-Wise Report Headers */}
                            <thead>
                              <tr className="bg-slate-50 border border-black text-slate-600 font-bold uppercase">
                                <th className="px-4 py-3 text-center border border-black w-12">S.No</th>
                                <th className="px-4 py-3 text-center border border-black w-28">Roll Number</th>
                                <th className="px-4 py-3 border border-black">Student Name</th>
                                {showAttendance && (
                                  <th className="px-4 py-3 text-center border border-black min-w-[90px]">Attendance %</th>
                                )}
                                {(() => {
                                  const targetSubject = previewData.subjects.find((s: any) => s.id === previewSubjectId);
                                  const isLab = targetSubject?.type?.toUpperCase() === "LAB";
                                  return (
                                    <>
                                      <th className="px-4 py-3 text-center border border-black">MID-I {isLab ? "(50M)" : "(30M)"}</th>
                                      <th className="px-4 py-3 text-center border border-black">MID-I {isLab ? "(50M)" : "(20M)"}</th>
                                      <th className="px-4 py-3 text-center border border-black">MID-II {isLab ? "(50M)" : "(30M)"}</th>
                                      <th className="px-4 py-3 text-center border border-black">MID-II {isLab ? "(50M)" : "(20M)"}</th>
                                      <th className="px-4 py-3 text-center border border-black text-amber-700 font-bold">MID Avg {isLab ? "(50M)" : "(20M)"}</th>
                                      <th className="px-4 py-3 text-center border border-black">Assign (10M)</th>
                                      <th className="px-4 py-3 text-center border border-black font-bold">Final {isLab ? "(50M)" : "(30M)"}</th>
                                    </>
                                  );
                                })()}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-slate-700">
                              {previewData.rows.map((row: any, idx: number) => {
                                const marksObj = row.subjects[previewSubjectId] || { mid1: null, mid1Scaled: null, mid2: null, mid2Scaled: null, assignment: null, internal: 0 };
                                
                                const m1 = marksObj.mid1Scaled;
                                const m2 = marksObj.mid2Scaled;
                                const available = [m1, m2].filter(v => v !== null && v !== undefined) as number[];
                                const midAvgVal = available.length > 0 ? available.reduce((a, b) => a + b, 0) / available.length : null;

                                const targetSubject = previewData.subjects.find((s: any) => s.id === previewSubjectId);
                                const isLab = targetSubject?.type?.toUpperCase() === "LAB";
                                const fields = [
                                  { val: marksObj.mid1, max: isLab ? 50 : 30, fallback: "AB" },
                                  { val: marksObj.mid1Scaled, max: isLab ? 50 : 20, fallback: "AB" },
                                  { val: marksObj.mid2, max: isLab ? 50 : 30, fallback: "AB" },
                                  { val: marksObj.mid2Scaled, max: isLab ? 50 : 20, fallback: "AB" },
                                  { val: midAvgVal, max: isLab ? 50 : 20, fallback: "AB", isMidAvg: true },
                                  { val: marksObj.assignment, max: 10, fallback: "0" },
                                  { val: marksObj.internal, max: isLab ? 50 : 30, fallback: "0", isBold: true }
                                ];

                                return (
                                  <tr key={row.rollNumber} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-2.5 text-center border border-black">{idx + 1}</td>
                                    <td className="px-4 py-2.5 text-center border border-black">
                                      <Link href={`/admin/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-bold transition-colors">
                                        {row.rollNumber}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-2.5 border border-black">
                                      <Link href={`/admin/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-medium transition-colors">
                                        {row.name}
                                      </Link>
                                    </td>
                                    {showAttendance && (
                                      <td className="px-4 py-2.5 text-center font-bold border border-black">
                                        {attendanceMap[row.studentId] !== undefined ? `${attendanceMap[row.studentId]}%` : "0%"}
                                      </td>
                                    )}
                                    {fields.map((f, fIdx) => {
                                      const displayVal = (f.val !== null && f.val !== undefined) ? Math.round(f.val).toString() : f.fallback;
                                      
                                      let colorClass = "";
                                      if (showHeatmap && displayVal !== "AB" && displayVal !== "") {
                                        const parsedVal = parseFloat(displayVal);
                                        if (!isNaN(parsedVal)) {
                                          const pct = (parsedVal / f.max) * 100;
                                          if (pct < 40) colorClass = "bg-red-50 text-red-700 border border-black";
                                          else if (pct <= 60) colorClass = "bg-amber-50 text-amber-700 border border-black";
                                          else colorClass = "bg-emerald-50 text-emerald-700 border border-black";
                                        }
                                      } else if (displayVal === "AB") {
                                        colorClass = "bg-slate-100 text-slate-400 border border-black";
                                      }

                                      return (
                                        <td key={fIdx} className={`px-4 py-2.5 text-center text-sm font-bold border border-black ${f.isMidAvg ? "bg-amber-50/50 text-amber-900" : ""} ${colorClass}`}>
                                          {displayVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 border-t border-b border-slate-200 font-bold text-slate-800">
                                <td className="px-4 py-3 text-center border border-black"></td>
                                <td className="px-4 py-3 text-center border border-black"></td>
                                <td className="px-4 py-3 font-bold border border-black text-right uppercase text-[10px] text-slate-500">Class Average</td>
                                {showAttendance && <td className="px-4 py-3 text-center border border-black"></td>}
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black text-slate-700">{classAvgMid1}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black text-slate-700">{classAvgMid1Scaled}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black text-slate-700">{classAvgMid2}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black text-slate-700">{classAvgMid2Scaled}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black text-amber-800 bg-amber-50/70">{classAvgMidAvg}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black text-slate-700">{classAvgAssign}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold border border-black font-extrabold text-blue-700 bg-blue-50/30">{classAvgInternal}</td>
                              </tr>
                            </tfoot>
                          </>
                        );
                      })()}
                    </table>
                  );
                })()}
              </div>

                  {/* Attendance Statistics Section below the table */}
                  {previewType !== "SUBJECT" && previewType !== "FINAL" && (() => {
                    const attStats = getAttendanceStats();
                    return (
                      <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start gap-6 print:hidden">
                        <div className="text-xs text-slate-500 max-w-md">
                          <p className="font-semibold text-slate-700 mb-1 text-sm">Report Insights & Statistics</p>
                          <p className="leading-relaxed">The subject-wise columns in the footer display real-time class averages and grade distributions. Toggle the <strong className="text-slate-700">Show Attendance</strong> button to load active attendance percentages and populate the overall Attendance Statistics card.</p>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm w-72">
                          <h5 className="text-xs font-bold text-slate-700 uppercase mb-3 text-center tracking-wider">Attendance Statistics</h5>
                          <table className="w-full text-xs border-collapse bg-white">
                            <tbody>
                              <tr>
                                <td rowSpan={5} className="px-3 py-2 border border-slate-200 font-bold text-center bg-slate-50 text-slate-700 w-24">Attendance</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold font-mono bg-slate-50 text-slate-600">(&gt;75%)</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold text-slate-800">{attStats.count75Plus}</td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold font-mono bg-slate-50 text-slate-600">(65 to 74%)</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold text-slate-800">{attStats.count65To74}</td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold font-mono bg-slate-50 text-slate-600">(65 to 50%)</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold text-slate-800">{attStats.count50To64}</td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold font-mono bg-slate-50 text-slate-600">(&lt;50 %)</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold text-slate-800">{attStats.countBelow50}</td>
                              </tr>
                              <tr>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold font-mono bg-slate-50 text-slate-600">(=0%)</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-bold text-slate-800">{attStats.countZero}</td>
                              </tr>
                              <tr className="bg-slate-50">
                                <td colSpan={2} className="px-3 py-2 border border-slate-200 text-center font-bold text-slate-700">Total</td>
                                <td className="px-3 py-2 border border-slate-200 text-center font-extrabold text-slate-900 bg-white">{attStats.totalCalculated}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "co-po-mapping" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">CO-PO Course Outcomes Mapping</h3>
                <p className="text-sm text-slate-500">Configure Course Outcomes (CO) to Program Outcomes (PO) mapping matrices for all department subjects.</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">Subjects Catalog</h4>
                    <p className="text-xs text-slate-500">List of subjects registered for the selected filters.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                    {reportSubjects.filter(sub => {
                      if (searchQuery.trim() !== "") {
                        const q = searchQuery.toLowerCase();
                        return sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q);
                      }
                      return true;
                    }).length} Subjects
                  </span>
                </div>

                {reportSubjects.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4">No subjects found for the selected department, year, and semester filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-bold uppercase text-slate-400">
                          <th className="pb-3 px-4">Subject Name</th>
                          <th className="pb-3 px-4">Code</th>
                          <th className="pb-3 px-4">Type</th>
                          <th className="pb-3 px-4">Regulation</th>
                          <th className="pb-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {reportSubjects
                          .filter(sub => {
                            if (searchQuery.trim() !== "") {
                              const q = searchQuery.toLowerCase();
                              return sub.name.toLowerCase().includes(q) || sub.code.toLowerCase().includes(q);
                            }
                            return true;
                          })
                          .map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-semibold text-slate-800">{sub.name}</td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-500">{sub.code}</td>
                              <td className="py-3 px-4">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  sub.type?.toUpperCase() === "LAB"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}>
                                  {sub.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{sub.regulation?.name || "R22"}</td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${sub.id}`)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                  >
                                    <FaClipboardList size={11} /> CO-PO Mapping
                                  </button>
                                  <button
                                    onClick={() => router.push(`/faculty/mid-exam/co-pso-mapping?subjectId=${sub.id}`)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                  >
                                    <FaClipboardList size={11} /> CO-PSO Mapping
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "analysis" && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 font-sans">Mid Exam Performance & Attendance Analysis</h3>
                <p className="text-sm text-slate-500">Analyze class performance, difficulty index, and correlate attendance with academic results</p>
              </div>

              {/* Selection filters */}
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Target Class Section</label>
                    <div className="flex items-center gap-2 font-medium text-slate-800 text-sm">
                      {selectedSection ? (
                        <span>
                          Sec {sections.find(s => s.id === selectedSection)?.name || selectedSection}
                        </span>
                      ) : (
                        <span className="text-red-500 font-semibold">Please select a section from the filter bar at the top</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Mid Exam Type</label>
                    <div className="flex gap-2">
                      {(["MID_I", "MID_II"] as const).map(examType => (
                        <button
                          key={examType}
                          onClick={() => setSelectedAnalysisExamType(examType)}
                          className={`flex-1 rounded-xl py-2.5 text-xs font-semibold shadow-sm transition-colors ${
                            selectedAnalysisExamType === examType
                              ? "bg-blue-600 text-white"
                              : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {examType === "MID_I" ? "MID - I" : "MID - II"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {!selectedSection ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-100">
                  <FaClipboardList className="mb-4 h-12 w-12 text-slate-300" />
                  <p className="text-lg font-semibold text-slate-600">No Section Selected</p>
                  <p className="text-sm text-slate-400">Please choose a specific Section from the top filter bar to load the analysis report.</p>
                </div>
              ) : fetchingAnalysis ? (
                <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
              ) : !analysisData ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-100">
                  <FaClipboardList className="mb-4 h-12 w-12 text-slate-300" />
                  <p className="text-lg font-semibold text-slate-600">No Data Available</p>
                  <p className="text-sm text-slate-400">No mid exam analysis data found for the selected section and parameters.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Meta info & Action row */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">
                        {analysisData.metadata.year} Year {analysisData.metadata.semester} Sem {analysisData.metadata.examType === "MID_I" ? "I Mid" : "II Mid"} Analysis (AY: {analysisData.metadata.academicYear})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Branch: {analysisData.metadata.department} ({analysisData.metadata.departmentCode}) | Section: {analysisData.metadata.section}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={downloadAnalysisExcel}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                      >
                        <FaFileExcel size={12} /> Export Excel
                      </button>
                      <button
                        onClick={() => generateAnalysisPDF(analysisData)}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
                      >
                        <FaDownload size={12} /> Download PDF
                      </button>
                    </div>
                  </div>

                  {/* Table 1: Subject-wise Mid Analysis */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                    <h4 className="text-md font-bold text-slate-800">Subject-wise Performance & Difficulty Analysis</h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                            <th className="px-4 py-3 text-center border-r border-slate-200">S.No</th>
                            <th className="px-4 py-3 border-r border-slate-200">Subject Code</th>
                            <th className="px-4 py-3 border-r border-slate-200">Subject Name</th>
                            <th className="px-4 py-3 text-center border-r border-slate-200">Strength</th>
                            <th className="px-4 py-3 text-center border-r border-slate-200">Absentees</th>
                            <th className="px-4 py-3 text-center border-r border-slate-200 font-bold">Average Marks</th>
                            <th className="px-4 py-3 text-center border-r border-slate-200">Gap</th>
                            <th className="px-4 py-3 text-center border-r border-slate-200">Diff Index (%)</th>
                            <th className="px-4 py-3 text-center border-r border-slate-200">Insight</th>
                            <th className="px-4 py-3 text-center">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700 font-bold">
                          {analysisData.subjectAnalysis.map((sub: any) => (
                            <tr key={sub.subjectId} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-center border-r border-slate-200">{sub.sNo}</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-mono">{sub.subjectCode}</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-medium">{sub.subjectName}</td>
                              <td className="px-4 py-3 text-center border-r border-slate-200">{sub.classStrength}</td>
                              <td className="px-4 py-3 text-center border-r border-slate-200 text-red-600 font-semibold">{sub.absentees}</td>
                              <td className="px-4 py-3 text-center border-r border-slate-200 font-bold text-slate-900">{sub.average}</td>
                              <td className="px-4 py-3 text-center border-r border-slate-200">{sub.gap}</td>
                              <td className="px-4 py-3 text-center border-r border-slate-200 font-semibold">{sub.difficultyIndex}%</td>
                              <td className="px-4 py-3 text-center border-r border-slate-200">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  sub.insight === "Good" ? "bg-emerald-100 text-emerald-700" :
                                  sub.insight === "Moderate" ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                                }`}>
                                  {sub.insight}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  sub.remarks === "Easy" ? "bg-emerald-100 text-emerald-700" :
                                  sub.remarks === "Moderate" ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                                }`}>
                                  {sub.remarks}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Grid for Table 2 & Matrix */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {/* Table 2: Performance Levels */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4 md:col-span-1">
                      <h4 className="text-md font-bold text-slate-800">Performance Levels</h4>
                      <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                              <th className="px-4 py-3 border-r border-slate-200">Performance Category</th>
                              <th className="px-4 py-3 text-center">Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700 font-bold">
                            <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 border-r border-slate-200 font-medium text-emerald-700">Top Performers (&ge;18)</td>
                              <td className="px-4 py-3 text-center font-bold">{analysisData.performance.top}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 border-r border-slate-200 font-medium text-amber-700">Middle Performers (12-17.9)</td>
                              <td className="px-4 py-3 text-center font-bold">{analysisData.performance.middle}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 border-r border-slate-200 font-medium text-red-700">Low Performers (&lt;12)</td>
                              <td className="px-4 py-3 text-center font-bold">{analysisData.performance.low}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Table 3: Matrix */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4 md:col-span-2">
                      <h4 className="text-md font-bold text-slate-800">Attendance vs Performance Correlation Matrix</h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-center">
                              <th className="px-4 py-3 text-left border-r border-slate-200">Attendance / Performance</th>
                              <th className="px-4 py-3 border-r border-slate-200">Top Performers (&ge;18)</th>
                              <th className="px-4 py-3 border-r border-slate-200">Middle Performers (12-17.9)</th>
                              <th className="px-4 py-3">Low Performers (&lt;12)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700 text-center font-bold">
                            <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-left border-r border-slate-200 font-medium">High Attendance (&ge;75%)</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-bold text-emerald-600">{analysisData.matrix.highAttHighPerf}</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-bold text-amber-600">{analysisData.matrix.highAttMediumPerf}</td>
                              <td className="px-4 py-3 font-bold text-red-600">{analysisData.matrix.highAttLowPerf}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-left border-r border-slate-200 font-medium">Medium Attendance (65%-74.9%)</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-bold text-emerald-600">{analysisData.matrix.mediumAttHighPerf}</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-bold text-amber-600">{analysisData.matrix.mediumAttMediumPerf}</td>
                              <td className="px-4 py-3 font-bold text-red-600">{analysisData.matrix.mediumAttLowPerf}</td>
                            </tr>
                            <tr className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-left border-r border-slate-200 font-medium">Low Attendance (&lt;65%)</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-bold text-emerald-600">{analysisData.matrix.lowAttHighPerf}</td>
                              <td className="px-4 py-3 border-r border-slate-200 font-bold text-amber-600">{analysisData.matrix.lowAttMediumPerf}</td>
                              <td className="px-4 py-3 font-bold text-red-600">{analysisData.matrix.lowAttLowPerf}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Visual Charts */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Attendance vs Performance Stacked Bar Chart */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                      <h4 className="text-md font-bold text-slate-800">Attendance vs Performance Distribution</h4>
                      <div className="h-80 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: "High Att (>=75%)",
                                "Top Performer": analysisData.matrix.highAttHighPerf,
                                "Middle Performer": analysisData.matrix.highAttMediumPerf,
                                "Low Performer": analysisData.matrix.highAttLowPerf,
                              },
                              {
                                name: "Medium Att (65%-74.9%)",
                                "Top Performer": analysisData.matrix.mediumAttHighPerf,
                                "Middle Performer": analysisData.matrix.mediumAttMediumPerf,
                                "Low Performer": analysisData.matrix.mediumAttLowPerf,
                              },
                              {
                                name: "Low Att (<65%)",
                                "Top Performer": analysisData.matrix.lowAttHighPerf,
                                "Middle Performer": analysisData.matrix.lowAttMediumPerf,
                                "Low Performer": analysisData.matrix.lowAttLowPerf,
                              },
                            ]}
                            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <RechartsLegend />
                            <Bar dataKey="Top Performer" stackId="a" fill="#10b981" />
                            <Bar dataKey="Middle Performer" stackId="a" fill="#f59e0b" />
                            <Bar dataKey="Low Performer" stackId="a" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Subject-wise Analysis Grouped Bar Chart */}
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-4">
                      <h4 className="text-md font-bold text-slate-800">Subject Performance & Difficulty Index</h4>
                      <div className="h-80 w-full text-xs">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analysisData.subjectAnalysis.map((item: any) => ({
                              name: item.subjectCode || item.subjectName,
                              Average: item.average,
                              Gap: item.gap,
                              "Diff Index (%)": item.difficultyIndex,
                            }))}
                            margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <RechartsTooltip />
                            <RechartsLegend />
                            <Bar dataKey="Average" fill="#3b82f6" />
                            <Bar dataKey="Gap" fill="#f59e0b" />
                            <Bar dataKey="Diff Index (%)" fill="#ef4444" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Scheme Modal */}
      <Modal isOpen={showSchemeModal} onClose={() => setShowSchemeModal(false)} title={schemeForm.id ? "Edit Evaluation Scheme" : "Add Evaluation Scheme"} maxWidth="max-w-md">
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Name *</label>
            <input
              type="text"
              value={schemeForm.name}
              onChange={e => setSchemeForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Theory Scheme, Practical Scheme"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject Type</label>
            <select
              value={schemeForm.subjectType}
              onChange={e => setSchemeForm(f => ({ ...f, subjectType: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="THEORY">THEORY</option>
              <option value="LAB">LAB (PRACTICAL)</option>
              <option value="OPEN_ELECTIVE">OPEN ELECTIVE</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">MID Max Marks</label>
              <input
                type="number"
                value={schemeForm.mid1MaxMarks}
                onChange={e => setSchemeForm(f => ({ ...f, mid1MaxMarks: parseFloat(e.target.value) || 0, mid2MaxMarks: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">MID Scaled To</label>
              <input
                type="number"
                value={schemeForm.mid1ScaledTo}
                onChange={e => setSchemeForm(f => ({ ...f, mid1ScaledTo: parseFloat(e.target.value) || 0, mid2ScaledTo: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Assignment Max</label>
              <input
                type="number"
                value={schemeForm.assignmentMax}
                onChange={e => setSchemeForm(f => ({ ...f, assignmentMax: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Final Internal Max</label>
              <input
                type="number"
                value={schemeForm.internalMax}
                onChange={e => setSchemeForm(f => ({ ...f, internalMax: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={schemeForm.isDefault}
              onChange={e => setSchemeForm(f => ({ ...f, isDefault: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-semibold text-slate-700">Set as Default Scheme</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setShowSchemeModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleSaveScheme}
              disabled={savingScheme}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingScheme ? <FaSpinner className="animate-spin" /> : null}
              {savingScheme ? "Saving..." : "Save Scheme"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Publish Marks Modal */}
      <Modal isOpen={showPublishModal} onClose={() => setShowPublishModal(false)} title="Publish Exam Marks" maxWidth="max-w-md">
        <div className="space-y-4 p-6">
          <div className="text-slate-600 text-sm">
            <p className="font-semibold text-slate-800 mb-2">Are you sure you want to publish marks?</p>
            <p className="mb-1"><span className="font-semibold text-slate-700">Subject:</span> {selectedPaperForPublish?.subject?.name} ({selectedPaperForPublish?.subject?.code})</p>
            <p className="mb-1"><span className="font-semibold text-slate-700">Section:</span> Sec {selectedPaperForPublish?.section?.name}</p>
            <p className="mb-1"><span className="font-semibold text-slate-700">Exam:</span> {selectedPaperForPublish?.examType?.replace("_", " ")}</p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowPublishModal(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={executePublish}
              className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Publish Marks
            </button>
          </div>
        </div>
      </Modal>

      {/* Send SMS Checklist Modal */}
      <Modal isOpen={showSMSModal} onClose={() => setShowSMSModal(false)} title={`Send ${smsExamType.replace("_", " ")} SMS to Parents`} maxWidth="max-w-2xl">
        <div className="space-y-5 p-6">
          {/* Unpublished Warning */}
          {smsUnpublishedSubjects.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-800">
              <div className="flex gap-2 font-bold mb-1 items-center">
                <span className="text-base">⚠️</span> Warning: The following subjects did not publish marks yet:
              </div>
              <ul className="list-disc pl-5 mb-3 font-semibold space-y-0.5">
                {smsUnpublishedSubjects.map((s: any) => (
                  <li key={s.id}>{s.code} - {s.name}</li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-2 border-t border-amber-200/50">
                <input
                  type="checkbox"
                  id="allowUnpublishedOverride"
                  checked={allowUnpublishedOverride}
                  onChange={e => setAllowUnpublishedOverride(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                />
                <label htmlFor="allowUnpublishedOverride" className="font-bold cursor-pointer select-none">
                  I understand, proceed sending marks anyway (unpublished subjects will show as N/A or -).
                </label>
              </div>
            </div>
          )}

          {/* SMS Text Template Preview */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message Template Preview</h4>
            <div className="bg-white rounded-lg p-3 border border-slate-100 shadow-inner max-h-[160px] overflow-y-auto">
              <p className="text-[10px] md:text-xs text-slate-600 font-mono leading-relaxed whitespace-pre-wrap">
{`Dear Parent,
Your ward [Student Name],
${smsExamType === "MID_II" ? "II" : "I"} Year ${selectedSem === "2" ? "II" : selectedSem === "1" ? "I" : selectedSem === "3" ? "III" : selectedSem === "4" ? "IV" : selectedSem} sem ${smsExamType === "MID_II" ? "II" : "I"} Mid
Examination marks are as
follows:
subject 1:[Sub 1 Name] Marks:
[Sub 1 Marks]
subject 2:[Sub 2 Name]
Marks: [Sub 2 Marks]
subject 3:[Sub 3 Name] Marks:
[Sub 3 Marks]
subject 4:[Sub 4 Name] Marks:
[Sub 4 Marks]
subject 5:[Sub 5 Name] Marks: [Sub 5 Marks]
Please Contact HOD for any
queries.
Gayatri Vidya Parishad`}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">
              Note: Layout formatted with explicit newlines as per DLT registered template. Ward roll numbers are not included in the template text.
            </p>
          </div>

          {/* Student Selector Checklist */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Select Students ({selectedSmsStudentIds.size} selected / {smsStudents.length} total)
              </h4>
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <input
                  type="text"
                  placeholder="Search roll number or name..."
                  value={smsSearchQuery}
                  onChange={e => setSmsSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm w-[200px]"
                />
                
                {/* Select All */}
                <button
                  type="button"
                  onClick={() => {
                    const filtered = smsStudents.filter((s: any) =>
                      s.rollNumber.toLowerCase().includes(smsSearchQuery.toLowerCase()) ||
                      s.name.toLowerCase().includes(smsSearchQuery.toLowerCase())
                    );
                    const allSelected = filtered.every(s => selectedSmsStudentIds.has(s.id));
                    const newSet = new Set(selectedSmsStudentIds);
                    if (allSelected) {
                      filtered.forEach(s => newSet.delete(s.id));
                    } else {
                      filtered.forEach(s => newSet.add(s.id));
                    }
                    setSelectedSmsStudentIds(newSet);
                  }}
                  className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors"
                >
                  {smsStudents.filter((s: any) =>
                    s.rollNumber.toLowerCase().includes(smsSearchQuery.toLowerCase()) ||
                    s.name.toLowerCase().includes(smsSearchQuery.toLowerCase())
                  ).every(s => selectedSmsStudentIds.has(s.id)) ? "Deselect Filtered" : "Select Filtered"}
                </button>
              </div>
            </div>

            {/* Checklist Box */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-2">
              {loadingSmsStudents ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <FaSpinner className="animate-spin text-blue-500" size={24} />
                  <span className="text-xs font-medium">Fetching students list...</span>
                </div>
              ) : smsStudents.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-400 font-medium">
                  No active students found in this section.
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 pr-1">
                  {smsStudents.filter((s: any) =>
                    s.rollNumber.toLowerCase().includes(smsSearchQuery.toLowerCase()) ||
                    s.name.toLowerCase().includes(smsSearchQuery.toLowerCase())
                  ).map((student: any) => {
                    const isChecked = selectedSmsStudentIds.has(student.id);
                    return (
                      <label
                        key={student.id}
                        className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-slate-50 transition-colors ${
                          isChecked ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const newSet = new Set(selectedSmsStudentIds);
                              if (isChecked) {
                                newSet.delete(student.id);
                              } else {
                                newSet.add(student.id);
                              }
                              setSelectedSmsStudentIds(newSet);
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span className="font-mono font-bold text-slate-800">{student.rollNumber}</span>
                          <span className="text-slate-600 font-medium">{student.name}</span>
                        </div>
                        <span className="text-slate-400 font-mono">{student.mobile || student.studentContactNumber || "No mobile"}</span>
                      </label>
                    );
                  })}
                  {smsStudents.filter((s: any) =>
                    s.rollNumber.toLowerCase().includes(smsSearchQuery.toLowerCase()) ||
                    s.name.toLowerCase().includes(smsSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="flex items-center justify-center py-8 text-xs text-slate-400 font-medium">
                      No matching students.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setShowSMSModal(false)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeSendSMS}
              disabled={sendingSMS || loadingSmsStudents || selectedSmsStudentIds.size === 0 || (smsUnpublishedSubjects.length > 0 && !allowUnpublishedOverride)}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sendingSMS ? <FaSpinner className="animate-spin" size={14} /> : <FaPaperPlane size={12} />}
              {sendingSMS ? "Sending SMS..." : `Send SMS (${selectedSmsStudentIds.size})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Popup */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg transition-all ${
          toast.type === "success" ? "bg-emerald-600" : toast.type === "info" ? "bg-blue-600" : "bg-red-600"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
