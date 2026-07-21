"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaBookOpen,
    FaArrowLeft,
    FaCalendarAlt,
    FaChalkboard,
    FaClock,
    FaFilter,
    FaSearch,
    FaRegCalendarTimes,
    FaPlus,
    FaEdit,
    FaTrashAlt,
    FaFileExcel,
    FaFilePdf,
    FaTimes,
    FaUndo
} from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function FacultyTeachingDiary() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mappedSubjects, setMappedSubjects] = useState<any[]>([]);
    const [selectedMappingId, setSelectedMappingId] = useState<string>("");
    const [selectedMapping, setSelectedMapping] = useState<any>(null);

    const [diaries, setDiaries] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [diariesLoading, setDiariesLoading] = useState(false);

    // Client-side search and date filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStartDate, setFilterStartDate] = useState("");
    const [filterEndDate, setFilterEndDate] = useState("");

    // Year and Semester filters for mapped subjects
    const [filterYear, setFilterYear] = useState("");
    const [filterSemester, setFilterSemester] = useState("");

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentDiary, setCurrentDiary] = useState<any>(null);

    // Form states
    const [formDate, setFormDate] = useState("");
    const [formPeriodId, setFormPeriodId] = useState("");
    const [formTopic, setFormTopic] = useState("");
    const [formError, setFormError] = useState("");
    const [formSubmitting, setFormSubmitting] = useState(false);

    // Syllabus Helper States
    const [activeSyllabus, setActiveSyllabus] = useState<any>(null);
    const [selectedDiaryUnit, setSelectedDiaryUnit] = useState<string>("Unit I");

    // Suggest next chronologically uncovered topic(s)
    const nextSuggestedTopics = (() => {
        if (!activeSyllabus || !activeSyllabus.units) return [];
        
        // Flatten all syllabus topics chronologically
        const allSyllabusTopics: string[] = [];
        activeSyllabus.units.forEach((unit: any) => {
            if (!unit.content) return;
            const topics = unit.content
                .split(",")
                .map((s: string) => s.replace(/<[^>]*>/g, "").trim())
                .filter(Boolean);
            allSyllabusTopics.push(...topics);
        });

        // Gather all topics already taught in diaries (except current diary if editing)
        const coveredText = diaries
            .filter((d: any) => !currentDiary || d.id !== currentDiary.id)
            .map((d: any) => (d.topicsTaught || "").toLowerCase())
            .join(" | ");

        // Filter out covered topics
        const suggestions = allSyllabusTopics.filter(topic => {
            const cleanTopic = topic.toLowerCase();
            return !coveredText.includes(cleanTopic);
        });

        return suggestions.slice(0, 2);
    })();

    const handleSmartFill = () => {
        if (nextSuggestedTopics.length > 0) {
            setFormTopic(nextSuggestedTopics.join(", "));
        }
    };

    useEffect(() => {
        if (selectedMapping?.subjectId) {
            fetch(`/api/subjects/${selectedMapping.subjectId}/syllabus`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.syllabus) {
                        setActiveSyllabus(data.syllabus);
                    } else {
                        setActiveSyllabus(null);
                    }
                })
                .catch(err => {
                    console.error("Error fetching syllabus for teaching diary helper:", err);
                    setActiveSyllabus(null);
                });
        } else {
            setActiveSyllabus(null);
        }
    }, [selectedMapping]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/signin");
        } else if (status === "authenticated" && !["FACULTY", "SMS_USER"].includes(session?.user?.role || "")) {
            router.push("/");
        } else if (status === "authenticated") {
            fetchInitialData();
        }
    }, [status, session, router]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            // Fetch periods
            const resPeriods = await fetch("/api/periods");
            if (resPeriods.ok) {
                const dataPeriods = await resPeriods.json();
                setPeriods(dataPeriods);
            }

            // Fetch mapped subjects
            const resDashboard = await fetch("/api/faculty/me/dashboard");
            if (resDashboard.ok) {
                const dataDashboard = await resDashboard.json();
                const subjects = dataDashboard.subjects || [];
                setMappedSubjects(subjects);

                if (subjects.length > 0) {
                    setSelectedMappingId(subjects[0].id);
                    setSelectedMapping(subjects[0]);
                }
            }
        } catch (error) {
            console.error("Error loading initial teaching diary data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDiaries = async () => {
        if (!selectedMapping) return;
        setDiariesLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("subjectId", selectedMapping.subjectId);
            params.append("sectionId", selectedMapping.sectionId);
            params.append("includeAll", "true");
            if (filterStartDate) params.append("startDate", filterStartDate);
            if (filterEndDate) params.append("endDate", filterEndDate);

            const res = await fetch(`/api/teaching-diary?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setDiaries(data);
            }
        } catch (error) {
            console.error("Error loading diaries:", error);
        } finally {
            setDiariesLoading(false);
        }
    };

    // Filter mapped subjects by year and semester
    const filteredMappings = mappedSubjects.filter((m: any) => {
        if (filterYear && m.subject?.year !== filterYear) return false;
        if (filterSemester && m.subject?.semester !== filterSemester) return false;
        return true;
    });

    // Keep selected mapping synchronized when filters change
    useEffect(() => {
        if (filteredMappings.length > 0) {
            const stillValid = filteredMappings.some(m => m.id === selectedMappingId);
            if (!stillValid) {
                setSelectedMappingId(filteredMappings[0].id);
                setSelectedMapping(filteredMappings[0]);
            }
        } else {
            setSelectedMappingId("");
            setSelectedMapping(null);
            setDiaries([]);
        }
    }, [filterYear, filterSemester, mappedSubjects]);

    // Refetch diaries whenever the selected subject/section or date filters change
    useEffect(() => {
        if (selectedMapping) {
            fetchDiaries();
        }
    }, [selectedMapping, filterStartDate, filterEndDate]);

    const handleMappingChange = (mappingId: string) => {
        setSelectedMappingId(mappingId);
        const mapping = mappedSubjects.find(m => m.id === mappingId);
        setSelectedMapping(mapping || null);
    };

    // Client-side text search filter
    const filteredDiaries = diaries.filter((d: any) => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const topicsText = (d.topicsTaught || "").toLowerCase();
            const periodName = (d.period?.name || "").toLowerCase();
            const sectionName = (d.section?.name || "").toLowerCase();
            return topicsText.includes(query) || periodName.includes(query) || sectionName.includes(query);
        }
        return true;
    });

    const clearFilters = () => {
        setFilterStartDate("");
        setFilterEndDate("");
        setSearchQuery("");
        setFilterYear("");
        setFilterSemester("");
    };

    const formatDateDMY = (dateStr: string | Date) => {
        const dateObj = new Date(dateStr);
        const day = dateObj.getDate();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[dateObj.getMonth()];
        const year = dateObj.getFullYear().toString().slice(-2);
        return `${day}-${month}-${year}`;
    };

    const renderTopicText = (text: string) => {
        if (!text) return '<p class="italic text-slate-400">No topics entered.</p>';
        if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
        }
        return text.replace(/\n/g, "<br />");
    };

    // Modal action handlers
    const openAddModal = () => {
        setCurrentDiary(null);
        setFormDate(new Date().toISOString().split("T")[0]);
        setFormPeriodId(periods[0]?.id || "");
        setFormTopic("");
        setFormError("");
        setShowAddModal(true);
    };

    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formSubmitting) return;
        if (!formDate || !formPeriodId || !formTopic.trim()) {
            setFormError("All fields are required.");
            return;
        }
        setFormSubmitting(true);
        setFormError("");
        try {
            const response = await fetch("/api/teaching-diary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date: formDate,
                    subjectId: selectedMapping.subjectId,
                    sectionId: selectedMapping.sectionId,
                    periodId: formPeriodId,
                    topicsTaught: formTopic.trim()
                })
            });

            if (response.ok) {
                setShowAddModal(false);
                fetchDiaries();
            } else {
                const errorData = await response.json();
                setFormError(errorData.error || "Failed to add teaching diary entry.");
            }
        } catch (error: any) {
            setFormError(error.message || "An unexpected error occurred.");
        } finally {
            setFormSubmitting(false);
        }
    };

    const openEditModal = (diary: any) => {
        setCurrentDiary(diary);
        const localDate = new Date(diary.date).toISOString().split("T")[0];
        setFormDate(localDate);
        setFormPeriodId(diary.periodId || "");
        setFormTopic(diary.topicsTaught || "");
        setFormError("");
        setShowEditModal(true);
    };

    const handleEditEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formSubmitting) return;
        if (!formDate || !formPeriodId || !formTopic.trim()) {
            setFormError("All fields are required.");
            return;
        }
        setFormSubmitting(true);
        setFormError("");
        try {
            const response = await fetch("/api/teaching-diary", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: currentDiary.id,
                    date: formDate,
                    periodId: formPeriodId,
                    topicsTaught: formTopic.trim(),
                    sectionId: selectedMapping.sectionId,
                    subjectId: selectedMapping.subjectId
                })
            });

            if (response.ok) {
                setShowEditModal(false);
                fetchDiaries();
            } else {
                const errorData = await response.json();
                setFormError(errorData.error || "Failed to update teaching diary entry.");
            }
        } catch (error: any) {
            setFormError(error.message || "An unexpected error occurred.");
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteEntry = async (id: string) => {
        if (!confirm("Are you sure you want to delete this teaching diary entry?")) {
            return;
        }
        try {
            const response = await fetch(`/api/teaching-diary?id=${id}`, {
                method: "DELETE"
            });

            if (response.ok) {
                fetchDiaries();
            } else {
                const errorData = await response.json();
                alert(errorData.error || "Failed to delete entry.");
            }
        } catch (error: any) {
            alert(error.message || "An unexpected error occurred.");
        }
    };

    // Excel Export matching template
    const handleExportExcel = () => {
        if (!selectedMapping) return;

        const subjectName = selectedMapping.subject?.name || "";
        const ayName = selectedMapping.academicYear?.name || "";
        const semester = selectedMapping.subject?.semester || "";

        const rows = [
            ["Subject: " + subjectName],
            [""],
            ["", "", "Teaching Diary"],
            ["", "", "AY: " + ayName],
            ["Semester: " + semester],
            [""],
            ["S.No", "Date", "Topic"]
        ];

        const sortedDiaries = [...filteredDiaries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        sortedDiaries.forEach((diary, idx) => {
            rows.push([
                idx + 1,
                formatDateDMY(diary.date),
                diary.topicsTaught || ""
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Column widths
        ws["!cols"] = [
            { wch: 8 },  // S.No
            { wch: 15 }, // Date
            { wch: 60 }  // Topic
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Teaching Diary");
        XLSX.writeFile(wb, `Teaching_Diary_${subjectName.replace(/\s+/g, "_")}.xlsx`);
    };

    // PDF Export matching template
    const handleExportPDF = () => {
        if (!selectedMapping) return;

        const doc = new jsPDF();
        const subjectName = selectedMapping.subject?.name || "";
        const ayName = selectedMapping.academicYear?.name || "";
        const semester = selectedMapping.subject?.semester || "";

        // Header Info
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Teaching Diary", 105, 15, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Subject: ${subjectName}`, 14, 25);
        doc.text(`AY: ${ayName}`, 14, 30);
        doc.text(`Semester: ${semester}`, 14, 35);

        const sortedDiaries = [...filteredDiaries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const tableRows = sortedDiaries.map((diary, idx) => [
            idx + 1,
            formatDateDMY(diary.date),
            diary.topicsTaught || ""
        ]);

        autoTable(doc, {
            startY: 40,
            head: [["S.No", "Date", "Topic"]],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 15, halign: "center" }, // S.No
                1: { cellWidth: 30, halign: "center" }, // Date
                2: { cellWidth: "auto" }                 // Topic
            }
        });

        doc.save(`Teaching_Diary_${subjectName.replace(/\s+/g, "_")}.pdf`);
    };

    if (status === "loading" || (loading && mappedSubjects.length === 0)) {
        return <LogoSpinner />;
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                        >
                            <FaArrowLeft size={16} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Teaching Diary Logs</h1>
                            <p className="text-sm text-slate-500">Record, edit, and export your session topics taught</p>
                        </div>
                    </div>

                    {selectedMapping && (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                <FaPlus size={12} />
                                <span>Add Entry</span>
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                <FaFilePdf size={12} />
                                <span>Print PDF</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                            >
                                <FaFileExcel size={12} />
                                <span>Download Excel</span>
                            </button>
                        </div>
                    )}
                </div>

                {mappedSubjects.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                        <FaRegCalendarTimes className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 mb-1">No Mapped Subjects Mapped</h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto">
                            You are not currently mapped to teach any subjects. Please contact the administrator to assign subjects to your profile.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selector and Filter Section */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                                {/* Year Filter */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Year</label>
                                    <select
                                        value={filterYear}
                                        onChange={(e) => setFilterYear(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white shadow-sm font-semibold transition-all"
                                    >
                                        <option value="">All Years</option>
                                        <option value="1">Year 1</option>
                                        <option value="2">Year 2</option>
                                        <option value="3">Year 3</option>
                                        <option value="4">Year 4</option>
                                    </select>
                                </div>

                                {/* Semester Filter */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Semester</label>
                                    <select
                                        value={filterSemester}
                                        onChange={(e) => setFilterSemester(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white shadow-sm font-semibold transition-all"
                                    >
                                        <option value="">All Semesters</option>
                                        <option value="1">Semester 1</option>
                                        <option value="2">Semester 2</option>
                                        <option value="3">Semester 3</option>
                                        <option value="4">Semester 4</option>
                                        <option value="5">Semester 5</option>
                                        <option value="6">Semester 6</option>
                                        <option value="7">Semester 7</option>
                                        <option value="8">Semester 8</option>
                                    </select>
                                </div>

                                {/* Subject & Section Selector */}
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Selected Subject & Section</label>
                                    <select
                                        value={selectedMappingId}
                                        onChange={(e) => handleMappingChange(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 bg-white font-semibold shadow-sm transition-all"
                                    >
                                        {filteredMappings.length === 0 ? (
                                            <option value="">No subjects match filters</option>
                                        ) : (
                                            filteredMappings.map((m: any) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.subject.name} ({m.subject.code}) — Sec {m.section.name} (Yr {m.subject.year} Sem {m.subject.semester})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                {/* Search Query */}
                                <div className="relative">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Search Keywords</label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                            <FaSearch size={12} />
                                        </span>
                                        <input
                                            type="text"
                                            placeholder="Search topics..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm"
                                        />
                                    </div>
                                </div>

                                {/* Date Range Start */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">From Date</label>
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm"
                                    />
                                </div>

                                {/* Date Range End */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">To Date</label>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 shadow-sm"
                                    />
                                </div>
                            </div>

                            {(filterStartDate || filterEndDate || searchQuery || filterYear || filterSemester) && (
                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={clearFilters}
                                        className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                                    >
                                        <FaUndo size={10} />
                                        <span>Reset Filters</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Diaries List */}
                        {diariesLoading ? (
                            <div className="py-12 flex justify-center">
                                <LogoSpinner />
                            </div>
                        ) : filteredDiaries.length > 0 ? (
                            <div className="space-y-6">
                                {filteredDiaries.map((diary: any, idx: number) => (
                                    <motion.div
                                        key={diary.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                                        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow relative"
                                    >
                                        {/* Card Header */}
                                        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                    <FaCalendarAlt className="text-blue-500" />
                                                    {new Date(diary.date).toLocaleDateString("en-IN", {
                                                        timeZone: "Asia/Kolkata",
                                                        weekday: "short",
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric"
                                                    })}
                                                </span>
                                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                    <FaClock className="text-emerald-500" />
                                                    Period {diary.period?.name || "N/A"} ({diary.period?.startTime || ""} - {diary.period?.endTime || ""})
                                                </span>
                                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                    <FaChalkboard className="text-indigo-500" />
                                                    Section {diary.section?.name || "N/A"}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {diary.topicsTaught ? (
                                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                        Completed
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                                        Pending
                                                    </span>
                                                )}
                                                {diary.subject && (
                                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">
                                                        {diary.subject.code}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-6">
                                            {diary.subject && (
                                                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                                    <FaBookOpen className="text-blue-500" />
                                                    {diary.subject.name}
                                                    <span className="text-xs font-normal text-slate-400">
                                                        (Year {diary.subject.year} Sem {diary.subject.semester})
                                                    </span>
                                                </h3>
                                            )}

                                            {diary.topicsTaught ? (
                                                <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50/50 rounded-xl p-4 border border-slate-100 mb-2">
                                                    <div
                                                        dangerouslySetInnerHTML={{
                                                            __html: renderTopicText(diary.topicsTaught)
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm font-medium mb-2">
                                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                                                    <span className="flex-grow">Diary entry is missing for this marked attendance session. Please fill in the topics taught.</span>
                                                </div>
                                            )}

                                            {/* Card Actions Footer */}
                                            <div className="flex justify-end gap-2 mt-4 pt-2 border-t border-slate-100">
                                                {diary.topicsTaught ? (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(diary)}
                                                            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                                        >
                                                            <FaEdit size={12} />
                                                            <span>Edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteEntry(diary.id)}
                                                            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                                        >
                                                            <FaTrashAlt size={12} />
                                                            <span>Delete</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => openEditModal(diary)}
                                                        className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors"
                                                    >
                                                        <FaPlus size={12} />
                                                        <span>Fill Diary Entry</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                                <FaRegCalendarTimes className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-800 mb-1">No Diary Logs Found</h3>
                                <p className="text-sm text-slate-400 max-w-md mx-auto">
                                    We couldn't find any teaching diary entries matching your selected criteria. Click "Add Entry" to start logging topics for this subject-section.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Entry Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FaPlus className="text-blue-500" size={14} />
                                    <span>Add Teaching Diary Log</span>
                                </h2>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    <FaTimes size={16} />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleAddEntry} className="p-6 space-y-4">
                                {formError && (
                                    <div className="bg-red-50 text-red-700 text-xs font-semibold p-3 rounded-lg border border-red-100">
                                        {formError}
                                    </div>
                                )}

                                {/* Read-only Subject and Section */}
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs text-slate-600">
                                    <div>
                                        <span className="font-bold text-slate-400 block uppercase mb-0.5">Subject</span>
                                        <span className="font-semibold text-slate-800">{selectedMapping?.subject?.name}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-400 block uppercase mb-0.5">Section</span>
                                        <span className="font-semibold text-slate-800">Section {selectedMapping?.section?.name}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Date */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                                        />
                                    </div>

                                    {/* Period */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Period</label>
                                        <select
                                            required
                                            value={formPeriodId}
                                            onChange={(e) => setFormPeriodId(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 bg-white"
                                        >
                                            <option value="">Select Period</option>
                                            {periods.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    Period {p.name} ({p.startTime} - {p.endTime})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Topic */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-slate-600">Topics Taught / Description</label>
                                        {nextSuggestedTopics.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleSmartFill}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                            >
                                                ✨ Smart Fill
                                            </button>
                                        )}
                                    </div>
                                    {nextSuggestedTopics.length > 0 && (
                                        <p className="text-[10px] text-slate-500 mb-1.5 bg-slate-50 border border-slate-100 p-1.5 rounded">
                                            <strong>Suggested next topic(s):</strong> {nextSuggestedTopics.join(", ")}
                                        </p>
                                    )}
                                    <textarea
                                        required
                                        rows={4}
                                        placeholder="Enter the topics covered in this session..."
                                        value={formTopic}
                                        onChange={(e) => setFormTopic(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                                    />
                                    {/* Syllabus Topics Helper */}
                                    {activeSyllabus && activeSyllabus.units && (
                                        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Syllabus Topic Helper</span>
                                                <select
                                                    value={selectedDiaryUnit}
                                                    onChange={(e) => setSelectedDiaryUnit(e.target.value)}
                                                    className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded bg-white text-slate-700 focus:outline-none cursor-pointer"
                                                >
                                                    {activeSyllabus.units.map((u: any, idx: number) => (
                                                        <option key={idx} value={u.name || `Unit ${idx+1}`}>
                                                            {u.name || `Unit ${idx+1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* List of parsed topics for selected unit */}
                                            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pt-1">
                                                {(() => {
                                                    const matchedUnit = activeSyllabus.units.find(
                                                        (u: any) => (u.name || "").toUpperCase().replace(/[^A-Z]/g, "") === selectedDiaryUnit.toUpperCase().replace(/[^A-Z]/g, "")
                                                    );
                                                    if (!matchedUnit || !matchedUnit.content) {
                                                        return <span className="text-[10px] text-slate-400">No topics defined in syllabus for this unit.</span>;
                                                    }
                                                    const topics = matchedUnit.content.split(",").map((s: string) => s.replace(/<[^>]*>/g, "").trim()).filter(Boolean);
                                                    if (topics.length === 0) {
                                                        return <span className="text-[10px] text-slate-400">No topics defined.</span>;
                                                    }
                                                    return topics.map((t: string, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                const currentVal = formTopic;
                                                                const newVal = currentVal ? `${currentVal}, ${t}` : t;
                                                                setFormTopic(newVal);
                                                            }}
                                                            className="px-2 py-1 text-[10px] font-medium bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-800 rounded transition-colors text-left flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <span>+ {t}</span>
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formSubmitting}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {formSubmitting ? "Adding..." : "Add Entry"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Entry Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FaEdit className="text-blue-500" size={14} />
                                    <span>Edit Teaching Diary Log</span>
                                </h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                >
                                    <FaTimes size={16} />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleEditEntry} className="p-6 space-y-4">
                                {formError && (
                                    <div className="bg-red-50 text-red-700 text-xs font-semibold p-3 rounded-lg border border-red-100">
                                        {formError}
                                    </div>
                                )}

                                {/* Read-only Subject and Section */}
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs text-slate-600">
                                    <div>
                                        <span className="font-bold text-slate-400 block uppercase mb-0.5">Subject</span>
                                        <span className="font-semibold text-slate-800">{selectedMapping?.subject?.name}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-400 block uppercase mb-0.5">Section</span>
                                        <span className="font-semibold text-slate-800">Section {selectedMapping?.section?.name}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Date */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Date</label>
                                        <input
                                            type="date"
                                            required
                                            disabled={true}
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
                                        />
                                    </div>

                                    {/* Period */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Period</label>
                                        <select
                                            required
                                            disabled={true}
                                            value={formPeriodId}
                                            onChange={(e) => setFormPeriodId(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg focus:outline-none cursor-not-allowed"
                                        >
                                            <option value="">Select Period</option>
                                            {periods.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    Period {p.name} ({p.startTime} - {p.endTime})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Topic */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-slate-600">Topics Taught / Description</label>
                                        {nextSuggestedTopics.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleSmartFill}
                                                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                            >
                                                ✨ Smart Fill
                                            </button>
                                        )}
                                    </div>
                                    {nextSuggestedTopics.length > 0 && (
                                        <p className="text-[10px] text-slate-500 mb-1.5 bg-slate-50 border border-slate-100 p-1.5 rounded">
                                            <strong>Suggested next topic(s):</strong> {nextSuggestedTopics.join(", ")}
                                        </p>
                                    )}
                                    <textarea
                                        required
                                        rows={4}
                                        placeholder="Enter the topics covered in this session..."
                                        value={formTopic}
                                        onChange={(e) => setFormTopic(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
                                    />
                                    {/* Syllabus Topics Helper */}
                                    {activeSyllabus && activeSyllabus.units && (
                                        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Syllabus Topic Helper</span>
                                                <select
                                                    value={selectedDiaryUnit}
                                                    onChange={(e) => setSelectedDiaryUnit(e.target.value)}
                                                    className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded bg-white text-slate-700 focus:outline-none cursor-pointer"
                                                >
                                                    {activeSyllabus.units.map((u: any, idx: number) => (
                                                        <option key={idx} value={u.name || `Unit ${idx+1}`}>
                                                            {u.name || `Unit ${idx+1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {/* List of parsed topics for selected unit */}
                                            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pt-1">
                                                {(() => {
                                                    const matchedUnit = activeSyllabus.units.find(
                                                        (u: any) => (u.name || "").toUpperCase().replace(/[^A-Z]/g, "") === selectedDiaryUnit.toUpperCase().replace(/[^A-Z]/g, "")
                                                    );
                                                    if (!matchedUnit || !matchedUnit.content) {
                                                        return <span className="text-[10px] text-slate-400">No topics defined in syllabus for this unit.</span>;
                                                    }
                                                    const topics = matchedUnit.content.split(",").map((s: string) => s.replace(/<[^>]*>/g, "").trim()).filter(Boolean);
                                                    if (topics.length === 0) {
                                                        return <span className="text-[10px] text-slate-400">No topics defined.</span>;
                                                    }
                                                    return topics.map((t: string, idx: number) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => {
                                                                const currentVal = formTopic;
                                                                const newVal = currentVal ? `${currentVal}, ${t}` : t;
                                                                setFormTopic(newVal);
                                                            }}
                                                            className="px-2 py-1 text-[10px] font-medium bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-700 hover:text-teal-800 rounded transition-colors text-left flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <span>+ {t}</span>
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formSubmitting}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        {formSubmitting ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom CSS for editor styles */}
            <style jsx global>{`
                .prose ul {
                    list-style-type: disc !important;
                    padding-left: 1.5rem !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                }
                .prose ol {
                    list-style-type: decimal !important;
                    padding-left: 1.5rem !important;
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.5rem !important;
                }
                .prose li {
                    margin-top: 0.25rem !important;
                    margin-bottom: 0.25rem !important;
                }
            `}</style>
        </div>
    );
}
