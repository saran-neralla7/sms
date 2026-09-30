"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { 
    FaBook, FaUsers, FaListAlt, FaTasks, FaBookOpen, FaJournalWhills, 
    FaArrowLeft, FaSearch, FaQrcode, FaEdit, FaSave, FaPlus, FaTrash, 
    FaFilePdf, FaCheck, FaExclamationCircle, FaFileAlt 
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import StudentProfileModal from "@/components/StudentProfileModal";
import { formatISTDate } from "@/lib/dateUtils";

const cleanHtmlText = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
};

export default function FacultySubjectDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const subjectId = searchParams?.get("subjectId") || "";
    const initialSectionId = searchParams?.get("sectionId") || "";
    const academicYearId = searchParams?.get("academicYearId") || "";

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [activeSectionId, setActiveSectionId] = useState<string>(initialSectionId);
    const [activeTab, setActiveTab] = useState<"students" | "syllabus" | "copo" | "lecture-plan" | "diary">("students");

    // Student Roster state
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // Syllabus state
    const [syllabusUnits, setSyllabusUnits] = useState<any[]>([]);

    // CO-PO state
    const [coPoMatrix, setCoPoMatrix] = useState<Record<string, Record<string, string>>>({});
    const [coPsoMatrix, setCoPsoMatrix] = useState<Record<string, Record<string, string>>>({});

    // Lecture Plan state
    const [lecturePlan, setLecturePlan] = useState<any[]>([]);
    const [newPlanItem, setNewPlanItem] = useState({ unit: "Unit I", topic: "", plannedPeriods: 1, tentativeDate: "", teachingAid: "PPT" });

    // Teaching Diary state
    const [diaries, setDiaries] = useState<any[]>([]);
    const [isAddDiaryOpen, setIsAddDiaryOpen] = useState(false);
    const [diaryForm, setDiaryForm] = useState({ date: new Date().toISOString().split("T")[0], periodId: "", topicsTaught: "" });
    const [periods, setPeriods] = useState<any[]>([]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && subjectId) {
            fetchDashboardData(activeSectionId);
            fetchPeriods();
        }
    }, [status, subjectId, activeSectionId]);

    const fetchDashboardData = async (secId: string) => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            query.append("subjectId", subjectId);
            if (secId) query.append("sectionId", secId);
            if (academicYearId) query.append("academicYearId", academicYearId);

            const res = await fetch(`/api/faculty/subject-dashboard?${query.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setDashboardData(data);
                if (data.activeSectionId && !activeSectionId) {
                    setActiveSectionId(data.activeSectionId);
                }

                // Initialize Syllabus with full fallback hierarchy (CourseFile -> Subject.syllabus -> default)
                setSyllabusUnits(parseSyllabusFromData(data.courseFile?.syllabus, data.subject?.syllabus));

                // Initialize CO-PO Mappings (CourseFile -> SubjectCoPoMapping DB records -> default)
                setCoPoMatrix(parseCoPoFromData(data.courseFile?.coPoMapping, data.coPoMappings));

                // Initialize CO-PSO Mappings (CourseFile -> SubjectCoPsoMapping DB records -> default)
                setCoPsoMatrix(parseCoPsoFromData(data.courseFile?.coPoMapping, data.coPsoMappings));

                // Initialize Lecture Plan
                if (data.courseFile?.lecturePlan) {
                    setLecturePlan(parseLecturePlanForDashboard(data.courseFile.lecturePlan));
                } else {
                    setLecturePlan([]);
                }

                setDiaries(data.diaries || []);
            }
        } catch (error) {
            console.error("Error fetching subject dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const parseSyllabusFromData = (courseFileSyl: any, subjectSyl: any) => {
        if (courseFileSyl) {
            try {
                const parsed = typeof courseFileSyl === "string" ? JSON.parse(courseFileSyl) : courseFileSyl;
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                if (parsed && Array.isArray(parsed.units) && parsed.units.length > 0) {
                    return parsed.units.map((u: any, i: number) => ({
                        unit: u.unit || u.name || `Unit ${i + 1}`,
                        title: u.title ? u.title.replace(/<[^>]*>/g, "").trim() : "",
                        topics: u.topics || u.content || "",
                        co: Array.isArray(u.mappedCOs) && u.mappedCOs.length > 0 ? u.mappedCOs.join(", ") : (u.co || `CO${i + 1}`)
                    }));
                }
            } catch (_) {}
        }

        if (subjectSyl) {
            try {
                const parsed = typeof subjectSyl === "string" ? JSON.parse(subjectSyl) : subjectSyl;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.map((u: any, i: number) => ({
                        unit: u.unit || u.name || `Unit ${i + 1}`,
                        title: u.title ? u.title.replace(/<[^>]*>/g, "").trim() : "",
                        topics: u.topics || u.content || "",
                        co: Array.isArray(u.mappedCOs) && u.mappedCOs.length > 0 ? u.mappedCOs.join(", ") : (u.co || `CO${i + 1}`)
                    }));
                }
                if (parsed && Array.isArray(parsed.units) && parsed.units.length > 0) {
                    return parsed.units.map((u: any, i: number) => ({
                        unit: u.name || u.unit || `Unit ${i + 1}`,
                        title: u.title ? u.title.replace(/<[^>]*>/g, "").trim() : "",
                        topics: u.content || u.topics || "",
                        co: Array.isArray(u.mappedCOs) && u.mappedCOs.length > 0 ? u.mappedCOs.join(", ") : (u.co || `CO${i + 1}`)
                    }));
                }
            } catch (_) {}
        }

        return defaultSyllabus();
    };

    const parseCoPoFromData = (courseFileCoPo: any, dbCoPo: any[]) => {
        if (courseFileCoPo) {
            try {
                const parsed = typeof courseFileCoPo === "string" ? JSON.parse(courseFileCoPo) : courseFileCoPo;
                if (parsed && parsed.coPo) return parsed.coPo;
            } catch (_) {}
        }

        if (Array.isArray(dbCoPo) && dbCoPo.length > 0) {
            const matrix: Record<string, Record<string, string>> = {};
            ["CO1", "CO2", "CO3", "CO4", "CO5"].forEach(co => {
                matrix[co] = {};
                for (let i = 1; i <= 12; i++) {
                    matrix[co][`PO${i}`] = "-";
                }
            });
            dbCoPo.forEach((item: any) => {
                if (matrix[item.co]) {
                    matrix[item.co][item.po] = item.weight !== null && item.weight !== undefined ? String(item.weight) : "-";
                }
            });
            return matrix;
        }

        return defaultCoPo();
    };

    const parseCoPsoFromData = (courseFileCoPo: any, dbCoPso: any[]) => {
        if (courseFileCoPo) {
            try {
                const parsed = typeof courseFileCoPo === "string" ? JSON.parse(courseFileCoPo) : courseFileCoPo;
                if (parsed && parsed.coPso) return parsed.coPso;
            } catch (_) {}
        }

        if (Array.isArray(dbCoPso) && dbCoPso.length > 0) {
            const matrix: Record<string, Record<string, string>> = {};
            const psoKeys = Array.from(new Set(dbCoPso.map((item: any) => item.pso))).sort();
            const keysToUse = psoKeys.length > 0 ? psoKeys : ["PSO1", "PSO2", "PSO3", "PSO4"];

            ["CO1", "CO2", "CO3", "CO4", "CO5"].forEach(co => {
                matrix[co] = {};
                keysToUse.forEach(pso => {
                    matrix[co][pso] = "-";
                });
            });
            dbCoPso.forEach((item: any) => {
                if (matrix[item.co]) {
                    matrix[item.co][item.pso] = item.weight !== null && item.weight !== undefined ? String(item.weight) : "-";
                }
            });
            return matrix;
        }

        return defaultCoPso();
    };

    const parseLecturePlanForDashboard = (rawPlan: any) => {
        if (!rawPlan) return [];
        try {
            const parsed = typeof rawPlan === "string" ? JSON.parse(rawPlan) : rawPlan;
            if (!Array.isArray(parsed) || parsed.length === 0) return [];

            const items: any[] = [];

            if (parsed[0] && typeof parsed[0] === "object" && "topics" in parsed[0] && Array.isArray(parsed[0].topics)) {
                parsed.forEach((unitObj: any) => {
                    const uName = unitObj.unit || "Unit I";
                    const refs = unitObj.references || "";
                    if (Array.isArray(unitObj.topics)) {
                        unitObj.topics.forEach((tItem: any) => {
                            const topicText = typeof tItem === "string" ? tItem : (tItem?.topic || "");
                            if (topicText && topicText.trim() !== "") {
                                items.push({
                                    unit: uName,
                                    topic: topicText,
                                    plannedPeriods: parseInt(tItem.plannedPeriods) || 1,
                                    tentativeDate: tItem.tentativeDate || tItem.actualDate || "",
                                    teachingAid: tItem.teachingAid || tItem.aid || refs || "PPT"
                                });
                            }
                        });
                    }
                });
                return items;
            }

            parsed.forEach((item: any) => {
                if (item && (item.topic || item.title)) {
                    const topicText = item.topic || item.title || "";
                    if (topicText.trim() !== "") {
                        items.push({
                            unit: item.unit || "Unit I",
                            topic: topicText,
                            plannedPeriods: parseInt(item.plannedPeriods) || 1,
                            tentativeDate: item.tentativeDate || item.actualDate || "",
                            teachingAid: item.teachingAid || item.aid || "PPT"
                        });
                    }
                }
            });

            return items;
        } catch (_) {
            return [];
        }
    };

    const formatFlatPlanToUnitGrouped = (flatPlan: any[]) => {
        const defaultUnits: Record<string, any> = {
            "Unit I": { unit: "Unit I", title: "", references: "", topics: [] },
            "Unit II": { unit: "Unit II", title: "", references: "", topics: [] },
            "Unit III": { unit: "Unit III", title: "", references: "", topics: [] },
            "Unit IV": { unit: "Unit IV", title: "", references: "", topics: [] },
            "Unit V": { unit: "Unit V", title: "", references: "", topics: [] }
        };

        const normalizeUnitKey = (name: string) => {
            if (!name) return "Unit I";
            const upper = name.toUpperCase().trim();
            if (upper.includes("UNIT 1") || upper === "UNIT 1" || upper === "UNIT I" || upper.startsWith("UNIT I")) return "Unit I";
            if (upper.includes("UNIT 2") || upper === "UNIT 2" || upper === "UNIT II" || upper.startsWith("UNIT II")) return "Unit II";
            if (upper.includes("UNIT 3") || upper === "UNIT 3" || upper === "UNIT III" || upper.startsWith("UNIT III")) return "Unit III";
            if (upper.includes("UNIT 4") || upper === "UNIT 4" || upper === "UNIT IV" || upper.startsWith("UNIT IV")) return "Unit IV";
            if (upper.includes("UNIT 5") || upper === "UNIT 5" || upper === "UNIT V" || upper.startsWith("UNIT V")) return "Unit V";
            return name;
        };

        flatPlan.forEach((item: any) => {
            const key = normalizeUnitKey(item.unit);
            if (!defaultUnits[key]) {
                defaultUnits[key] = { unit: key, title: "", references: "", topics: [] };
            }
            defaultUnits[key].topics.push({
                topic: item.topic || "",
                plannedPeriods: parseInt(item.plannedPeriods) || 1,
                tentativeDate: item.tentativeDate || "",
                teachingAid: item.teachingAid || "PPT"
            });
        });

        return Object.values(defaultUnits);
    };

    const fetchPeriods = async () => {
        try {
            const res = await fetch("/api/periods");
            if (res.ok) {
                const data = await res.json();
                setPeriods(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const defaultSyllabus = () => [
        { unit: "Unit I", title: "Introduction & Foundations", topics: "Basic principles, concepts, definitions, and foundational theories.", co: "CO1" },
        { unit: "Unit II", title: "Core Architecture & Processes", topics: "System architecture, workflows, components, and primary models.", co: "CO2" },
        { unit: "Unit III", title: "Advanced Analysis & Design", topics: "Design methodologies, structural analysis, and optimization techniques.", co: "CO3" },
        { unit: "Unit IV", title: "Implementation & Integration", topics: "Practical implementation, algorithmic approaches, and integration standards.", co: "CO4" },
        { unit: "Unit V", title: "Applications, Security & Future Trends", topics: "Industry applications, security paradigms, performance evaluation, and trends.", co: "CO5" }
    ];

    const defaultCoPo = () => {
        const matrix: Record<string, Record<string, string>> = {};
        ["CO1", "CO2", "CO3", "CO4", "CO5"].forEach(co => {
            matrix[co] = {};
            for (let i = 1; i <= 12; i++) {
                matrix[co][`PO${i}`] = "-";
            }
        });
        return matrix;
    };

    const defaultCoPso = () => {
        const matrix: Record<string, Record<string, string>> = {};
        ["CO1", "CO2", "CO3", "CO4", "CO5"].forEach(co => {
            matrix[co] = {};
            for (let i = 1; i <= 4; i++) {
                matrix[co][`PSO${i}`] = "-";
            }
        });
        return matrix;
    };

    const saveCourseFileChanges = async (updates: { lecturePlan?: any }) => {
        if (!dashboardData) return;
        setSaving(true);
        try {
            const subId = dashboardData.subject.id;
            const rawPlanToSave = updates.lecturePlan !== undefined ? updates.lecturePlan : lecturePlan;
            const formattedPlan = formatFlatPlanToUnitGrouped(rawPlanToSave);

            const payload = {
                academicYearId: dashboardData.academicYearId,
                departmentId: dashboardData.subject.departmentId,
                year: dashboardData.subject.year,
                semester: dashboardData.subject.semester,
                sectionId: activeSectionId,
                subjectId: subId,
                facultyId: dashboardData.facultyId || (session?.user as any)?.facultyId || session?.user?.id,
                lecturePlan: JSON.stringify(formattedPlan)
            };

            const res = await fetch("/api/course-files", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Lecture plan saved successfully!");
            } else {
                alert("Failed to save lecture plan.");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving lecture plan");
        } finally {
            setSaving(false);
        }
    };

    const handleAddPlanItem = () => {
        if (!newPlanItem.topic.trim()) {
            alert("Topic title is required");
            return;
        }
        const updatedPlan = [...lecturePlan, { ...newPlanItem, id: Date.now().toString() }];
        setLecturePlan(updatedPlan);
        setNewPlanItem({ unit: "Unit I", topic: "", plannedPeriods: 1, tentativeDate: "", teachingAid: "PPT" });
        saveCourseFileChanges({ lecturePlan: updatedPlan });
    };

    const handleDeletePlanItem = (index: number) => {
        const updatedPlan = lecturePlan.filter((_, i) => i !== index);
        setLecturePlan(updatedPlan);
        saveCourseFileChanges({ lecturePlan: updatedPlan });
    };

    const handleSaveDiary = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!diaryForm.periodId || !diaryForm.topicsTaught.trim()) {
            alert("Please select a period and enter topics taught.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/teaching-diary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: diaryForm.date,
                    subjectId,
                    sectionId: activeSectionId,
                    periodId: diaryForm.periodId,
                    topicsTaught: diaryForm.topicsTaught
                })
            });

            if (res.ok) {
                setIsAddDiaryOpen(false);
                setDiaryForm({ date: new Date().toISOString().split("T")[0], periodId: "", topicsTaught: "" });
                fetchDashboardData(activeSectionId);
            } else {
                const err = await res.json();
                alert(err.error || "Failed to save teaching diary");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving teaching diary");
        } finally {
            setSaving(false);
        }
    };

    const openStudentProfile = (sId: string) => {
        setSelectedStudentId(sId);
        setIsProfileModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
                <LogoSpinner />
                <p className="mt-4 text-sm font-medium text-slate-500 animate-pulse">Loading Subject Dashboard...</p>
            </div>
        );
    }

    if (!dashboardData || !dashboardData.subject) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="text-center bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <FaBook className="mx-auto text-4xl text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">Subject Not Found</h2>
                    <p className="text-sm text-slate-500 mt-2">Could not retrieve subject details. Please try again.</p>
                    <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const { subject, sections, students } = dashboardData;
    const filteredStudents = students.filter((s: any) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Parse official syllabus from Subject model
    const officialSyllabus = (() => {
        const raw = subject?.syllabus;
        if (!raw) return null;
        if (typeof raw === "string") {
            try { return JSON.parse(raw); } catch (_) { return null; }
        }
        return raw;
    })();

    const hasOfficialSyllabus = Boolean(
        officialSyllabus && (
            (Array.isArray(officialSyllabus.units) && officialSyllabus.units.length > 0) ||
            (Array.isArray(officialSyllabus.outcomes) && officialSyllabus.outcomes.length > 0)
        )
    );

    const currentReturnUrl = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : `/faculty/subject-dashboard?subjectId=${subjectId}`;

    // Extract CO-PO and CO-PSO mappings
    const dbCoPoMappings = dashboardData?.coPoMappings || [];
    const dbCoPsoMappings = dashboardData?.coPsoMappings || [];
    const hasDbCoPo = dbCoPoMappings.length > 0;
    const hasDbCoPso = dbCoPsoMappings.length > 0;

    // Course Outcomes list
    const coList: string[] = Array.isArray(officialSyllabus?.outcomes) && officialSyllabus.outcomes.length > 0
        ? officialSyllabus.outcomes.map((o: any) => cleanHtmlText(o.code || o.id || o))
        : ["CO1", "CO2", "CO3", "CO4", "CO5"];

    // Build CO-PO matrix map
    const coPoDisplayMap: Record<string, Record<string, number | null>> = {};
    coList.forEach((co) => {
        coPoDisplayMap[co] = {};
        for (let i = 1; i <= 12; i++) {
            coPoDisplayMap[co][`PO${i}`] = null;
        }
    });
    dbCoPoMappings.forEach((m: any) => {
        if (!coPoDisplayMap[m.co]) coPoDisplayMap[m.co] = {};
        coPoDisplayMap[m.co][m.po] = m.weight;
    });

    // Column averages for PO1..PO12
    const poColumnAverages: Record<string, string> = {};
    for (let i = 1; i <= 12; i++) {
        const poKey = `PO${i}`;
        let sum = 0;
        let count = 0;
        coList.forEach((co) => {
            const val = coPoDisplayMap[co]?.[poKey];
            if (val !== null && val !== undefined) {
                sum += val;
                count++;
            }
        });
        poColumnAverages[poKey] = count > 0 ? (sum / count).toFixed(2) : "-";
    }

    // Build CO-PSO matrix map
    const psoKeysFromDb: string[] = Array.from(new Set<string>(dbCoPsoMappings.map((m: any) => String(m.pso)))).sort();
    const psoListToUse: string[] = psoKeysFromDb.length > 0 ? psoKeysFromDb : ["PSO1", "PSO2", "PSO3", "PSO4"];
    const coPsoDisplayMap: Record<string, Record<string, number | null>> = {};
    coList.forEach((co: string) => {
        coPsoDisplayMap[co] = {};
        psoListToUse.forEach((pso: string) => {
            coPsoDisplayMap[co][pso] = null;
        });
    });
    dbCoPsoMappings.forEach((m: any) => {
        if (!coPsoDisplayMap[m.co]) coPsoDisplayMap[m.co] = {};
        coPsoDisplayMap[m.co][m.pso] = m.weight;
    });

    // Column averages for PSO
    const psoColumnAverages: Record<string, string> = {};
    psoListToUse.forEach((psoKey: string) => {
        let sum = 0;
        let count = 0;
        coList.forEach((co) => {
            const val = coPsoDisplayMap[co]?.[psoKey];
            if (val !== null && val !== undefined) {
                sum += val;
                count++;
            }
        });
        psoColumnAverages[psoKey] = count > 0 ? (sum / count).toFixed(2) : "-";
    });

    const renderWeightPill = (val: number | null | undefined) => {
        if (val === 3) {
            return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">3</span>;
        }
        if (val === 2) {
            return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">2</span>;
        }
        if (val === 1) {
            return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">1</span>;
        }
        return <span className="text-slate-300 font-bold">-</span>;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* Top Action Bar */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push("/faculty/dashboard")}
                        className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        <FaArrowLeft /> Back to Dashboard
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push(`/faculty/qr-attendance?subjectId=${subject.id}&sectionId=${activeSectionId}`)}
                            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                        >
                            <FaQrcode /> QR Attendance
                        </button>
                        <button
                            onClick={() => router.push(`/faculty/mid-exam?subjectId=${subject.id}`)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                        >
                            <FaEdit /> Mid Exam Engine
                        </button>
                    </div>
                </div>

                {/* Main Header Banner */}
                <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-6 sm:p-8 text-white shadow-lg relative">
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-white/20 px-2.5 py-0.5 text-xs font-mono font-bold tracking-wide backdrop-blur-sm">
                                    {subject.code}
                                </span>
                                <span className="rounded bg-amber-400 text-slate-900 px-2.5 py-0.5 text-xs font-bold tracking-wide">
                                    {subject.department?.code || "DEPT"} · Year {subject.year} Sem {subject.semester}
                                </span>
                                {subject.isElective && (
                                    <span className="rounded bg-emerald-400 text-slate-900 px-2.5 py-0.5 text-xs font-bold tracking-wide">
                                        Open Elective
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black">{subject.name}</h1>
                            <p className="text-xs text-blue-100 font-medium">
                                Centralized Subject Operational Dashboard & Academic Management System
                            </p>
                        </div>

                        {/* Section Switcher Dropdown */}
                        {sections.length > 0 && (
                            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20 shrink-0 space-y-1">
                                <label className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">
                                    Active Section View
                                </label>
                                <select
                                    value={activeSectionId}
                                    onChange={(e) => {
                                        setActiveSectionId(e.target.value);
                                        fetchDashboardData(e.target.value);
                                    }}
                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none shadow-sm cursor-pointer border border-slate-200"
                                >
                                    {sections.map((sec: any) => (
                                        <option key={sec.id} value={sec.id}>
                                            Section {sec.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dashboard Tabs Navigation */}
                <div className="flex border-b border-slate-200 bg-white p-2 rounded-xl shadow-sm gap-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("students")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === "students" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        <FaUsers /> Enrolled Students ({students.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("syllabus")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === "syllabus" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        <FaBookOpen /> Syllabus {hasOfficialSyllabus && officialSyllabus.units?.length ? `(${officialSyllabus.units.length} Units)` : ""}
                    </button>
                    <button
                        onClick={() => setActiveTab("copo")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === "copo" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        <FaTasks /> CO-PO & PSO Mappings
                    </button>
                    <button
                        onClick={() => setActiveTab("lecture-plan")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === "lecture-plan" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        <FaListAlt /> Lecture Plan
                    </button>
                    <button
                        onClick={() => setActiveTab("diary")}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === "diary" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                        <FaJournalWhills /> Teaching Diary ({diaries.length})
                    </button>
                </div>

                {/* TAB 1: STUDENTS ROSTER */}
                {activeTab === "students" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div className="relative flex-1 max-w-md">
                                <FaSearch className="absolute left-3 top-3 text-slate-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="Search by student name or roll number..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                                />
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                                Showing {filteredStudents.length} of {students.length} students
                            </span>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-3.5">#</th>
                                        <th className="p-3.5">Roll Number</th>
                                        <th className="p-3.5">Student Name</th>
                                        <th className="p-3.5">Lab Batch</th>
                                        <th className="p-3.5 text-center">Subject Attendance %</th>
                                        <th className="p-3.5 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.map((student: any, idx: number) => (
                                        <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                                            <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                                            <td className="p-3.5 font-mono font-bold text-blue-600">
                                                <button
                                                    onClick={() => openStudentProfile(student.id)}
                                                    className="hover:underline"
                                                >
                                                    {student.rollNumber}
                                                </button>
                                            </td>
                                            <td className="p-3.5 font-bold text-slate-800">{student.name}</td>
                                            <td className="p-3.5 text-slate-500">{student.labBatch?.name || "-"}</td>
                                            <td className="p-3.5 text-center">
                                                <span className={`inline-block font-bold px-2.5 py-0.5 rounded-full ${
                                                    student.attendance?.pct >= 75 ? "bg-emerald-100 text-emerald-700" :
                                                    student.attendance?.pct >= 65 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                                                }`}>
                                                    {student.attendance?.pct}% ({student.attendance?.attended}/{student.attendance?.total})
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <button
                                                    onClick={() => openStudentProfile(student.id)}
                                                    className="rounded bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-blue-600 hover:text-white transition-colors"
                                                >
                                                    View Profile
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredStudents.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                                                No students found matching search filter.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* TAB 2: SYLLABUS */}
                {activeTab === "syllabus" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        {/* Top Action Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                    <FaBookOpen className="text-blue-600" /> Course Syllabus & Learning Outcomes
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Official syllabus for {subject.name} ({subject.code})
                                </p>
                            </div>
                            <button
                                onClick={() => router.push(`/faculty/mid-exam/syllabus?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                            >
                                <FaEdit /> {hasOfficialSyllabus ? "Edit / Manage Syllabus" : "Create Syllabus"}
                            </button>
                        </div>

                        {!hasOfficialSyllabus ? (
                            /* Empty State */
                            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm space-y-4">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-blue-100">
                                    <FaBookOpen />
                                </div>
                                <div className="max-w-md mx-auto space-y-1">
                                    <h4 className="text-base font-bold text-slate-800">No Syllabus Configured Yet</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        This subject does not have an official syllabus configured. You can define Course Objectives, specify CO1–CO5 outcomes, and add unit topics in the Syllabus Editor.
                                    </p>
                                </div>
                                <button
                                    onClick={() => router.push(`/faculty/mid-exam/syllabus?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                                >
                                    <FaPlus /> Create Syllabus
                                </button>
                            </div>
                        ) : (
                            /* Populated Syllabus View */
                            <div className="space-y-6">
                                {/* Metadata Cards Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Credits (L-T-P-C)</span>
                                        <span className="font-mono text-base font-extrabold text-blue-600 mt-1 block">
                                            {officialSyllabus.credits?.L ?? 3} - {officialSyllabus.credits?.T ?? 0} - {officialSyllabus.credits?.P ?? 0} - {officialSyllabus.credits?.C ?? 3}
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Contact Hours</span>
                                        <span className="text-base font-extrabold text-slate-800 mt-1 block">
                                            {officialSyllabus.contactHours || 42} hrs
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Marks</span>
                                        <span className="text-base font-extrabold text-slate-800 mt-1 block">
                                            {officialSyllabus.totalMarks || 100} Marks
                                        </span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Prerequisites</span>
                                        <span className="text-xs font-semibold text-slate-700 mt-1 block truncate" title={cleanHtmlText(officialSyllabus.prerequisites)}>
                                            {cleanHtmlText(officialSyllabus.prerequisites) || "None"}
                                        </span>
                                    </div>
                                </div>

                                {/* Course Objectives */}
                                {Array.isArray(officialSyllabus.objectives) && officialSyllabus.objectives.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-600"></span> Course Objectives
                                        </h4>
                                        <ul className="space-y-1.5 pl-2">
                                            {officialSyllabus.objectives.map((obj: string, oIdx: number) => (
                                                <li key={oIdx} className="text-xs text-slate-700 flex items-start gap-2">
                                                    <span className="text-slate-400 font-bold shrink-0">{oIdx + 1}.</span>
                                                    <span>{cleanHtmlText(obj)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Course Outcomes (COs) */}
                                {Array.isArray(officialSyllabus.outcomes) && officialSyllabus.outcomes.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Course Outcomes (COs)
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {officialSyllabus.outcomes.map((co: any, cIdx: number) => (
                                                <div key={cIdx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                                                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg shrink-0 border border-indigo-200">
                                                        {cleanHtmlText(co.code || `CO${cIdx + 1}`)}
                                                    </span>
                                                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                                        {cleanHtmlText(co.description || co)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Unit Breakdown */}
                                {Array.isArray(officialSyllabus.units) && officialSyllabus.units.length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Unit-Wise Syllabus ({officialSyllabus.units.length} Units)
                                        </h4>
                                        {officialSyllabus.units.map((unit: any, uIdx: number) => (
                                            <div key={uIdx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                            {cleanHtmlText(unit.name || unit.unit || `UNIT-${uIdx + 1}`)}
                                                        </span>
                                                        <h5 className="font-bold text-slate-900 text-sm">
                                                            {cleanHtmlText(unit.title || "Untitled Unit")}
                                                        </h5>
                                                    </div>
                                                    {Array.isArray(unit.mappedCOs) && unit.mappedCOs.length > 0 && (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Mapped:</span>
                                                            {unit.mappedCOs.map((mCo: string, mIdx: number) => (
                                                                <span key={mIdx} className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                                    {cleanHtmlText(mCo)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div
                                                    className="text-xs text-slate-700 leading-relaxed prose prose-sm max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: unit.content || unit.topics || "<p class='text-slate-400 italic'>No content details provided.</p>" }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Textbooks & Reference Books */}
                                {((Array.isArray(officialSyllabus.textbooks) && officialSyllabus.textbooks.length > 0) ||
                                  (Array.isArray(officialSyllabus.referenceBooks) && officialSyllabus.referenceBooks.length > 0)) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Array.isArray(officialSyllabus.textbooks) && officialSyllabus.textbooks.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                                    Textbooks
                                                </h4>
                                                <ul className="space-y-1.5 pl-2">
                                                    {officialSyllabus.textbooks.map((tb: string, tbIdx: number) => (
                                                        <li key={tbIdx} className="text-xs text-slate-700 flex items-start gap-2">
                                                            <span className="text-slate-400 font-bold shrink-0">{tbIdx + 1}.</span>
                                                            <span>{cleanHtmlText(tb)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {Array.isArray(officialSyllabus.referenceBooks) && officialSyllabus.referenceBooks.length > 0 && (
                                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                                    Reference Books
                                                </h4>
                                                <ul className="space-y-1.5 pl-2">
                                                    {officialSyllabus.referenceBooks.map((rb: string, rbIdx: number) => (
                                                        <li key={rbIdx} className="text-xs text-slate-700 flex items-start gap-2">
                                                            <span className="text-slate-400 font-bold shrink-0">{rbIdx + 1}.</span>
                                                            <span>{cleanHtmlText(rb)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* TAB 3: CO-PO & PSO MAPPINGS */}
                {activeTab === "copo" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                        {/* Top Action Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div>
                                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                                    <FaTasks className="text-blue-600" /> Course Outcome Correlation Matrices
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Scale: <span className="font-bold text-blue-700">3 (High)</span>, <span className="font-bold text-amber-700">2 (Medium)</span>, <span className="font-bold text-purple-700">1 (Low)</span>, <span className="text-slate-400 font-bold">- (None)</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                                >
                                    <FaEdit /> {hasDbCoPo ? "Edit CO-PO Matrix" : "Configure CO-PO"}
                                </button>
                                <button
                                    onClick={() => router.push(`/faculty/mid-exam/co-pso-mapping?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                                >
                                    <FaEdit /> {hasDbCoPso ? "Edit CO-PSO Matrix" : "Configure CO-PSO"}
                                </button>
                            </div>
                        </div>

                        {!hasDbCoPo && !hasDbCoPso ? (
                            /* Empty State */
                            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm space-y-4">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-blue-100">
                                    <FaTasks />
                                </div>
                                <div className="max-w-md mx-auto space-y-1">
                                    <h4 className="text-base font-bold text-slate-800">No Correlation Mappings Configured</h4>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Define the correlation matrix between Course Outcomes (COs) and Program Outcomes (POs) or Program Specific Outcomes (PSOs).
                                    </p>
                                </div>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                                    >
                                        <FaPlus /> Configure CO-PO Mappings
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* CO-PO Matrix */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 overflow-hidden">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                            CO - PO Correlation Matrix (POs 1–12)
                                        </h4>
                                        <button
                                            onClick={() => router.push(`/faculty/mid-exam/co-po-mapping?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                            <FaEdit /> Edit Matrix
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-center text-xs border-collapse min-w-[700px]">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2.5 border-r border-slate-200 text-left">Course Outcome</th>
                                                    {Array.from({ length: 12 }).map((_, i) => (
                                                        <th key={i} className="p-2.5 border-r border-slate-100 last:border-r-0">PO{i + 1}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {coList.map((co) => (
                                                    <tr key={co} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200 text-left">
                                                            {co}
                                                        </td>
                                                        {Array.from({ length: 12 }).map((_, i) => {
                                                            const poKey = `PO${i + 1}`;
                                                            const val = coPoDisplayMap[co]?.[poKey];
                                                            return (
                                                                <td key={poKey} className="p-2 border-r border-slate-100 last:border-r-0">
                                                                    {renderWeightPill(val)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {/* Column Averages Row */}
                                                <tr className="bg-blue-50/60 font-bold border-t-2 border-blue-200 text-blue-900">
                                                    <td className="p-2.5 border-r border-blue-200 text-left font-extrabold">
                                                        Average
                                                    </td>
                                                    {Array.from({ length: 12 }).map((_, i) => {
                                                        const poKey = `PO${i + 1}`;
                                                        return (
                                                            <td key={poKey} className="p-2 border-r border-blue-100 last:border-r-0 font-mono text-[11px]">
                                                                {poColumnAverages[poKey]}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* CO-PSO Matrix */}
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 overflow-hidden">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-slate-500">
                                            CO - PSO Correlation Matrix
                                        </h4>
                                        <button
                                            onClick={() => router.push(`/faculty/mid-exam/co-pso-mapping?subjectId=${subjectId}&returnUrl=${encodeURIComponent(currentReturnUrl)}`)}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                            <FaEdit /> Edit Matrix
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-center text-xs border-collapse max-w-lg">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2.5 border-r border-slate-200 text-left">Course Outcome</th>
                                                    {psoListToUse.map((psoKey) => (
                                                        <th key={psoKey} className="p-2.5 border-r border-slate-100 last:border-r-0">{psoKey}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {coList.map((co) => (
                                                    <tr key={co} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                        <td className="p-2.5 font-bold text-slate-700 bg-slate-50/50 border-r border-slate-200 text-left">
                                                            {co}
                                                        </td>
                                                        {psoListToUse.map((psoKey) => {
                                                            const val = coPsoDisplayMap[co]?.[psoKey];
                                                            return (
                                                                <td key={psoKey} className="p-2 border-r border-slate-100 last:border-r-0">
                                                                    {renderWeightPill(val)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {/* PSO Column Averages */}
                                                <tr className="bg-blue-50/60 font-bold border-t-2 border-blue-200 text-blue-900">
                                                    <td className="p-2.5 border-r border-blue-200 text-left font-extrabold">
                                                        Average
                                                    </td>
                                                    {psoListToUse.map((psoKey) => (
                                                        <td key={psoKey} className="p-2 border-r border-blue-100 last:border-r-0 font-mono text-[11px]">
                                                            {psoColumnAverages[psoKey]}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* TAB 4: LECTURE PLAN */}
                {activeTab === "lecture-plan" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Synchronized Lecture Plan</h3>
                                <p className="text-xs text-slate-500">Add planned topics, period count, tentative completion dates, and teaching aids.</p>
                            </div>
                            <button
                                onClick={() => saveCourseFileChanges({ lecturePlan })}
                                disabled={saving}
                                className="flex items-center gap-1.5 bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm hover:bg-blue-700 disabled:opacity-50 self-start md:self-auto"
                            >
                                <FaSave /> {saving ? "Saving..." : "Save Lecture Plan"}
                            </button>
                        </div>

                        {/* Add New Plan Item Card */}
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Add Lecture Plan Row</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Unit</label>
                                    <select
                                        value={newPlanItem.unit}
                                        onChange={(e) => setNewPlanItem({ ...newPlanItem, unit: e.target.value })}
                                        className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none bg-white font-semibold"
                                    >
                                        <option value="Unit I">Unit I</option>
                                        <option value="Unit II">Unit II</option>
                                        <option value="Unit III">Unit III</option>
                                        <option value="Unit IV">Unit IV</option>
                                        <option value="Unit V">Unit V</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Planned Topic Name</label>
                                    <input
                                        type="text"
                                        placeholder="Topic title..."
                                        value={newPlanItem.topic}
                                        onChange={(e) => setNewPlanItem({ ...newPlanItem, topic: e.target.value })}
                                        className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Periods</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={newPlanItem.plannedPeriods || 1}
                                        onChange={(e) => setNewPlanItem({ ...newPlanItem, plannedPeriods: parseInt(e.target.value) || 1 })}
                                        className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tentative Date</label>
                                    <input
                                        type="date"
                                        value={newPlanItem.tentativeDate}
                                        onChange={(e) => setNewPlanItem({ ...newPlanItem, tentativeDate: e.target.value })}
                                        className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none bg-white text-slate-800"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleAddPlanItem}
                                        className="w-full flex items-center justify-center gap-1 bg-emerald-600 text-white font-bold py-2 px-3 rounded-lg text-xs hover:bg-emerald-700 shadow-sm"
                                    >
                                        <FaPlus /> Add Topic
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Lecture Plan Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">#</th>
                                        <th className="p-3">Unit</th>
                                        <th className="p-3">Planned Topic</th>
                                        <th className="p-3 text-center">Periods</th>
                                        <th className="p-3">Tentative Date</th>
                                        <th className="p-3">Teaching Aid / Ref</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {lecturePlan.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                                            <td className="p-3 font-bold text-blue-600">{item.unit}</td>
                                            <td className="p-3 font-semibold text-slate-800">{item.topic}</td>
                                            <td className="p-3 text-center font-bold text-slate-600">{item.plannedPeriods || 1}</td>
                                            <td className="p-3 text-slate-600">{item.tentativeDate ? formatISTDate(item.tentativeDate) : "-"}</td>
                                            <td className="p-3 text-slate-500">{item.teachingAid || "PPT"}</td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleDeletePlanItem(idx)}
                                                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                                                    title="Delete row"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {lecturePlan.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400 italic">
                                                No lecture plan items created yet. Add topics above.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* TAB 5: TEACHING DIARY */}
                {activeTab === "diary" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Teaching Diary Logs</h3>
                                <p className="text-xs text-slate-500">Record and manage daily topics taught for this subject & section.</p>
                            </div>
                            <button
                                onClick={() => setIsAddDiaryOpen(true)}
                                className="flex items-center gap-1.5 bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm hover:bg-blue-700 self-start sm:self-auto"
                            >
                                <FaPlus /> Log Today's Entry
                            </button>
                        </div>

                        {/* Modal to Add Diary Entry */}
                        {isAddDiaryOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                                <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                        <h4 className="font-bold text-slate-800 text-sm">Log Teaching Diary Entry</h4>
                                        <button onClick={() => setIsAddDiaryOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                                    </div>
                                    <form onSubmit={handleSaveDiary} className="space-y-4 text-xs">
                                        <div>
                                            <label className="font-bold text-slate-600 block mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={diaryForm.date}
                                                onChange={(e) => setDiaryForm({ ...diaryForm, date: e.target.value })}
                                                className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="font-bold text-slate-600 block mb-1">Class Period</label>
                                            <select
                                                value={diaryForm.periodId}
                                                onChange={(e) => setDiaryForm({ ...diaryForm, periodId: e.target.value })}
                                                className="w-full p-2 border border-slate-200 rounded-lg outline-none font-semibold bg-white"
                                                required
                                            >
                                                <option value="">Select Period...</option>
                                                {periods.map((p: any) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.startTime} - {p.endTime})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="font-bold text-slate-600 block mb-1">Topics Taught</label>
                                            <textarea
                                                value={diaryForm.topicsTaught}
                                                onChange={(e) => setDiaryForm({ ...diaryForm, topicsTaught: e.target.value })}
                                                rows={3}
                                                placeholder="Enter topics covered during this period..."
                                                className="w-full p-2.5 border border-slate-200 rounded-lg outline-none"
                                                required
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsAddDiaryOpen(false)}
                                                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700"
                                            >
                                                {saving ? "Saving..." : "Save Entry"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Teaching Diary Logs Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-3.5">Date</th>
                                        <th className="p-3.5">Period</th>
                                        <th className="p-3.5">Topics Taught</th>
                                        <th className="p-3.5 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {diaries.map((entry: any) => (
                                        <tr key={entry.id} className="hover:bg-slate-50">
                                            <td className="p-3.5 font-semibold text-slate-800">{formatISTDate(entry.date)}</td>
                                            <td className="p-3.5 font-bold text-indigo-600">{entry.period?.name || "Period"}</td>
                                            <td className="p-3.5 text-slate-700 max-w-md">{entry.topicsTaught || "-"}</td>
                                            <td className="p-3.5 text-center">
                                                <span className="bg-emerald-100 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                                                    {entry.status || "Completed"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {diaries.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-center py-12 text-slate-400 italic">
                                                No teaching diary entries logged for this subject yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

            </div>

            {/* View-Only Student Profile Modal */}
            <StudentProfileModal
                studentId={selectedStudentId}
                isOpen={isProfileModalOpen}
                onClose={() => {
                    setIsProfileModalOpen(false);
                    setSelectedStudentId(null);
                }}
            />
        </div>
    );
}
