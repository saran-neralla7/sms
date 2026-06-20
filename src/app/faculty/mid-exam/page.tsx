"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaFileAlt, FaPen, FaLock, FaUnlock, FaCheckCircle, FaClipboardList,
  FaChevronRight, FaBook, FaLayerGroup, FaCalendarAlt, FaSpinner,
  FaPlus, FaEye, FaDownload, FaFileExcel, FaFlask
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

interface Mapping {
  id: string;
  subject: { id: string; name: string; code: string; type: string; year: string; semester: string; departmentId: string };
  section: { id: string; name: string };
  academicYear: { id: string; name: string };
}

interface Paper {
  id: string;
  examType: string;
  isFrozen: boolean;
  totalMarks: number;
  subjectId: string;
  sectionId: string;
  subject: { id: string; name: string; code: string; type: string; department?: { code: string } };
  section?: { id: string; name: string };
  publishRecord: { isLocked: boolean; isPublished: boolean } | null;
  _count?: { marksEntries: number };
  isCommon?: boolean;
  commonText?: string | null;
  masterPaperId?: string | null;
}

export default function FacultyMidExamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string; isCurrent: boolean }[]>([]);
  const [selectedAY, setSelectedAY] = useState("");
  const [creating, setCreating] = useState(false);

  // Create paper modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<{
    mappingId: string;
    examType: string;
    totalMarks: number;
    createMode: "independent" | "linked";
    sourcePaperId?: string;
    masterPaperId?: string;
    isCommon: boolean;
    commonText: string;
  }>({
    mappingId: "",
    examType: "MID_I",
    totalMarks: 30,
    createMode: "independent",
    sourcePaperId: "",
    masterPaperId: "",
    isCommon: false,
    commonText: "",
  });
  const [createError, setCreateError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [activeTab, setActiveTab] = useState<"assigned" | "reports" | "analysis">("assigned");

  useEffect(() => {
    const savedTab = sessionStorage.getItem("faculty_mid_exam_active_tab");
    if (savedTab && ["assigned", "reports", "analysis"].includes(savedTab)) {
      setActiveTab(savedTab as any);
    }
  }, []);

  // Save active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("faculty_mid_exam_active_tab", activeTab);
  }, [activeTab]);

  // Reports states
  const [selectedMappingId, setSelectedMappingId] = useState("");

  const isRestored = useRef(false);

  // Save filters to sessionStorage
  useEffect(() => {
    if (isRestored.current && selectedAY) {
      sessionStorage.setItem("faculty_mid_exam_filter_ay", selectedAY);
    }
  }, [selectedAY]);

  useEffect(() => {
    if (isRestored.current && selectedMappingId) {
      sessionStorage.setItem("faculty_mid_exam_filter_mapping", selectedMappingId);
    }
  }, [selectedMappingId]);

  // Analysis states
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [fetchingAnalysis, setFetchingAnalysis] = useState<boolean>(false);
  const [selectedAnalysisExamType, setSelectedAnalysisExamType] = useState<"MID_I" | "MID_II">("MID_I");

  // Reports states
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [previewType, setPreviewType] = useState<"MID_I" | "MID_II" | "ASSIGNMENT" | "FINAL" | "SUBJECT" | null>(null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [fetchingReport, setFetchingReport] = useState<boolean>(false);
  const [tableWidth, setTableWidth] = useState(0);
  const [showAttendance, setShowAttendance] = useState<boolean>(false);
  const [fetchingAttendance, setFetchingAttendance] = useState<boolean>(false);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, number>>({});

  const [showLabMarks, setShowLabMarks] = useState<boolean>(false);

  useEffect(() => {
    setPreviewData(null);
    setPreviewType(null);
    setShowAttendance(false);
    setAttendanceMap({});
    setAnalysisData(null);
    setShowLabMarks(false);
  }, [selectedMappingId, selectedAnalysisExamType]);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

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

  // Sync scrollbar width
  useEffect(() => {
    const updateWidth = () => {
      if (tableScrollRef.current) {
        setTableWidth(tableScrollRef.current.scrollWidth);
      }
    };
    updateWidth();
    const timer = setTimeout(updateWidth, 150);
    let observer: ResizeObserver | null = null;
    if (tableScrollRef.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(tableScrollRef.current);
    }
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [previewData, previewType]);

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

  const fetchAnalysis = useCallback(async () => {
    const mapping = mappings.find(m => m.id === selectedMappingId);
    if (!mapping) {
      showToast("Select a subject & section to view analysis", "error");
      return;
    }
    setFetchingAnalysis(true);
    try {
      const deptId = mapping.subject.departmentId || (session?.user as any).departmentId;
      const res = await fetch(
        `/api/mid-exam/analysis?academicYearId=${mapping.academicYear.id}&departmentId=${deptId}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&sectionId=${mapping.section.id}&examType=${selectedAnalysisExamType}`
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
  }, [selectedMappingId, selectedAnalysisExamType, mappings, session]);

  useEffect(() => {
    if (activeTab === "analysis" && selectedMappingId) {
      fetchAnalysis();
    }
  }, [activeTab, selectedMappingId, selectedAnalysisExamType, fetchAnalysis]);

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
        sub.average,
        sub.gap,
        sub.difficultyIndex,
        sub.insight,
        sub.remarks
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
    XLSX.utils.book_append_sheet(wb, ws1, "Subject-wise Analysis");

    const ws2Data = [
      ["PERFORMANCE LEVEL SUMMARY"],
      ["Performance Level", "Score Range (Scaled to 30)", "Count"],
      ["Top Performers", ">= 18 Marks", performance.top],
      ["Middle Performers", "12 - 17.9 Marks", performance.middle],
      ["Low Performers", "< 12 Marks", performance.low],
      [],
      ["ATTENDANCE VS PERFORMANCE MATRIX (3x3)"],
      ["Attendance / Performance", "Top Performers (>=18)", "Middle Performers (12-17.9)", "Low Performers (<12)"],
      ["High Attendance (>=75%)", matrix.highAttHighPerf, matrix.highAttMediumPerf, matrix.highAttLowPerf],
      ["Medium Attendance (65%-74.9%)", matrix.mediumAttHighPerf, matrix.mediumAttMediumPerf, matrix.mediumAttLowPerf],
      ["Low Attendance (<65%)", matrix.lowAttHighPerf, matrix.lowAttMediumPerf, matrix.lowAttLowPerf]
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
    XLSX.utils.book_append_sheet(wb, ws2, "Performance & Correlation");

    XLSX.writeFile(wb, `Mid_Analysis_${metadata.year}Y_${metadata.semester}S_Sec${metadata.section}_${metadata.examType}.xlsx`);
  };

  const generateAnalysisPDF = (data: any) => {
    const { metadata, subjectAnalysis, performance, matrix } = data;
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("GAYATRI VIDYA PARISHAD COLLEGE FOR DEGREE AND P.G. COURSES", 105, 15, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("(Autonomous)", 105, 20, { align: "center" });
    doc.text("Re-Accredited by NAAC | Visakhapatnam", 105, 24, { align: "center" });

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 28, 182, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${metadata.year} Year ${metadata.semester} Sem ${metadata.examType === "MID_I" ? "I Mid" : "II Mid"} Analysis (AY: ${metadata.academicYear})`, 105, 34, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Branch:", 14, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`${metadata.department} (${metadata.departmentCode || ""})`, 30, 45);

    doc.setFont("helvetica", "bold");
    doc.text("Section:", 120, 45);
    doc.setFont("helvetica", "normal");
    doc.text(`SECTION - ${metadata.section}`, 135, 45);

    const subjectHeaders = [
      ["S.No", "Subject", "Strength", "Absentees", "Average", "Insight", "Gap", "Diff Index (%)", "Remarks"]
    ];
    const subjectRows = subjectAnalysis.map((sub: any) => [
      sub.sNo,
      sub.subjectName,
      sub.classStrength,
      sub.absentees,
      sub.average,
      sub.insight,
      sub.gap,
      `${sub.difficultyIndex}%`,
      sub.remarks
    ]);

    autoTable(doc, {
      startY: 50,
      head: subjectHeaders,
      body: subjectRows,
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      styles: { fontSize: 8, halign: "center" },
      columnStyles: {
        1: { halign: "left" }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("Performance Levels", 14, currentY);

    const perfHeaders = [
      ["Top Performers (>=18)", "Middle Performers (12-17.9)", "Low Performers (<12)"]
    ];
    const perfRows = [
      [performance.top, performance.middle, performance.low]
    ];

    autoTable(doc, {
      startY: currentY + 3,
      head: perfHeaders,
      body: perfRows,
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      styles: { fontSize: 9, halign: "center" }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont("helvetica", "bold");
    doc.text("Attendance vs Performance Correlation (3x3)", 14, currentY);

    const matrixHeaders = [
      ["Attendance / Performance", "Top Performers (>=18)", "Middle Performers (12-17.9)", "Low Performers (<12)"]
    ];
    const matrixRows = [
      ["High Attendance (>=75%)", matrix.highAttHighPerf, matrix.highAttMediumPerf, matrix.highAttLowPerf],
      ["Medium Attendance (65%-74.9%)", matrix.mediumAttHighPerf, matrix.mediumAttMediumPerf, matrix.mediumAttLowPerf],
      ["Low Attendance (<65%)", matrix.lowAttHighPerf, matrix.lowAttMediumPerf, matrix.lowAttLowPerf]
    ];

    autoTable(doc, {
      startY: currentY + 3,
      head: matrixHeaders,
      body: matrixRows,
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      styles: { fontSize: 8, halign: "center" },
      columnStyles: {
        0: { fontStyle: "bold", halign: "left" }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Class Coordinator", 25, currentY);
    doc.text("HOD", 95, currentY);
    doc.text("Principal", 165, currentY);

    doc.save(`Mid_Analysis_${metadata.year}Year_${metadata.semester}Sem_Sec${metadata.section}_${metadata.examType}.pdf`);
  };

  const handleViewReport = async (reportType: "MID_I" | "MID_II" | "ASSIGNMENT" | "FINAL" | "SUBJECT") => {
    const mapping = mappings.find(m => m.id === selectedMappingId);
    if (!mapping) {
      showToast("Select a subject & section to view reports", "error");
      return;
    }
    setFetchingReport(true);
    try {
      const deptId = mapping.subject.departmentId || (session?.user as any).departmentId;
      const res = await fetch(`/api/mid-exam/reports/memo?academicYearId=${mapping.academicYear.id}&departmentId=${deptId}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&sectionId=${mapping.section.id}`);
      if (!res.ok) {
        showToast("Failed to fetch report data", "error");
        return;
      }
      const rawData = await res.json();
      // Filter subjects to only include the selected subject
      const filteredData = {
        ...rawData,
        subjects: rawData.subjects.filter((sub: any) => sub.id === mapping.subject.id)
      };
      setPreviewData(filteredData);
      setPreviewType(reportType);
      setShowAttendance(false);
      setAttendanceMap({});
      
      // Scroll to preview pane
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
      const subId = previewData.subjects[0]?.id;
      const promises = previewData.rows.map(async (row: any) => {
        try {
          const res = await fetch(`/api/students/${row.studentId}/stats?year=${year}&semester=${semester}`);
          if (res.ok) {
            const data = await res.json();
            if (previewType === "SUBJECT") {
              const subStat = data.subjects?.find((s: any) => s.id === subId);
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
          const subId = previewData.subjects[0]?.id;
          const promises = previewData.rows.map(async (row: any) => {
            try {
              const res = await fetch(`/api/students/${row.studentId}/stats?year=${year}&semester=${semester}`);
              if (res.ok) {
                const data = await res.json();
                if (previewType === "SUBJECT") {
                  const subStat = data.subjects?.find((s: any) => s.id === subId);
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
    const subName = previewData.subjects[0]?.name || "";
    rowsList.push([`Subject: ${subName}`]);
    rowsList.push([]);

    if (previewType !== "SUBJECT") {
      const filteredSubjects = previewData.subjects.filter((sub: any) => {
        const isLab = sub.type?.toUpperCase() === "LAB";
        if (isLab) return showLabMarks;
        return true;
      });
      const headers = ["S.No", "Roll Number", "Student Name"];
      if (includeAttendance) {
        headers.push("Attendance (%)");
      }
      filteredSubjects.forEach((sub: any) => {
        const isLab = sub.type?.toUpperCase() === "LAB";
        headers.push(`${sub.shortName || sub.name} (${isLab ? (previewType === "MID_I" ? "MID I 50M" : previewType === "MID_II" ? "MID II 50M" : previewType === "ASSIGNMENT" ? "Assign 10M" : "Final 50M") : (previewType === "MID_I" ? "MID I 30M" : previewType === "MID_II" ? "MID II 30M" : previewType === "ASSIGNMENT" ? "Assign 10M" : "Final 30M")})`);
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
      const targetSub = previewData.subjects[0];
      const isLab = targetSub?.type?.toUpperCase() === "LAB";
      headers.push(
        isLab ? "MID-I (50M)" : "MID-I (30M)",
        isLab ? "MID-I (50M)" : "MID-I (20M)",
        isLab ? "MID-II (50M)" : "MID-II (30M)",
        isLab ? "MID-II (50M)" : "MID-II (20M)",
        isLab ? "MID Avg (50M)" : "MID Avg (20M)",
        "Assign (10M)",
        isLab ? "Final (50M)" : "Final (30M)"
      );
      rowsList.push(headers);

      const subId = previewData.subjects[0]?.id;
      previewData.rows.forEach((row: any, idx: number) => {
        const marksObj = row.subjects[subId] || {};
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

  // Generate landscape PDF reports for single subject
  const generateClassReportPDF = async (reportType: "MID_I" | "MID_II" | "ASSIGNMENT" | "FINAL", cachedData: any) => {
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
        orientation: "landscape",
        unit: "mm",
        format: "a4"
      });

      const meta = cachedData.meta;
      const subjects = (cachedData.subjects || []).filter((sub: any) => {
        const isLab = sub.type?.toUpperCase() === "LAB";
        if (isLab) return showLabMarks;
        return true;
      });
      const rows = cachedData.rows || [];
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
        if (reportType === "MID_I") colHeader += `\nMID I ${isLab ? "(50M)" : "(30M)"}`;
        else if (reportType === "MID_II") colHeader += `\nMID II ${isLab ? "(50M)" : "(30M)"}`;
        else if (reportType === "ASSIGNMENT") colHeader += `\nASSIGN (10M)`;
        else if (reportType === "FINAL") colHeader += `\nFINAL ${isLab ? "(50M)" : "(30M)"}`;
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
          fontSize: 8.5,
          cellPadding: 2.5,
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
        columnStyles: {
          0: { cellWidth: 12, halign: "center" },
          1: { cellWidth: 32, halign: "center", fontStyle: "bold" },
          2: { cellWidth: 55, halign: "left" }
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
      const semStr = meta.semester ? `Sem${meta.semester}` : "";
      const secStr = meta.section ? `Sec_${meta.section}` : "";
      const deptCodeStr = meta.departmentCode || "";
      if (reportType === "MID_I") filename = `MID_I_Marks_Memo_${deptCodeStr}_${semStr}_${secStr}.pdf`;
      else if (reportType === "MID_II") filename = `MID_II_Marks_Memo_${deptCodeStr}_${semStr}_${secStr}.pdf`;
      else if (reportType === "ASSIGNMENT") filename = `Assignment_Marks_Memo_${deptCodeStr}_${semStr}_${secStr}.pdf`;
      else if (reportType === "FINAL") filename = `Final_Internal_Marks_Memo_${deptCodeStr}_${semStr}_${secStr}.pdf`;

      doc.save(filename);
      showToast("PDF generated successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("PDF generation failed", "error");
    }
  };

  // Generate portrait detailed subject report PDF
  const generateSubjectReportPDF = async (cachedData: any) => {
    try {
      showToast("Generating Detailed Subject PDF...", "success");
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

      const meta = cachedData.meta;
      const subjects = cachedData.subjects || [];
      const rows = cachedData.rows || [];

      const targetSubject = subjects[0];
      const subjectName = targetSubject ? targetSubject.name : "Subject";
      const subjectCode = targetSubject ? targetSubject.code : "";
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

      const isLab = targetSubject?.type?.toUpperCase() === "LAB";
      // Build Headers
      const headers = [
        [
          "S.No", 
          "Roll Number", 
          "Student Name", 
          `MID-I\n${isLab ? "(50M)" : "(30M)"}`, 
          `MID-I\n${isLab ? "(50M)" : "(20M)"}`, 
          `MID-II\n${isLab ? "(50M)" : "(30M)"}`, 
          `MID-II\n${isLab ? "(50M)" : "(20M)"}`, 
          `MID Avg\n${isLab ? "(50M)" : "(20M)"}`,
          "Assign\n(10M)", 
          `Final\n${isLab ? "(50M)" : "(30M)"}`
        ]
      ];

      // Build Table Data rows
      const tableRows = rows.map((r: any, idx: number) => {
        const marks = r.subjects[targetSubject.id] || { mid1: null, mid1Scaled: null, mid2: null, mid2Scaled: null, assignment: null, internal: 0 };
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
          const marks = r.subjects[targetSubject.id] || {};
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
          const marks = r.subjects[targetSubject.id] || {};
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
      const finalY = (doc as any).lastAutoTable.finalY || 240;
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

      doc.line(210 - margin - 40, sigY, 210 - margin, sigY);
      doc.text("Signature of the HOD", 210 - margin - 20, sigY + 5, { align: "center" });

      let filename = `Subject_Evaluation_${subjectCode}_Sec_${meta.section}.pdf`;
      doc.save(filename);
      showToast("PDF generated successfully!", "success");
    } catch (e) {
      console.error(e);
      showToast("PDF generation failed", "error");
    }
  };

  const loadData = useCallback(async (ayId: string) => {
    setLoading(true);
    try {
      const [mappingsRes, papersRes] = await Promise.all([
        fetch(`/api/faculty-mappings?academicYearId=${ayId}`),
        fetch(`/api/mid-exam/papers?academicYearId=${ayId}`)
      ]);
      let fetchedMappings: Mapping[] = [];
      if (mappingsRes.ok) {
        fetchedMappings = await mappingsRes.json();
        setMappings(fetchedMappings);
      }
      if (papersRes.ok) setPapers(await papersRes.json());

      const savedMapping = sessionStorage.getItem("faculty_mid_exam_filter_mapping");
      if (savedMapping && fetchedMappings.some(m => m.id === savedMapping)) {
        setSelectedMappingId(savedMapping);
      } else if (fetchedMappings.length > 0) {
        setSelectedMappingId(fetchedMappings[0].id);
      } else {
        setSelectedMappingId("");
      }
      setTimeout(() => {
        isRestored.current = true;
      }, 100);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/academic-years")
      .then(r => r.json())
      .then(data => {
        setAcademicYears(data);
        const savedAY = sessionStorage.getItem("faculty_mid_exam_filter_ay");
        const ay = savedAY && data.some((y: any) => y.id === savedAY)
          ? savedAY
          : (data.find((y: any) => y.isCurrent)?.id || data[0]?.id || "");
        setSelectedAY(ay);
        if (ay) loadData(ay);
      });
  }, [loadData]);

  useEffect(() => {
    if (selectedAY) loadData(selectedAY);
  }, [selectedAY, loadData]);

  const getSelectedMapping = () => mappings.find(m => m.id === createForm.mappingId);

  const handleCreatePaper = async () => {
    const mapping = getSelectedMapping();
    if (!mapping) { setCreateError("Select a subject-section mapping."); return; }
    setCreating(true);
    setCreateError("");
    try {
      const payload: any = {
        academicYearId: mapping.academicYear.id,
        departmentId: mapping.subject.departmentId,
        year: mapping.subject.year,
        semester: mapping.subject.semester,
        sectionId: mapping.section.id,
        subjectId: mapping.subject.id,
        examType: createForm.examType,
        totalMarks: createForm.totalMarks,
      };

      if (createForm.createMode === "linked") {
        payload.masterPaperId = createForm.masterPaperId || undefined;
        payload.commonText = createForm.commonText || undefined;
        payload.isCommon = true;
      } else {
        payload.sourcePaperId = createForm.sourcePaperId || undefined;
        payload.isCommon = createForm.isCommon;
        payload.commonText = createForm.isCommon ? createForm.commonText : undefined;
      }

      const res = await fetch("/api/mid-exam/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.paperId) {
          setShowCreateModal(false);
          router.push(`/faculty/mid-exam/paper/${data.paperId}`);
          return;
        }
        setCreateError(data.error || "Failed to create paper");
        return;
      }
      setShowCreateModal(false);
      showToast("Question paper created!", "success");
      router.push(`/faculty/mid-exam/paper/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  const getPaperForMapping = (mapping: Mapping, examType: string) =>
    papers.find(p => p.subjectId === mapping.subject.id && p.sectionId === mapping.section.id && p.examType === examType);

  const role = (session?.user as any)?.role;

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center"><LogoSpinner fullScreen={false} /></div>;

  // Group mappings by subject
  const uniqueSubjects = Array.from(new Map(
    mappings.map(m => [m.subject.id + m.section.id, m])
  ).values());

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">MID Examination</h1>
            <p className="mt-1 text-slate-500">Build question papers, enter marks, manage assessments</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedAY}
              onChange={e => setSelectedAY(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {academicYears.map(ay => (
                <option key={ay.id} value={ay.id}>{ay.name}{ay.isCurrent ? " ✓" : ""}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setCreateForm({
                  mappingId: mappings.filter(m => m.subject.type?.toUpperCase() !== "LAB")[0]?.id || "",
                  examType: "MID_I",
                  totalMarks: 30,
                  createMode: "independent",
                  sourcePaperId: "",
                  masterPaperId: "",
                  isCommon: false,
                  commonText: ""
                });
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <FaPlus size={12} /> New Paper
            </button>
          </div>
        </div>

        {/* Quick stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "My Subjects", value: uniqueSubjects.length, icon: <FaBook />, color: "blue" },
            { label: "Papers Created", value: papers.length, icon: <FaFileAlt />, color: "indigo" },
            { label: "Frozen", value: papers.filter(p => p.isFrozen).length, icon: <FaLock />, color: "amber" },
            { label: "Published", value: papers.filter(p => p.publishRecord?.isPublished).length, icon: <FaCheckCircle />, color: "emerald" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab("assigned")}
            className={`whitespace-nowrap px-4 py-2 font-semibold text-sm transition-colors ${
              activeTab === "assigned"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Assigned Subjects
          </button>
          <button
            onClick={() => {
              setActiveTab("reports");
              // Auto-select first mapping if not already selected
              if (!selectedMappingId && mappings.length > 0) {
                setSelectedMappingId(mappings[0].id);
              }
            }}
            className={`whitespace-nowrap px-4 py-2 font-semibold text-sm transition-colors ${
              activeTab === "reports"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Marks Reports
          </button>
          <button
            onClick={() => {
              setActiveTab("analysis");
              // Auto-select first mapping if not already selected
              if (!selectedMappingId && mappings.length > 0) {
                setSelectedMappingId(mappings[0].id);
              }
            }}
            className={`whitespace-nowrap px-4 py-2 font-semibold text-sm transition-colors ${
              activeTab === "analysis"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Mid Analysis
          </button>
        </div>

        {activeTab === "assigned" ? (
          loading ? (
            <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
          ) : uniqueSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-100">
              <FaBook className="mb-4 h-12 w-12 text-slate-300" />
              <p className="text-lg font-semibold text-slate-600">No subjects assigned</p>
              <p className="text-sm text-slate-400">Contact admin to assign subjects for this academic year</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uniqueSubjects.map((mapping, i) => {
                const mid1Paper = getPaperForMapping(mapping, "MID_I");
                const mid2Paper = getPaperForMapping(mapping, "MID_II");

                return (
                  <motion.div
                    key={mapping.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100"
                  >
                    {/* Subject Header */}
                    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                          <FaBook />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">{mapping.subject.name}</h3>
                          <p className="text-sm text-slate-500">
                            {mapping.subject.code} · Year {mapping.subject.year} · Sem {mapping.subject.semester} ·
                            <span className="ml-1 inline-flex items-center gap-1"><FaLayerGroup className="h-3 w-3" /> Section {mapping.section.name}</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          mapping.subject.type?.toUpperCase() === "LAB"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-blue-50 text-blue-700"
                        }`}>
                          {mapping.subject.type}
                        </span>
                      </div>
                    </div>
                    {/* MID I and MID II Cards */}
                    {mapping.subject.type?.toUpperCase() === "LAB" ? (
                      <div className="p-6">
                        <div className="rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-4 transition-all hover:bg-purple-50/50">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="font-semibold text-slate-800">Lab Internal Marks (Direct Entry)</span>
                            <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              Max: 50 Marks
                            </span>
                          </div>
                          <p className="mb-4 text-xs text-slate-500">
                            Enter direct internal evaluation marks out of 50 for the laboratory sessions.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => router.push(`/faculty/mid-exam/lab?subjectId=${mapping.subject.id}&sectionId=${mapping.section.id}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&ayId=${selectedAY}`)}
                              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-purple-700 transition-colors"
                            >
                              <FaClipboardList size={10} /> Enter Internal Marks
                            </button>
                            <button
                              onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${mapping.subject.id}`)}
                              className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                              <FaClipboardList size={10} /> CO-PO Mapping
                            </button>
                            <button
                              onClick={() => router.push(`/faculty/mid-exam/co-pso-mapping?subjectId=${mapping.subject.id}`)}
                              className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                              <FaClipboardList size={10} /> CO-PSO Mapping
                            </button>
                            <button
                              onClick={() => router.push(`/faculty/mid-exam/syllabus?subjectId=${mapping.subject.id}`)}
                              className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                              <FaFileAlt size={10} /> Syllabus
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
                          {(["MID_I", "MID_II"] as const).map(examType => {
                            const paper = examType === "MID_I" ? mid1Paper : mid2Paper;
                            const label = examType === "MID_I" ? "MID - I" : "MID - II";

                            return (
                              <div
                                key={examType}
                                className={`rounded-xl border-2 p-4 transition-all ${
                                  paper
                                    ? paper.publishRecord?.isPublished
                                      ? "border-emerald-200 bg-emerald-50"
                                      : paper.isFrozen
                                      ? "border-amber-200 bg-amber-50"
                                      : "border-blue-200 bg-blue-50"
                                    : "border-dashed border-slate-200 bg-slate-50"
                                }`}
                              >
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="font-semibold text-slate-800">{label}</span>
                                  {paper && (
                                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                      paper.publishRecord?.isPublished
                                        ? "bg-emerald-100 text-emerald-700"
                                        : paper.isFrozen
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-blue-100 text-blue-700"
                                    }`}>
                                      {paper.publishRecord?.isPublished ? <><FaCheckCircle /> Published</> :
                                       paper.isFrozen ? <><FaLock size={10} /> Frozen</> :
                                       <><FaPen size={10} /> Draft</>}
                                    </span>
                                  )}
                                </div>

                                {paper ? (
                                  <div className="space-y-2">
                                    <p className="text-xs text-slate-600">Max Marks: <strong>{paper.totalMarks}</strong></p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => router.push(`/faculty/mid-exam/paper/${paper.id}`)}
                                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
                                      >
                                        <FaPen size={10} /> {paper.isFrozen ? "View Paper" : "Edit Paper"}
                                      </button>
                                      {paper.isFrozen && (
                                        <button
                                          onClick={() => router.push(`/faculty/mid-exam/marks/${paper.id}`)}
                                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                                        >
                                          <FaClipboardList size={10} /> Enter Marks
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center py-3">
                                    <p className="mb-2 text-xs text-slate-500">No paper created yet</p>
                                    <button
                                      onClick={() => {
                                        setCreateForm({
                                          mappingId: mapping.id,
                                          examType,
                                          totalMarks: 30,
                                          createMode: "independent",
                                          sourcePaperId: "",
                                          masterPaperId: "",
                                          isCommon: false,
                                          commonText: ""
                                        });
                                        setShowCreateModal(true);
                                      }}
                                      className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
                                    >
                                      <FaPlus size={10} /> Create Paper
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Assignment marks link */}
                        <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
                          <button
                            onClick={() => router.push(`/faculty/mid-exam/assignment?subjectId=${mapping.subject.id}&sectionId=${mapping.section.id}&year=${mapping.subject.year}&semester=${mapping.subject.semester}&ayId=${selectedAY}`)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <FaClipboardList size={12} /> Assignment Marks
                            <FaChevronRight size={10} />
                          </button>
                          <button
                            onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${mapping.subject.id}`)}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                          >
                            <FaClipboardList size={12} /> CO-PO Mapping
                            <FaChevronRight size={10} />
                          </button>
                          <button
                            onClick={() => router.push(`/faculty/mid-exam/co-pso-mapping?subjectId=${mapping.subject.id}`)}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                          >
                            <FaClipboardList size={12} /> CO-PSO Mapping
                            <FaChevronRight size={10} />
                          </button>
                          <button
                            onClick={() => router.push(`/faculty/mid-exam/syllabus?subjectId=${mapping.subject.id}`)}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                          >
                            <FaFileAlt size={12} /> Syllabus
                            <FaChevronRight size={10} />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )
        ) : activeTab === "reports" ? (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-sans">Marks Reports</h3>
              <p className="text-sm text-slate-500">View compiled reports online with dynamic heatmaps or download signature-ready PDFs</p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Target Subject & Section</label>
                  <select
                    value={selectedMappingId}
                    onChange={e => {
                      setSelectedMappingId(e.target.value);
                      setPreviewData(null);
                      setPreviewType(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select subject...</option>
                    {mappings.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.subject.name} ({m.subject.code}) - Section {m.section.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Report Action</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleViewReport("MID_I")}
                      disabled={!selectedMappingId || fetchingReport}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "MID_I" ? <FaSpinner className="animate-spin" /> : <FaEye />} View MID-I Memo
                    </button>
                    <button
                      onClick={() => handleViewReport("MID_II")}
                      disabled={!selectedMappingId || fetchingReport}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "MID_II" ? <FaSpinner className="animate-spin" /> : <FaEye />} View MID-II Memo
                    </button>
                    <button
                      onClick={() => handleViewReport("ASSIGNMENT")}
                      disabled={!selectedMappingId || fetchingReport}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "ASSIGNMENT" ? <FaSpinner className="animate-spin" /> : <FaEye />} View Assignment Memo
                    </button>
                    <button
                      onClick={() => handleViewReport("FINAL")}
                      disabled={!selectedMappingId || fetchingReport}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {fetchingReport && previewType === "FINAL" ? <FaSpinner className="animate-spin" /> : <FaEye />} View Final Internals
                    </button>
                  </div>
                </div>
              </div>

              {selectedMappingId && (
                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  <button
                    onClick={() => handleViewReport("SUBJECT")}
                    disabled={fetchingReport}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-xs font-semibold text-white hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {fetchingReport && previewType === "SUBJECT" ? <FaSpinner className="animate-spin" /> : <FaEye />} View Detailed Subject Evaluation Sheet (All Marks)
                  </button>
                </div>
              )}
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
                      {previewType === "SUBJECT" && `Subject Detailed Sheet - ${(previewData.subjects[0]?.name || "").toUpperCase()}`}
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
                    {previewType !== "SUBJECT" && (
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
                  <table className="w-full text-left text-xs border-collapse">
                    {(() => {
                      const filteredSubjects = (previewData.subjects || []).filter((sub: any) => {
                        const isLab = sub.type?.toUpperCase() === "LAB";
                        if (isLab) return showLabMarks;
                        return true;
                      });

                      if (previewType !== "SUBJECT") {
                        return (
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
                                {filteredSubjects.map((sub: any) => {
                                  const isLab = sub.type?.toUpperCase() === "LAB";
                                  return (
                                    <th key={sub.id} className="px-4 py-3 text-center border border-black min-w-[120px]">
                                      {sub.shortName || sub.name}
                                      <span className="block text-[9px] font-normal text-slate-400 normal-case mt-0.5">
                                        {previewType === "MID_I" && `MID I ${isLab ? "(50M)" : "(30M)"}`}
                                        {previewType === "MID_II" && `MID II ${isLab ? "(50M)" : "(30M)"}`}
                                        {previewType === "ASSIGNMENT" && "Assign (10M)"}
                                        {previewType === "FINAL" && `Final ${isLab ? "(50M)" : "(30M)"}`}
                                      </span>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-slate-700">
                              {previewData.rows.map((row: any, idx: number) => (
                                <tr key={row.rollNumber} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-2.5 text-center border border-black">{idx + 1}</td>
                                  <td className="px-4 py-2.5 text-center border border-black">
                                    <Link href={`/faculty/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-bold transition-colors">
                                      {row.rollNumber}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-2.5 border border-black">
                                    <Link href={`/faculty/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-medium transition-colors">
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
                                    const isLab = sub.type?.toUpperCase() === "LAB";
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
                                <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students Above 60%</td>
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
                                <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students Between 60% to 40%</td>
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
                                <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2 text-right border border-black text-[11px] font-medium text-slate-600">Total No. of Students Below 40%</td>
                                {filteredSubjects.map((sub: any) => {
                                  const stats = getSubjectStats(sub.id, sub.type);
                                  return (
                                    <td key={sub.id} className="px-4 py-2 text-center text-xs font-semibold border border-black">
                                      {stats.countBelow}
                                    </td>
                                  );
                                })}
                              </tr>
                              {/* With zero Marks Row */}
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
                          </>
                        );
                      } else {
                        // Detailed subject sheet
                        const previewSubjectId = previewData.subjects[0]?.id;
                        const isLab = previewData.subjects[0]?.type?.toUpperCase() === "LAB";

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
                                <th className="px-4 py-3 text-center border border-black">{isLab ? "MID-I (50M)" : "MID-I (30M)"}</th>
                                <th className="px-4 py-3 text-center border border-black">{isLab ? "MID-I (50M)" : "MID-I (20M)"}</th>
                                <th className="px-4 py-3 text-center border border-black">{isLab ? "MID-II (50M)" : "MID-II (30M)"}</th>
                                <th className="px-4 py-3 text-center border border-black">{isLab ? "MID-II (50M)" : "MID-II (20M)"}</th>
                                <th className="px-4 py-3 text-center border border-black text-amber-700 font-bold">{isLab ? "MID Avg (50M)" : "MID Avg (20M)"}</th>
                                <th className="px-4 py-3 text-center border border-black font-bold">Assign (10M)</th>
                                <th className="px-4 py-3 text-center border border-black font-bold">{isLab ? "Final (50M)" : "Final (30M)"}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-slate-700">
                              {previewData.rows.map((row: any, idx: number) => {
                                const marksObj = row.subjects[previewSubjectId] || { mid1: null, mid1Scaled: null, mid2: null, mid2Scaled: null, assignment: null, internal: 0 };
                                
                                const m1 = marksObj.mid1Scaled;
                                const m2 = marksObj.mid2Scaled;
                                const available = [m1, m2].filter(v => v !== null && v !== undefined) as number[];
                                const midAvgVal = available.length > 0 ? available.reduce((a, b) => a + b, 0) / available.length : null;

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
                                      <Link href={`/faculty/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-bold transition-colors">
                                        {row.rollNumber}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-2.5 border border-black">
                                      <Link href={`/faculty/students/${row.studentId}`} className="text-blue-600 hover:underline hover:text-blue-800 font-medium transition-colors">
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
                                        <td key={fIdx} className={`px-4 py-2.5 text-center text-sm font-bold border border-black ${f.isBold ? "font-bold" : ""} ${colorClass}`}>
                                          {displayVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 border-t border-b border-black font-bold text-slate-800">
                                <td colSpan={showAttendance ? 4 : 3} className="px-4 py-2.5 text-right border border-black uppercase text-[10px] text-slate-500 font-bold">Class Average</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">{classAvgMid1}</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">{classAvgMid1Scaled}</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">{classAvgMid2}</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">{classAvgMid2Scaled}</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-amber-800 bg-slate-50">{classAvgMidAvg}</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">{classAvgAssign}</td>
                                <td className="px-4 py-2.5 text-center text-sm font-bold border border-black text-slate-700 bg-slate-50">{classAvgInternal}</td>
                              </tr>
                            </tfoot>
                          </>
                        );
                      }
                    })()}
                  </table>
                </div>

                {/* Attendance Statistics Section below the table */}
                {previewType !== "SUBJECT" && (() => {
                  const attStats = getAttendanceStats();
                  return (
                    <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start gap-6 print:hidden">
                      <div className="text-xs text-slate-500 max-w-md">
                        <p className="font-semibold text-slate-700 mb-1 text-sm">Report Insights & Statistics</p>
                        <p className="leading-relaxed">The subject-wise columns display real-time class averages and grade distributions. Toggle the <strong className="text-slate-700">Show Attendance</strong> button to load active attendance percentages and populate the overall Attendance Statistics card.</p>
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
        ) : (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-sans">Mid Exam Performance & Attendance Analysis</h3>
              <p className="text-sm text-slate-500">Analyze class performance, difficulty index, and correlate attendance with academic results</p>
            </div>

            {/* Selection filters */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Target Class Context</label>
                  <select
                    value={selectedMappingId}
                    onChange={e => {
                      setSelectedMappingId(e.target.value);
                      setAnalysisData(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select subject...</option>
                    {mappings.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.subject.name} ({m.subject.code}) - Section {m.section.name}
                      </option>
                    ))}
                  </select>
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

            {fetchingAnalysis ? (
              <div className="flex items-center justify-center py-20"><LogoSpinner fullScreen={false} /></div>
            ) : !analysisData ? (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-100">
                <FaClipboardList className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-lg font-semibold text-slate-600">No context selected</p>
                <p className="text-sm text-slate-400">Please select a target class context above to load analysis metrics</p>
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
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm animate-pulse-subtle"
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

        {/* Admin link */}
        {["ADMIN", "HOD", "DIRECTOR"].includes(role) && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => router.push("/admin/mid-exam")}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
            >
              <FaEye /> Admin Control Panel
            </button>
          </div>
        )}
      </div>

      {/* Create Paper Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Question Paper" maxWidth="max-w-md">
        <div className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject & Section</label>
            <select
              value={createForm.mappingId}
              onChange={e => setCreateForm(f => ({ ...f, mappingId: e.target.value, sourcePaperId: "" }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select subject...</option>
              {mappings.filter(m => m.subject.type?.toUpperCase() !== "LAB").map(m => (
                <option key={m.id} value={m.id}>
                  {m.subject.code} - {m.subject.name} (Section {m.section.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Exam Type</label>
            <div className="flex gap-3">
              {["MID_I", "MID_II"].map(et => (
                <button
                  key={et}
                  onClick={() => setCreateForm(f => ({ ...f, examType: et, sourcePaperId: "" }))}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                    createForm.examType === et
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {et.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Create Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Create Mode</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCreateForm(f => ({ ...f, createMode: "independent" }))}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold border transition-all ${
                  createForm.createMode === "independent"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Independent / Clone
              </button>
              <button
                type="button"
                onClick={() => setCreateForm(f => ({ ...f, createMode: "linked" }))}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold border transition-all ${
                  createForm.createMode === "linked"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Link to Common Paper
              </button>
            </div>
          </div>

          {createForm.createMode === "independent" ? (
            <>
              {/* Loosened Cloning Field */}
              {(() => {
                const selectedMapping = mappings.find(m => m.id === createForm.mappingId);
                if (!selectedMapping) return null;

                const sameSubPapers = papers.filter(
                  p => p.subject.name.toLowerCase() === selectedMapping.subject.name.toLowerCase() &&
                  p.examType === createForm.examType
                );

                const otherSubPapers = papers.filter(
                  p => p.subject.name.toLowerCase() !== selectedMapping.subject.name.toLowerCase() &&
                  p.examType === createForm.examType
                );

                if (sameSubPapers.length === 0 && otherSubPapers.length === 0) return null;

                return (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Copy Paper layout from (Optional)</label>
                    <select
                      value={createForm.sourcePaperId || ""}
                      onChange={e => setCreateForm(f => ({ ...f, sourcePaperId: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Create Blank Question Paper</option>
                      {sameSubPapers.length > 0 && (
                        <optgroup label="Same Subject / Sections">
                          {sameSubPapers.map(p => (
                            <option key={p.id} value={p.id}>
                              Copy from Sec {p.section?.name || "?"} ({p.subject.code} - {p.totalMarks}m)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherSubPapers.length > 0 && (
                        <optgroup label="Other Subjects">
                          {otherSubPapers.map(p => (
                            <option key={p.id} value={p.id}>
                              Copy from {p.subject.code} - Sec {p.section?.name || "?"} ({p.totalMarks}m)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">Clones questions, subquestions, and CO mappings instantly.</p>
                  </div>
                );
              })()}

              {/* Make Common Option */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createForm.isCommon}
                    onChange={e => setCreateForm(f => ({ ...f, isCommon: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Make this a Common Question Paper</span>
                </label>
              </div>

              {/* Common Header Text */}
              {createForm.isCommon && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Common Header Text</label>
                  <input
                    type="text"
                    value={createForm.commonText}
                    onChange={e => setCreateForm(f => ({ ...f, commonText: e.target.value }))}
                    placeholder="e.g., Common for CSE, CSM, CIVIL"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Total Marks */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
                <input
                  type="number"
                  value={createForm.totalMarks}
                  onChange={e => setCreateForm(f => ({ ...f, totalMarks: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={1}
                  max={100}
                />
              </div>
            </>
          ) : (
            <>
              {/* Link Master Paper Dropdown */}
              {(() => {
                const selectedMapping = mappings.find(m => m.id === createForm.mappingId);
                if (!selectedMapping) return null;

                const eligibleMasters = papers.filter(
                  p => p.examType === createForm.examType && !p.masterPaperId
                );

                return (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Master Common Paper *</label>
                    <select
                      value={createForm.masterPaperId || ""}
                      onChange={e => {
                        const target = e.target.value;
                        const matchedPaper = papers.find(p => p.id === target);
                        setCreateForm(f => ({
                          ...f,
                          masterPaperId: target,
                          totalMarks: matchedPaper ? matchedPaper.totalMarks : f.totalMarks,
                          commonText: matchedPaper?.commonText || f.commonText || ""
                        }));
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select a master paper...</option>
                      {eligibleMasters.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.subject.code} - {p.subject.name} (Sec {p.section?.name}, {p.totalMarks}m)
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">Linked papers dynamically reflect all questions and changes from the master paper.</p>
                  </div>
                );
              })()}

              {/* Common Header Text */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Common Header Text</label>
                <input
                  type="text"
                  value={createForm.commonText}
                  onChange={e => setCreateForm(f => ({ ...f, commonText: e.target.value }))}
                  placeholder="e.g., Common for CSE, CSM, CIVIL"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Total Marks Info (ReadOnly) */}
              {createForm.masterPaperId && (
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <p className="text-xs text-slate-600">
                    Total Marks: <strong className="text-slate-800">{createForm.totalMarks}</strong>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Inherited automatically from the selected master paper.</p>
                </div>
              )}
            </>
          )}

          {createError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
          )}

          <div className="flex gap-3">
            <button onClick={() => setShowCreateModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={handleCreatePaper}
              disabled={creating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? <FaSpinner className="animate-spin" /> : <FaPlus />}
              {creating ? "Creating..." : "Create Paper"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
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
