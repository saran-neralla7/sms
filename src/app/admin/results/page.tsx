"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import * as XLSX from "xlsx";
import { FaFileUpload, FaDownload, FaFilter, FaSearch, FaExclamationTriangle, FaTimes, FaCheckSquare, FaSquare, FaCheckCircle, FaInfoCircle, FaSpinner } from "react-icons/fa";
import StudentHoverCard from "@/components/StudentHoverCard";

// ==========================================
// ORACLE REPORTS HTM PARSING HELPERS
// ==========================================

function normalizeGroupName(name: string) {
    if (!name) return "";
    return name
        .replace(/\s*\(\s*L\s*\.?\s*E\s*\.?\s*\)/gi, "")
        .replace(/\s*-\s*L\s*\.?\s*E\s*\.?\b/gi, "")
        .replace(/\s+L\s*\.?\s*E\s*\.?\b/gi, "")
        .trim();
}

function buildGridFromTable(tableEl: HTMLTableElement) {
    const rows = tableEl.rows;
    const numRows = rows.length;
    let numCols = 0;

    for (let r = 0; r < numRows; r++) {
        let currentCols = 0;
        const cells = rows[r].cells;
        for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            const colSpan = cell.colSpan || 1;
            currentCols += colSpan;
        }
        if (currentCols > numCols) {
            numCols = currentCols;
        }
    }

    const grid: any[][] = [];
    for (let r = 0; r < numRows; r++) {
        grid.push(new Array(numCols).fill(null));
    }

    for (let r = 0; r < numRows; r++) {
        const cells = rows[r].cells;
        let currentCol = 0;
        for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            const rowSpan = cell.rowSpan || 1;
            const colSpan = cell.colSpan || 1;

            while (currentCol < numCols && grid[r][currentCol] !== null) {
                currentCol++;
            }

            let cellText = cell.textContent || (cell as any).innerText || "";
            cellText = cellText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

            const cellData = {
                text: cellText,
                isOrigin: true,
                rowSpan: rowSpan,
                colSpan: colSpan
            };

            for (let rs = 0; rs < rowSpan; rs++) {
                for (let cs = 0; cs < colSpan; cs++) {
                    if (r + rs < numRows && currentCol + cs < numCols) {
                        grid[r + rs][currentCol + cs] = {
                            text: cellData.text,
                            isOrigin: (rs === 0 && cs === 0),
                            rowSpan: rowSpan,
                            colSpan: colSpan,
                            originRow: r,
                            originCol: currentCol
                        };
                    }
                }
            }
            currentCol += colSpan;
        }
    }

    return grid;
}

function extractData(grid: any[][]) {
    const numRows = grid.length;
    if (numRows === 0) return { collegeName: "", groupName: "", subjects: [], students: [] };
    const numCols = grid[0].length;

    let collegeName = "";
    let groupName = "";
    let nameColStart = -1, nameColEnd = -1;
    let sgpaColStart = -1, sgpaColEnd = -1;
    let cgpaColStart = -1, cgpaColEnd = -1;
    let statusColStart = -1, statusColEnd = -1;

    for (let r = 0; r < Math.min(15, numRows); r++) {
        for (let c = 0; c < numCols; c++) {
            const cell = grid[r][c];
            if (cell && cell.isOrigin) {
                const text = cell.text.trim();
                if (text.includes("COLLEGE") || text.includes("UNIVERSITY") || text.includes("INSTITUTE") || text.includes("COURSES")) {
                    collegeName = text.split("\n")[0];
                }
                if (text.includes("GROUP :")) {
                    const parts = text.split("GROUP :");
                    if (parts.length > 1) {
                        groupName = normalizeGroupName(parts[1].split("\n")[0].trim());
                    }
                }
            }
        }
    }

    const headerRowIdx = grid.findIndex(row =>
        row.some(cell => cell && cell.isOrigin && cell.text.toUpperCase().includes("NAME OF THE STUDENT"))
    );

    const subjects: any[] = [];
    if (headerRowIdx !== -1) {
        for (let c = 0; c < numCols; c++) {
            const cell = grid[headerRowIdx][c];
            if (cell && cell.isOrigin) {
                const text = cell.text.toUpperCase().trim();
                const colStart = cell.originCol;
                const colEnd = cell.originCol + cell.colSpan - 1;

                if (text === "NAME OF THE STUDENT" || text.includes("NAME OF THE")) {
                    nameColStart = colStart;
                    nameColEnd = colEnd;
                } else if (text === "SGPA") {
                    sgpaColStart = colStart;
                    sgpaColEnd = colEnd;
                } else if (text === "CGPA") {
                    cgpaColStart = colStart;
                    cgpaColEnd = colEnd;
                } else if (text === "STATUS") {
                    statusColStart = colStart;
                    statusColEnd = colEnd;
                } else if (text && text !== "SIGNATURE" && text !== "REGD NO" && text !== "NAME OF THE STUDENT" && text !== "GENDER" && !text.includes("PAGE NO")) {
                    if (colStart > 6 && colEnd < numCols - 4 && !text.includes("EXAMINATION") && !text.includes("GROUP :") && !text.includes("MARKS GALLY") && text.length < 40) {
                        if (!subjects.some(s => s.name === cell.text.trim())) {
                            subjects.push({
                                name: cell.text.trim(),
                                colStart: colStart,
                                colEnd: colEnd
                            });
                        }
                    }
                }
            }
        }
    }

    const students: any[] = [];
    for (let r = 0; r < numRows; r++) {
        let regdCell = null;

        for (let c = 0; c < numCols; c++) {
            const cell = grid[r][c];
            if (cell && cell.isOrigin) {
                const text = cell.text;
                if (/^\d{10}$/.test(text) || (/^[A-Z0-9]{10}$/i.test(text) && text.match(/\d/))) {
                    regdCell = cell;
                    break;
                }
            }
        }

        if (regdCell) {
            const regdNo = regdCell.text.trim();
            
            let studentName = "";
            for (let c = nameColStart - 2; c <= nameColEnd + 3; c++) {
                if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                    const txt = grid[r][c].text;
                    if (txt && txt !== regdNo && !/^\d{10}$/.test(txt) && txt.length > 3 && txt === txt.toUpperCase()) {
                        studentName = txt.split("\n")[0].trim();
                        break;
                    }
                }
            }

            let gender = "M"; 
            let genderColIdx = -1;
            const searchGenderLimit = subjects[0] ? subjects[0].colStart : numCols;
            for (let c = nameColEnd + 1; c < searchGenderLimit; c++) {
                if (grid[r][c] && grid[r][c].isOrigin) {
                    const txt = grid[r][c].text.trim();
                    if (txt === "M" || txt === "F") {
                        gender = txt;
                        genderColIdx = c;
                        break;
                    }
                }
            }

            let sgpa = "0.00";
            let cgpa = "0.00";
            let status = "PASS";

            let foundSgpa = false;
            for (let c = sgpaColStart; c <= sgpaColEnd; c++) {
                if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                    const txt = grid[r][c].text.trim();
                    if (/^\d+(\.\d+)?$/.test(txt)) {
                        sgpa = txt;
                        foundSgpa = true;
                        break;
                    }
                }
            }
            if (!foundSgpa) {
                for (let c = sgpaColStart - 1; c <= sgpaColEnd + 2; c++) {
                    if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                        const txt = grid[r][c].text.trim();
                        if (/^\d+(\.\d+)?$/.test(txt)) {
                            sgpa = txt;
                            break;
                        }
                    }
                }
            }

            let foundCgpa = false;
            for (let c = cgpaColStart; c <= cgpaColEnd; c++) {
                if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                    const txt = grid[r][c].text.trim();
                    if (/^\d+(\.\d+)?$/.test(txt)) {
                        cgpa = txt;
                        foundCgpa = true;
                        break;
                    }
                }
            }
            if (!foundCgpa) {
                for (let c = cgpaColStart - 1; c <= cgpaColEnd + 2; c++) {
                    if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                        const txt = grid[r][c].text.trim();
                        if (/^\d+(\.\d+)?$/.test(txt)) {
                            cgpa = txt;
                            break;
                        }
                    }
                }
            }

            for (let c = statusColStart - 1; c <= statusColEnd + 2; c++) {
                if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                    const txt = grid[r][c].text.toUpperCase();
                    if (txt === "PASS" || txt === "FAIL") {
                        status = txt;
                        break;
                    }
                }
            }

            const subjectDetails: any = {};
            subjects.forEach(subj => {
                const cellValues: string[] = [];
                for (let c = subj.colStart - 1; c <= subj.colEnd + 1; c++) {
                    if (c >= 0 && c < numCols && grid[r][c] && grid[r][c].isOrigin) {
                        if (c === genderColIdx) continue;
                        const txt = grid[r][c].text.trim();
                        if (txt && txt !== studentName && txt !== regdNo && txt !== sgpa && txt !== cgpa && txt !== status) {
                            if (!cellValues.includes(txt)) {
                                cellValues.push(txt);
                            }
                        }
                    }
                }

                let gradePoints = "-";
                let grade = "-";
                let credits = "-";

                const gradeIdx = cellValues.findIndex(v => /^[a-z\+\-]+$/i.test(v) && v !== "-");

                if (gradeIdx !== -1) {
                    grade = cellValues[gradeIdx];
                    if (gradeIdx === 1 && cellValues.length >= 3) {
                        gradePoints = cellValues[0];
                        credits = cellValues[2];
                    } else if (gradeIdx === 0 && cellValues.length >= 3) {
                        gradePoints = cellValues[1];
                        credits = cellValues[2];
                    } else if (cellValues.length === 2) {
                        if (gradeIdx === 0) {
                            credits = cellValues[1];
                        } else {
                            credits = cellValues[0];
                        }
                    }
                } else {
                    cellValues.forEach(val => {
                        if (/^[OABCDEFP]$/i.test(val) || val === "Ab" || val === "F" || val === "S" || val === "A+" || val === "B+") {
                            grade = val;
                        } else if (/^\d+$/.test(val)) {
                            const numVal = parseInt(val, 10);
                            if (numVal >= 1 && numVal <= 5) {
                                credits = String(numVal);
                            } else if (numVal >= 0 && numVal <= 10) {
                                gradePoints = String(numVal);
                            }
                        }
                    });
                }

                subjectDetails[subj.name] = {
                    points: gradePoints,
                    grade: grade,
                    credits: credits,
                    rawValues: cellValues
                };
            });

            students.push({
                regdNo: regdNo,
                name: studentName,
                gender: gender,
                subjects: subjectDetails,
                sgpa: sgpa,
                cgpa: cgpa,
                status: status
            });
        }
    }

    return {
        collegeName: collegeName,
        groupName: groupName,
        subjects: subjects,
        students: students
    };
}

function cleanString(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMapSubjects(htmSubjects: any[], dbSubs: any[]) {
    const mapping: { [key: string]: string } = {};
    htmSubjects.forEach(sub => {
        const cleanHtm = cleanString(sub.name);
        
        let match = dbSubs.find(dbSub => {
            const cleanCode = cleanString(dbSub.code);
            const cleanShort = dbSub.shortName ? cleanString(dbSub.shortName) : "";
            const cleanName = cleanString(dbSub.name);
            
            return cleanCode === cleanHtm || 
                   cleanShort === cleanHtm || 
                   cleanShort.includes(cleanHtm) || 
                   cleanHtm.includes(cleanShort) ||
                   cleanName.includes(cleanHtm) ||
                   cleanHtm.includes(cleanName);
        });

        mapping[sub.name] = match ? match.code : "";
    });
    return mapping;
}

function detectDepartment(groupName: string, departments: any[]) {
    const cleaned = groupName.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (cleaned.includes("CSM")) return departments.find(d => d.code === "CSM")?.id || "";
    if (cleaned.includes("CSE")) return departments.find(d => d.code === "CSE")?.id || "";
    if (cleaned.includes("ECE")) return departments.find(d => d.code === "ECE")?.id || "";
    if (cleaned.includes("ME") || cleaned.includes("MECH")) return departments.find(d => d.code === "MECH")?.id || "";
    if (cleaned.includes("CE") || cleaned.includes("CIVIL")) return departments.find(d => d.code === "CIVIL")?.id || "";
    return "";
}

function detectSemesterAndYear(htmlText: string) {
    const text = htmlText.toUpperCase();
    let year = "1";
    let semester = "1";
    
    if (text.includes("FIRST SEMESTER") || text.includes("1ST SEMESTER") || text.includes("I SEMESTER")) {
        year = "1"; semester = "1";
    } else if (text.includes("SECOND SEMESTER") || text.includes("2ND SEMESTER") || text.includes("II SEMESTER")) {
        year = "1"; semester = "2";
    } else if (text.includes("THIRD SEMESTER") || text.includes("3RD SEMESTER") || text.includes("III SEMESTER")) {
        year = "2"; semester = "1";
    } else if (text.includes("FOURTH SEMESTER") || text.includes("4TH SEMESTER") || text.includes("IV SEMESTER")) {
        year = "2"; semester = "2";
    } else if (text.includes("FIFTH SEMESTER") || text.includes("5TH SEMESTER") || text.includes("V SEMESTER")) {
        year = "3"; semester = "1";
    } else if (text.includes("SIXTH SEMESTER") || text.includes("6TH SEMESTER") || text.includes("VI SEMESTER")) {
        year = "3"; semester = "2";
    } else if (text.includes("SEVENTH SEMESTER") || text.includes("7TH SEMESTER") || text.includes("VII SEMESTER")) {
        year = "4"; semester = "1";
    } else if (text.includes("EIGHTH SEMESTER") || text.includes("8TH SEMESTER") || text.includes("VIII SEMESTER")) {
        year = "4"; semester = "2";
    }
    return { year, semester };
}

export default function ResultsPage() {
    const { data: session } = useSession();
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [departments, setDepartments] = useState<any[]>([]);
    const [regulations, setRegulations] = useState<any[]>([]);

    // HTM Upload State
    const [isHtmMode, setIsHtmMode] = useState(false);
    const [htmFile, setHtmFile] = useState<File | null>(null);
    const [parsedReport, setParsedReport] = useState<any | null>(null);
    const [parsedGroups, setParsedGroups] = useState<any[]>([]);
    const [activeGroupIdx, setActiveGroupIdx] = useState<number>(0);
    const [dbSubjects, setDbSubjects] = useState<any[]>([]);
    const [subjectMapping, setSubjectMapping] = useState<{ [key: string]: string }>({});
    const [htmYear, setHtmYear] = useState("");
    const [htmSem, setHtmSem] = useState("");
    const [htmDeptId, setHtmDeptId] = useState("");
    const [htmRegulation, setHtmRegulation] = useState("R22");

    // Template Modal State
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [isPastResults, setIsPastResults] = useState(false);
    const [templateCtx, setTemplateCtx] = useState({
        departmentId: "", year: "", semester: "", studentYear: "", regulation: "", sectionIds: [] as string[]
    });
    const [availableSections, setAvailableSections] = useState<any[]>([]);

    // Edit Modal State
    const [editModeResult, setEditModeResult] = useState<any | null>(null);
    const [editForm, setEditForm] = useState<{ sgpa: string, cgpa: string, grades: any[] }>({ sgpa: "", cgpa: "", grades: [] });
    const [isSaving, setIsSaving] = useState(false);

    const clearFilters = () => {
        setYear("");
        setSemester("");
        setDepartmentId("");
    };

    useEffect(() => {
        if (templateCtx.departmentId) {
            fetch(`/api/sections?departmentId=${templateCtx.departmentId}`)
                .then(res => res.json())
                .then(data => setAvailableSections(data));
        } else {
            setAvailableSections([]);
        }
    }, [templateCtx.departmentId]);

    // Upload State
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [uploadData, setUploadData] = useState<any[]>([]);
    const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | null, message: string }>({ type: null, message: "" });

    useEffect(() => {
        if (session?.user.role === "ADMIN") {
            fetchDepartments();
            fetchRegulations();
        }
    }, [session]);

    const fetchRegulations = async () => {
        try {
            const res = await fetch("/api/regulations");
            if (res.ok) setRegulations(await res.json());
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (!isUploadMode && !isHtmMode) {
            fetchResults();
        }
    }, [year, semester, departmentId, isUploadMode, isHtmMode]);

    const fetchDepartments = async () => {
        const res = await fetch("/api/departments");
        if (res.ok) setDepartments(await res.json());
    };

    const fetchResults = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (semester) params.append("semester", semester);
            if (departmentId) params.append("departmentId", departmentId);

            const res = await fetch(`/api/results?${params}`);
            if (res.ok) setResults(await res.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadHtmSubjects = async (deptId: string, yr: string, sem: string) => {
        if (!deptId || !yr || !sem) return [];
        try {
            const params = new URLSearchParams({
                departmentId: deptId,
                year: yr,
                semester: sem
            });
            const res = await fetch(`/api/subjects?${params}`);
            if (res.ok) {
                const data = await res.json();
                setDbSubjects(data);
                return data;
            }
        } catch (e) {
            console.error("Failed to load subjects for HTM mapping:", e);
        }
        return [];
    };

    const handleHtmFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setHtmFile(file);

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const tables = doc.querySelectorAll("table");
            if (tables.length === 0) {
                alert("Could not find any table elements in the uploaded HTML file.");
                return;
            }

            const groupsMap: { [groupKey: string]: any } = {};

            for (let i = 0; i < tables.length; i++) {
                const grid = buildGridFromTable(tables[i]);
                const report = extractData(grid);
                
                if (!report.groupName) continue;
                
                const groupKey = report.groupName;
                if (!groupsMap[groupKey]) {
                    groupsMap[groupKey] = {
                        groupName: report.groupName,
                        collegeName: report.collegeName,
                        subjects: report.subjects,
                        students: []
                    };
                }
                
                // Merge subjects
                report.subjects.forEach((sub: any) => {
                    if (!groupsMap[groupKey].subjects.some((s: any) => s.name === sub.name)) {
                        groupsMap[groupKey].subjects.push(sub);
                    }
                });

                // Merge students
                report.students.forEach((student: any) => {
                    if (!groupsMap[groupKey].students.some((s: any) => s.regdNo === student.regdNo)) {
                        groupsMap[groupKey].students.push(student);
                    }
                });
            }

            const groups = Object.values(groupsMap);
            if (groups.length === 0) {
                alert("No student records or groups detected in the HTM file.");
                return;
            }

            setParsedGroups(groups);
            setActiveGroupIdx(0);
            
            const activeGroup = groups[0];
            setParsedReport(activeGroup);
            setIsHtmMode(true);
            
            const detectedSemYear = detectSemesterAndYear(text);
            const detectedDeptId = detectDepartment(activeGroup.groupName, departments);
            
            setHtmYear(detectedSemYear.year);
            setHtmSem(detectedSemYear.semester);
            setHtmDeptId(detectedDeptId);
            setHtmRegulation("R22"); // Default regulation

            const subs = await loadHtmSubjects(detectedDeptId, detectedSemYear.year, detectedSemYear.semester);
            const filteredSubs = subs.filter((s: any) => !s.regulation || s.regulation.name === "R22");
            const mapping = autoMapSubjects(activeGroup.subjects, filteredSubs);
            
            setSubjectMapping(mapping);
        };
        reader.readAsText(file);
    };

    const handleActiveGroupChange = async (idx: number) => {
        if (idx < 0 || idx >= parsedGroups.length) return;
        setActiveGroupIdx(idx);
        
        const activeGroup = parsedGroups[idx];
        setParsedReport(activeGroup);
        
        const detectedDeptId = detectDepartment(activeGroup.groupName, departments);
        setHtmDeptId(detectedDeptId);
        
        const subs = await loadHtmSubjects(detectedDeptId, htmYear, htmSem);
        const filteredSubs = subs.filter((s: any) => !s.regulation || s.regulation.name === htmRegulation);
        const mapping = autoMapSubjects(activeGroup.subjects, filteredSubs);
        setSubjectMapping(mapping);
    };

    const handleHtmDeptChange = async (deptId: string) => {
        setHtmDeptId(deptId);
        const subs = await loadHtmSubjects(deptId, htmYear, htmSem);
        const filteredSubs = subs.filter((s: any) => !s.regulation || s.regulation.name === htmRegulation);
        const mapping = autoMapSubjects(parsedReport.subjects, filteredSubs);
        setSubjectMapping(mapping);
    };

    const handleHtmYearChange = async (yr: string) => {
        setHtmYear(yr);
        const subs = await loadHtmSubjects(htmDeptId, yr, htmSem);
        const filteredSubs = subs.filter((s: any) => !s.regulation || s.regulation.name === htmRegulation);
        const mapping = autoMapSubjects(parsedReport.subjects, filteredSubs);
        setSubjectMapping(mapping);
    };

    const handleHtmSemChange = async (sem: string) => {
        setHtmSem(sem);
        const subs = await loadHtmSubjects(htmDeptId, htmYear, sem);
        const filteredSubs = subs.filter((s: any) => !s.regulation || s.regulation.name === htmRegulation);
        const mapping = autoMapSubjects(parsedReport.subjects, filteredSubs);
        setSubjectMapping(mapping);
    };

    const handleHtmRegulationChange = (reg: string) => {
        setHtmRegulation(reg);
        const filteredSubs = dbSubjects.filter((s: any) => !s.regulation || s.regulation.name === reg);
        const mapping = autoMapSubjects(parsedReport.subjects, filteredSubs);
        setSubjectMapping(mapping);
    };

    const handleHtmUploadSubmit = async () => {
        if (!htmDeptId || !htmYear || !htmSem) {
            alert("Please select Department, Year and Semester.");
            return;
        }

        setLoading(true);
        try {
            const payload = parsedReport.students.map((student: any) => {
                const grades: any[] = [];
                Object.entries(student.subjects).forEach(([htmSubName, details]: [string, any]) => {
                    const mappedCode = subjectMapping[htmSubName];
                    if (mappedCode) {
                        grades.push({
                            subjectCode: mappedCode,
                            grade: details.grade
                        });
                    }
                });

                return {
                    rollNumber: student.regdNo,
                    year: htmYear,
                    semester: htmSem,
                    sgpa: student.sgpa,
                    cgpa: student.cgpa,
                    grades: grades
                };
            });

            const res = await fetch("/api/results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (result.success !== undefined) {
                setUploadStatus({ 
                    type: "success", 
                    message: `Successfully uploaded ${result.success} student records for ${parsedReport.groupName}.` 
                });
                
                const remainingGroups = parsedGroups.filter((_, i) => i !== activeGroupIdx);
                setParsedGroups(remainingGroups);
                
                setTimeout(() => {
                    setUploadStatus({ type: null, message: "" });
                    if (remainingGroups.length > 0) {
                        setActiveGroupIdx(0);
                        const nextGroup = remainingGroups[0];
                        setParsedReport(nextGroup);
                        
                        const detectedDeptId = detectDepartment(nextGroup.groupName, departments);
                        setHtmDeptId(detectedDeptId);
                        
                        loadHtmSubjects(detectedDeptId, htmYear, htmSem).then((subs) => {
                            const filteredSubs = subs.filter((s: any) => !s.regulation || s.regulation.name === htmRegulation);
                            const mapping = autoMapSubjects(nextGroup.subjects, filteredSubs);
                            setSubjectMapping(mapping);
                        });
                    } else {
                        setIsHtmMode(false);
                        setParsedReport(null);
                        setHtmFile(null);
                        fetchResults();
                    }
                }, 2500);
            } else {
                setUploadStatus({ type: "error", message: result.error || "Upload failed." });
            }
        } catch (e) {
            console.error(e);
            setUploadStatus({ type: "error", message: "Error uploading parsed HTM data." });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            processUploadData(data);
        };
        reader.readAsBinaryString(file);
    };

    const processUploadData = (data: any[]) => {
        // Expected columns: "Roll Number", "SGPA", "CGPA", ...Subjects (Codes)
        // We need to transform this into the JSON structure expected by API
        // grades: [{ subjectCode: "CS101", grade: "O" }]

        const processed = data.map((row: any) => {
            const rollNumber = row["Roll Number"] || row["RollNumber"] || row["Roll No"];
            if (!rollNumber) return null;

            const sgpa = row["SGPA"];
            const cgpa = row["CGPA"];

            // Extract grades (keys that are NOT Roll Number, SGPA, CGPA, Name)
            const grades: any[] = [];
            Object.keys(row).forEach(key => {
                const upperKey = key.toUpperCase();
                if (["ROLL NUMBER", "ROLL NO", "ROLLNUMBER", "NAME", "STUDENT NAME", "SGPA", "CGPA", "S.NO"].includes(upperKey)) {
                    return;
                }
                // Assume Column Name IS Subject Code
                grades.push({
                    subjectCode: key,
                    grade: row[key] // The value at that cell is the grade
                });
            });

            return {
                rollNumber,
                year, // Taken from filter context (User must select Year/Sem before upload to be safe)
                semester,
                sgpa: String(sgpa || ""),
                cgpa: String(cgpa || ""),
                grades
            };
        }).filter(Boolean);

        setUploadData(processed);
        setIsUploadMode(true);
    };

    const handleDeleteResult = async (id: string, rollNumber: string) => {
        if (!confirm(`Are you sure you want to delete the result record for ${rollNumber}?`)) return;
        
        try {
            const res = await fetch(`/api/results/${id}`, { method: "DELETE" });
            if (res.ok) {
                setResults(prev => prev.filter(r => r.id !== id));
            } else {
                alert("Failed to delete result");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting result");
        }
    };

    const handleEditSave = async () => {
        if (!editModeResult) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/results/${editModeResult.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                const updatedResult = await res.json();
                setResults(prev => prev.map(r => r.id === updatedResult.result.id ? { ...r, ...updatedResult.result } : r));
                setEditModeResult(null);
            } else {
                alert("Failed to update result");
            }
        } catch (e) {
            console.error(e);
            alert("Error updating result");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditClick = (res: any) => {
        setEditModeResult(res);
        setEditForm({
            sgpa: res.sgpa || "",
            cgpa: res.cgpa || "",
            grades: Array.isArray(res.grades) ? JSON.parse(JSON.stringify(res.grades)) : []
        });
    };

    const handleGradeChange = (subjectCode: string, newGrade: string) => {
        setEditForm(prev => {
            const newGrades = [...prev.grades];
            const idx = newGrades.findIndex(g => g.subjectCode === subjectCode);
            if (idx >= 0) {
                newGrades[idx].grade = newGrade;
            } else {
                newGrades.push({ subjectCode, grade: newGrade });
            }
            return { ...prev, grades: newGrades };
        });
    };

    const handleUploadSubmit = async () => {
        if (!year || !semester) {
            alert("Please select Year and Semester context for this upload.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(uploadData.map(d => ({ ...d, year, semester })))
            });

            const result = await res.json();
            if (result.success !== undefined) {
                setUploadStatus({ type: "success", message: `Uploaded ${result.success} records. ${result.failed} failed.` });
                setTimeout(() => {
                    setIsUploadMode(false);
                    setUploadData([]);
                    setUploadStatus({ type: null, message: "" });
                    fetchResults();
                }, 2000);
            } else {
                setUploadStatus({ type: "error", message: "Upload failed." });
            }
        } catch (e) {
            setUploadStatus({ type: "error", message: "Error uploading." });
        } finally {
            setLoading(false);
        }
    };

    const generateSmartTemplate = async () => {
        if (!templateCtx.departmentId || !templateCtx.year || !templateCtx.semester) {
            alert("Please select Department, Year and Semester");
            return;
        }

        if (isPastResults && !templateCtx.studentYear) {
            alert("Please select the 'Target Student Batch' (Current Year of the students).");
            return;
        }

        const params = new URLSearchParams();
        params.set("departmentId", templateCtx.departmentId);
        params.set("year", templateCtx.year);
        params.set("semester", templateCtx.semester);
        params.set("regulation", templateCtx.regulation);
        if (templateCtx.sectionIds.length > 0) {
            params.set("sectionIds", templateCtx.sectionIds.join(","));
        }
        if (isPastResults && templateCtx.studentYear) {
            params.set("studentYear", templateCtx.studentYear);
        }

        try {
            const res = await fetch(`/api/results/template?${params}`);
            if (!res.ok) throw new Error("Failed to generate");

            const data = await res.json();

            const ws = XLSX.utils.json_to_sheet(data.rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Marks");
            XLSX.writeFile(wb, `Results_Template_${templateCtx.year}_${templateCtx.semester}.xlsx`);

            setShowTemplateModal(false);
        } catch (e) {
            alert("Failed to generate template");
        }
    };

    const exportData = () => {
        if (results.length === 0) return;

        const rows = results.map(r => {
            const row: any = {
                "Roll Number": r.student?.rollNumber,
                "Name": r.student?.name,
                "Year": r.year,
                "Semester": r.semester,
                "SGPA": r.sgpa,
                "CGPA": r.cgpa
            };
            (r.grades as any[] || []).forEach((g: any) => {
                row[g.subjectCode] = g.grade;
            });
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, `Results_${year || 'All'}_${semester || 'All'}.xlsx`);
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Semester Results</h1>
                    <p className="text-slate-500">Upload and manage student results.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportData} disabled={results.length === 0} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        <FaDownload /> Export Data
                    </button>
                    <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <FaDownload /> Template
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-md transition-all">
                        <FaFileUpload /> Upload HTM Results
                        <input type="file" accept=".html,.htm" className="hidden" onChange={handleHtmFileUpload} />
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shadow-md transition-all">
                        <FaFileUpload /> Upload Excel
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                    <FaFilter /> <span className="text-sm font-medium">Filter:</span>
                </div>
                {session?.user.role === "ADMIN" && (
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                )}
                <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                    <option value="">Select Year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500">
                    <option value="">Select Sem</option>
                    <option value="1">1st Sem</option>
                    <option value="2">2nd Sem</option>
                </select>
                <button
                    onClick={clearFilters}
                    className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors"
                >
                    Clear
                </button>
            </div>

            {uploadStatus.message && (
                <div className={`mb-6 rounded-lg p-4 text-sm font-medium ${uploadStatus.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {uploadStatus.message}
                </div>
            )}

            {isHtmMode && parsedReport ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-lg mb-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center border-b border-indigo-200 pb-4">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-900">
                                <FaInfoCircle className="text-xl text-indigo-600" />
                                <h3 className="text-xl font-bold">Review HTM Results Upload</h3>
                            </div>
                            <p className="text-sm text-indigo-700 mt-1 font-medium">
                                Detected: <span className="font-bold">{parsedReport.collegeName || "Unknown College"}</span> • Group: <span className="font-bold">{parsedReport.groupName || "Unknown Group"}</span>
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setIsHtmMode(false);
                                    setParsedReport(null);
                                    setHtmFile(null);
                                }}
                                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleHtmUploadSubmit}
                                disabled={loading}
                                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md disabled:opacity-50 transition-all"
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin" /> Saving...
                                    </>
                                ) : (
                                    <>
                                        <FaCheckCircle /> Save Results
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {parsedGroups.length > 1 && (
                        <div className="mb-6 flex flex-col gap-2 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-extrabold text-indigo-700">
                                    {parsedGroups.length}
                                </span>
                                Departments detected in file. Select to review & map:
                            </span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {parsedGroups.map((group, idx) => (
                                    <button
                                        key={group.groupName}
                                        onClick={() => handleActiveGroupChange(idx)}
                                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all shadow-sm flex items-center gap-2 ${
                                            idx === activeGroupIdx
                                                ? "bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-1"
                                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                                        }`}
                                    >
                                        <span>{group.groupName}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                            idx === activeGroupIdx ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-600"
                                        }`}>
                                            {group.students.length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata Overrides */}
                    <div className="mb-6 grid gap-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm md:grid-cols-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
                            <select
                                value={htmDeptId}
                                onChange={(e) => handleHtmDeptChange(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-medium"
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Year</label>
                            <select
                                value={htmYear}
                                onChange={(e) => handleHtmYearChange(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-medium"
                            >
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Semester</label>
                            <select
                                value={htmSem}
                                onChange={(e) => handleHtmSemChange(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-medium"
                            >
                                <option value="1">1st Semester</option>
                                <option value="2">2nd Semester</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Regulation</label>
                            <select
                                value={htmRegulation}
                                onChange={(e) => handleHtmRegulationChange(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-slate-50 font-medium"
                            >
                                {regulations.map(r => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Subject Mapping Table */}
                    <div className="mb-6 rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <span>Subject Column Mapping</span>
                            <span className="text-xs font-normal text-slate-500">(Mapped subjects will import grades; unmapped columns will be skipped)</span>
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {parsedReport.subjects.map((sub: any) => {
                                const mappedCode = subjectMapping[sub.name];
                                const mappedSubject = dbSubjects.find(s => s.code === mappedCode);
                                return (
                                    <div key={sub.name} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold text-indigo-950 font-mono">{sub.name}</span>
                                            {mappedCode ? (
                                                <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-200">Mapped</span>
                                            ) : (
                                                <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">Unmapped</span>
                                            )}
                                        </div>
                                        <select
                                            value={mappedCode}
                                            onChange={(e) => {
                                                setSubjectMapping(prev => ({
                                                    ...prev,
                                                    [sub.name]: e.target.value
                                                }));
                                            }}
                                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-500 bg-white"
                                        >
                                            <option value="">-- Skip this subject --</option>
                                            {dbSubjects
                                                .filter(s => !s.regulation || s.regulation.name === htmRegulation)
                                                .map(s => (
                                                    <option key={s.id} value={s.code}>
                                                        {s.code} - {s.name}
                                                    </option>
                                                ))}
                                        </select>
                                        {mappedSubject && (
                                            <span className="text-xs text-slate-500 truncate" title={mappedSubject.name}>
                                                {mappedSubject.name}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-4">Student Records Preview ({parsedReport.students.length} students detected)</h4>
                        <div className="overflow-x-auto max-h-96 rounded-lg border border-slate-200">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">Roll Number</th>
                                        <th className="p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200">Student Name</th>
                                        <th className="p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 text-center">Gender</th>
                                        <th className="p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 text-center">SGPA</th>
                                        <th className="p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 text-center">CGPA</th>
                                        <th className="p-3 font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 text-center">Status</th>
                                        {parsedReport.subjects.map((sub: any) => {
                                            const code = subjectMapping[sub.name];
                                            return (
                                                <th key={sub.name} className="p-3 font-semibold text-slate-700 bg-slate-50 text-center border-r border-slate-200" title={sub.name}>
                                                    {code || sub.name}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {parsedReport.students.map((student: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-mono border-r border-slate-100">{student.regdNo}</td>
                                            <td className="p-3 font-medium text-slate-900 border-r border-slate-100 truncate max-w-[200px]" title={student.name}>
                                                {student.name}
                                            </td>
                                            <td className="p-3 text-center border-r border-slate-100 text-slate-500">{student.gender}</td>
                                            <td className="p-3 text-center font-mono border-r border-slate-100 font-semibold">{student.sgpa}</td>
                                            <td className="p-3 text-center font-mono border-r border-slate-100 text-slate-500">{student.cgpa}</td>
                                            <td className="p-3 text-center border-r border-slate-100">
                                                <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${student.status === "PASS" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            {parsedReport.subjects.map((sub: any) => {
                                                const details = student.subjects[sub.name] || {};
                                                const isFail = details.grade === "F" || details.grade === "Ab";
                                                return (
                                                    <td key={sub.name} className={`p-3 text-center font-semibold border-r border-slate-100 ${isFail ? "text-red-600 bg-red-50/20" : "text-slate-700"}`}>
                                                        {details.grade || "-"}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : isUploadMode ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="font-bold text-blue-900">Review Upload ({uploadData.length} records)</h3>
                        <div className="flex gap-2">
                            <button onClick={() => setIsUploadMode(false)} className="px-4 py-2 text-sm text-blue-600 hover:underline">Cancel</button>
                            <button onClick={handleUploadSubmit} disabled={loading} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                {loading ? "Uploading..." : "Confirm Upload"}
                            </button>
                        </div>
                    </div>

                    {!year || !semester ? (
                        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded border border-amber-200 mb-4">
                            <FaExclamationTriangle /> Please select Year and Semester from the filters above to assign context to these results.
                        </div>
                    ) : null}

                    <div className="max-h-96 overflow-auto rounded-lg border border-blue-200 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="p-3 font-semibold text-slate-700">Roll No</th>
                                    <th className="p-3 font-semibold text-slate-700">SGPA</th>
                                    <th className="p-3 font-semibold text-slate-700">CGPA</th>
                                    <th className="p-3 font-semibold text-slate-700">Subjects Found</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {uploadData.slice(0, 50).map((row, i) => (
                                    <tr key={i}>
                                        <td className="p-3">{row.rollNumber}</td>
                                        <td className="p-3 font-mono">{row.sgpa}</td>
                                        <td className="p-3 font-mono">{row.cgpa}</td>
                                        <td className="p-3 text-xs text-slate-500">
                                            {row.grades.map((g: any) => g.subjectCode).join(", ")}
                                        </td>
                                    </tr>
                                ))}
                                {uploadData.length > 50 && (
                                    <tr><td colSpan={4} className="p-3 text-center text-slate-500">...and {uploadData.length - 50} more</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Results View */
                <div className="space-y-6">
                    {loading ? (
                        <div className="py-12 text-center text-slate-500">Loading results...</div>
                    ) : results.length === 0 ? (
                        <div className="py-12 text-center text-slate-500">No results found for selected filters.</div>
                    ) : (

                        // Summary Cards by Section
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {Array.from(new Set(results.map(r => {
                                const batch = r.student?.batch?.name || r.student?.batchString || "Unknown Batch";
                                const dept = r.student?.department?.code || r.student?.department?.name || "Unknown Dept";
                                const sec = r.student?.section?.name || "Unknown";
                                const yr = r.year || year || "?";
                                const sem = r.semester || semester || "?";
                                return `${batch}|${dept}|${yr}|${sem}|${sec}`;
                            }))).sort().map(groupKey => {
                                const [batchStr, deptStr, yrStr, semStr, sectionName] = groupKey.split('|');
                                const sectionResults = results.filter(r => {
                                    const rBatch = r.student?.batch?.name || r.student?.batchString || "Unknown Batch";
                                    const rDept = r.student?.department?.code || r.student?.department?.name || "Unknown Dept";
                                    const rSec = r.student?.section?.name || "Unknown";
                                    const rYr = r.year || year || "?";
                                    const rSem = r.semester || semester || "?";
                                    return rBatch === batchStr && rDept === deptStr && rYr === yrStr && rSem === semStr && rSec === sectionName;
                                });
                                const avgSGPA = (sectionResults.reduce((acc, r) => acc + (Number(r.sgpa) || 0), 0) / sectionResults.length).toFixed(2);
                                
                                const batchString = batchStr;
                                const deptCode = deptStr;

                                // Get Exam Context from result data (fallback if filters are empty)
                                const resultYear = sectionResults[0]?.year || year || "?";
                                const resultSem = sectionResults[0]?.semester || semester || "?";
                                const formattedYear = resultYear === "1" ? "1st" : resultYear === "2" ? "2nd" : resultYear === "3" ? "3rd" : resultYear + "th";
                                const formattedSem = resultSem === "1" ? "1st" : resultSem === "2" ? "2nd" : resultSem + "th";

                                return (
                                    <div key={groupKey} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all relative">
                                        <div className="absolute top-4 right-4">
                                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">
                                                {deptCode}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-1 mb-4">
                                            <h3 className="text-lg font-bold text-slate-900">
                                                {batchString} • {formattedYear} Year {formattedSem} Sem
                                            </h3>
                                            <div className="text-sm font-medium text-slate-500">
                                                Section {sectionName}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => document.getElementById(`results-table-${groupKey.replace(/[^a-zA-Z0-9]/g, '-')}`)?.classList.toggle("hidden")}
                                            className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                                        >
                                            View / Hide Results
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Collapsible Tables per Section */}
                    {Array.from(new Set(results.map(r => {
                        const batch = r.student?.batch?.name || r.student?.batchString || "Unknown Batch";
                        const dept = r.student?.department?.code || r.student?.department?.name || "Unknown Dept";
                        const sec = r.student?.section?.name || "Unknown";
                        const yr = r.year || year || "?";
                        const sem = r.semester || semester || "?";
                        return `${batch}|${dept}|${yr}|${sem}|${sec}`;
                    }))).sort().map(groupKey => {
                        const [batchStr, deptStr, yrStr, semStr, sectionName] = groupKey.split('|');
                        const sectionResults = results.filter(r => {
                            const rBatch = r.student?.batch?.name || r.student?.batchString || "Unknown Batch";
                            const rDept = r.student?.department?.code || r.student?.department?.name || "Unknown Dept";
                            const rSec = r.student?.section?.name || "Unknown";
                            const rYr = r.year || year || "?";
                            const rSem = r.semester || semester || "?";
                            return rBatch === batchStr && rDept === deptStr && rYr === yrStr && rSem === semStr && rSec === sectionName;
                        });
                        // Extract all unique subject codes for this section to build matrix headers
                        const allSubjects = Array.from(new Set(sectionResults.flatMap(r => ((r.grades || []) as any[]).map(g => g.subjectCode)))).sort();

                        const formattedYear = yrStr === "1" ? "1st" : yrStr === "2" ? "2nd" : yrStr === "3" ? "3rd" : yrStr + "th";
                        const formattedSem = semStr === "1" ? "1st" : semStr === "2" ? "2nd" : semStr + "th";

                        return (
                            <div id={`results-table-${groupKey.replace(/[^a-zA-Z0-9]/g, '-')}`} key={groupKey} className="hidden overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm animate-in fade-in slide-in-from-top-4">
                                <div className="border-b border-slate-200 bg-slate-100 px-6 py-3 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-800">{batchStr} • {deptStr} • {formattedYear} Yr {formattedSem} Sem • Section {sectionName} Matrix Results</h4>
                                    <span className="text-xs text-slate-500 italic">Showing {allSubjects.length} Unique Subjects</span>
                                </div>
                                <div className="overflow-x-auto max-h-[600px]">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-2 border border-slate-300 min-w-[120px] bg-slate-50">Roll No</th>
                                                <th className="p-2 border border-slate-300 min-w-[200px] bg-slate-50">Name</th>
                                                <th className="p-2 border border-slate-300 text-center bg-slate-50">SGPA</th>
                                                <th className="p-2 border border-slate-300 text-center bg-slate-50">CGPA</th>
                                                {allSubjects.map(sub => (
                                                    <th key={sub} className="p-2 border border-slate-300 text-center min-w-[80px] bg-slate-50">{sub}</th>
                                                ))}
                                                <th className="p-2 border border-slate-300 text-center min-w-[120px] bg-slate-50">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {sectionResults.map((res, idx) => (
                                                <tr key={res.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                                                    <td className="p-2 border border-slate-300 font-mono font-medium text-slate-900">
                                                        <StudentHoverCard name={res.student?.name} rollNumber={res.student?.rollNumber} studentId={res.student?.id}>
                                                            {res.student?.rollNumber}
                                                        </StudentHoverCard>
                                                    </td>
                                                    <td className="p-2 border border-slate-300 text-slate-700 truncate max-w-[200px]" title={res.student?.name}>
                                                        <StudentHoverCard name={res.student?.name} rollNumber={res.student?.rollNumber} studentId={res.student?.id}>
                                                            {res.student?.name}
                                                        </StudentHoverCard>
                                                    </td>
                                                    <td className="p-2 border border-slate-300 text-center font-bold text-slate-800">{Number(res.sgpa) ? Number(res.sgpa).toFixed(2) : res.sgpa}</td>
                                                    <td className="p-2 border border-slate-300 text-center text-slate-800">{Number(res.cgpa) ? Number(res.cgpa).toFixed(2) : res.cgpa}</td>
                                                    {allSubjects.map(subCode => {
                                                        const gradeEntry = ((res.grades || []) as any[]).find(g => g.subjectCode === subCode);
                                                        const grade = gradeEntry?.grade || "-";
                                                        const isFail = grade === "F" || grade === "ABSENT";
                                                        return (
                                                            <td key={subCode} className={`p-2 border border-slate-300 text-center font-medium ${isFail ? "bg-red-50 text-red-600" : "text-slate-600"}`}>
                                                                {grade}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="p-2 border border-slate-300 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => handleEditClick(res)}
                                                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteResult(res.id, res.student?.rollNumber || "Unknown")}
                                                                className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Template Modal */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-900">Download Smart Template</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><FaTimes /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    value={templateCtx.departmentId}
                                    onChange={e => setTemplateCtx({ ...templateCtx, departmentId: e.target.value })}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        value={templateCtx.year}
                                        onChange={e => setTemplateCtx({ ...templateCtx, year: e.target.value })}
                                    >
                                        <option value="">Select Year</option>
                                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                                    <select
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        value={templateCtx.semester}
                                        onChange={e => setTemplateCtx({ ...templateCtx, semester: e.target.value })}
                                    >
                                        <option value="">Select Sem</option>
                                        {[1, 2].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Regulation</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    value={templateCtx.regulation}
                                    onChange={e => setTemplateCtx({ ...templateCtx, regulation: e.target.value })}
                                >
                                    <option value="">Select Regulation</option>
                                    {regulations.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Past Results Toggle */}
                        <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                            <label className="flex items-center gap-2 text-sm font-semibold text-amber-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-amber-600 rounded"
                                    checked={isPastResults}
                                    onChange={e => setIsPastResults(e.target.checked)}
                                />
                                Is this for Past Results / Backlogs?
                            </label>
                        </div>

                        {/* Conditionally Show Student Year */}
                        {isPastResults && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Target Student Batch (Current Year)</label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-amber-50/50"
                                    value={templateCtx.studentYear}
                                    onChange={e => setTemplateCtx({ ...templateCtx, studentYear: e.target.value })}
                                >
                                    <option value="">Select Current Student Year</option>
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">E.g., Select '3' if you want 3rd years to take a 2nd year exam.</p>
                            </div>
                        )}

                        {/* Section Multi-Select */}
                        {availableSections.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sections (Select Specific or All)</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            if (templateCtx.sectionIds.length === availableSections.length) {
                                                setTemplateCtx({ ...templateCtx, sectionIds: [] });
                                            } else {
                                                setTemplateCtx({ ...templateCtx, sectionIds: availableSections.map(s => s.id) });
                                            }
                                        }}
                                        className="mr-2 text-xs font-semibold text-blue-600 hover:underline"
                                    >
                                        {templateCtx.sectionIds.length === availableSections.length ? "Deselect All" : "Select All"}
                                    </button>
                                    {availableSections.map(sec => {
                                        const isSelected = templateCtx.sectionIds.includes(sec.id);
                                        return (
                                            <button
                                                key={sec.id}
                                                onClick={() => {
                                                    const newIds = isSelected
                                                        ? templateCtx.sectionIds.filter(id => id !== sec.id)
                                                        : [...templateCtx.sectionIds, sec.id];
                                                    setTemplateCtx({ ...templateCtx, sectionIds: newIds });
                                                }}
                                                className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm border ${isSelected ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                                            >
                                                {isSelected ? <FaCheckSquare className="text-blue-500" /> : <FaSquare className="text-slate-300" />}
                                                {sec.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-2">
                            <button onClick={() => setShowTemplateModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button
                                onClick={generateSmartTemplate}
                                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg hover:bg-blue-700 transition-all hover:scale-105 active:scale-95"
                            >
                                Download Template
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* End Template Modal */}

            {/* Edit Modal */}
            {editModeResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
                        <div className="flex items-center justify-between mb-6 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Edit Result Record</h3>
                                <p className="text-sm text-slate-500">{editModeResult.student?.rollNumber} - {editModeResult.student?.name}</p>
                            </div>
                            <button onClick={() => setEditModeResult(null)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><FaTimes /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">SGPA</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        value={editForm.sgpa}
                                        onChange={e => setEditForm(prev => ({ ...prev, sgpa: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CGPA</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                        value={editForm.cgpa}
                                        onChange={e => setEditForm(prev => ({ ...prev, cgpa: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold text-slate-800 mb-2 border-b pb-1">Subject Grades</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {editForm.grades.map((gradeInfo: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-200 p-2 rounded">
                                            <label className="block text-xs font-bold text-slate-600 mb-1 truncate" title={gradeInfo.subjectCode}>
                                                {gradeInfo.subjectCode}
                                            </label>
                                            <input 
                                                type="text"
                                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-center uppercase font-bold"
                                                value={gradeInfo.grade}
                                                onChange={e => handleGradeChange(gradeInfo.subjectCode, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {editForm.grades.length === 0 && <p className="text-sm text-slate-500">No grades recorded for this student.</p>}
                            </div>
                        </div>

                        <div className="pt-6 mt-6 border-t flex justify-end gap-3">
                            <button onClick={() => setEditModeResult(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button
                                onClick={handleEditSave}
                                disabled={isSaving}
                                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* End Edit Modal */}
        </div >
    );
}
