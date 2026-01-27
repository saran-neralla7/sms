"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaSave, FaSearch, FaUserCheck, FaUserTimes } from "react-icons/fa";
import LogoSpinner from "@/components/LogoSpinner";

// Types
interface Student {
    id: string;
    rollNumber: string;
    name: string;
    mobile: string;
    status?: "Present" | "Absent";
}

interface Meta {
    id: string;
    name: string;
}

export default function AttendancePage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Selections
    const [departments, setDepartments] = useState<Meta[]>([]);
    const [selectedDept, setSelectedDept] = useState("");

    const [sections, setSections] = useState<Meta[]>([]);
    const [selectedSection, setSelectedSection] = useState("");

    const [subjects, setSubjects] = useState<Meta[]>([]);
    const [selectedSubject, setSelectedSubject] = useState("");

    const [periods, setPeriods] = useState<Meta[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState("");

    const [year, setYear] = useState("");
    const [semester, setSemester] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    // Data
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");

    // Initialize
    useEffect(() => {
        if (status === "authenticated") {
            loadInitialData();
        }
    }, [status]);

    const loadInitialData = async () => {
        // Fetch Departments
        const deptRes = await fetch("/api/departments");
        const depts = await deptRes.json();
        setDepartments(depts);

        // Auto-select Dept for Non-Admins
        const role = (session?.user?.role || "").toUpperCase();
        if (!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) {
            const userDept = (session?.user as any).departmentId;
            if (userDept) setSelectedDept(userDept);
        }

        // Fetch Periods
        const periodRes = await fetch("/api/periods");
        const per = await periodRes.json();
        setPeriods(per);
    };

    // Load Sections when Dept changes (or initially)
    useEffect(() => {
        if (selectedDept) {
            fetch(`/api/sections?departmentId=${selectedDept}`)
                .then(res => res.json())
                .then(data => setSections(data))
                .catch(err => console.error(err));
        } else {
            setSections([]);
        }
    }, [selectedDept]);

    // Load Subjects when Year/Sem/Dept changes
    useEffect(() => {
        if (selectedDept && year && semester) {
            fetch(`/api/subjects?departmentId=${selectedDept}&year=${year}&semester=${semester}`)
                .then(res => res.json())
                .then(data => setSubjects(data))
                .catch(err => console.error(err));
        } else {
            setSubjects([]);
        }
    }, [selectedDept, year, semester]);

    // Fetch Students
    const handleFetchStudents = async () => {
        // Validate All Fields First
        if (!selectedDept || !year || !semester || !selectedSection || !selectedPeriod || !date) {
            setMessage("Please fill all required fields (Year, Semester, Section, Date, Period).");
            return;
        }

        const role = (session?.user?.role || "").toUpperCase();
        const isAcademic = ["ADMIN", "DIRECTOR", "PRINCIPAL", "FACULTY", "HOD"].includes(role);

        if (isAcademic && !selectedSubject) {
            setMessage("Subject is required for Academic Attendance.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            // Check if already marked?
            const checkUrl = `/api/attendance/check?date=${date}&sectionId=${selectedSection}&periodId=${selectedPeriod}&subjectId=${selectedSubject}`;
            const checkRes = await fetch(checkUrl);
            const checkData = await checkRes.json();

            if (checkData.exists) {
                if (!confirm(`Attendance already marked for this period by ${checkData.markedBy}. Overwrite?`)) {
                    setLoading(false);
                    return;
                }
            }

            // Fetch Students
            const res = await fetch(`/api/students?departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                // Initialize status as Present
                setStudents(data.map((s: any) => ({ ...s, status: "Present" })));
                if (data.length === 0) setMessage("No students found in this section.");
            } else {
                setStudents([]);
                setMessage("Failed to load students.");
            }
        } catch (error) {
            console.error(error);
            setMessage("Error fetching data.");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = (index: number) => {
        const newStudents = [...students];
        newStudents[index].status = newStudents[index].status === "Present" ? "Absent" : "Present";
        setStudents(newStudents);
    };

    const markAll = (status: "Present" | "Absent") => {
        const newStudents = students.map(s => ({ ...s, status }));
        setStudents(newStudents);
    };

    const handleSubmit = async () => {
        if (students.length === 0) return;

        setSubmitting(true);
        try {
            const payload = {
                date,
                year,
                semester,
                sectionId: selectedSection,
                departmentId: selectedDept,
                subjectId: selectedSubject || null,
                periodId: selectedPeriod,
                students: students.map(s => ({
                    rollNumber: s.rollNumber,
                    name: s.name,
                    mobile: s.mobile,
                    status: s.status
                }))
            };

            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Attendance Submitted Successfully!");
                router.push("/attendance/history");
            } else {
                const err = await res.json();
                setMessage(err.error || "Submission failed");
            }
        } catch (error) {
            console.error(error);
            setMessage("Error submitting attendance");
        } finally {
            setSubmitting(false);
        }
    };

    if (status === "loading") return <LogoSpinner />;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <h1 className="mb-6 text-2xl font-bold text-slate-800">Mark Attendance</h1>

            <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                {/* Row 1: Academic Details */}
                <div className="grid gap-4 md:grid-cols-4">
                    {/* Department */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Department</label>
                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            disabled={!["ADMIN", "DIRECTOR", "PRINCIPAL"].includes((session?.user?.role || "").toUpperCase())}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Dept</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>

                    {/* Year */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Year</label>
                        <select
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Year</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                    </div>

                    {/* Semester */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Semester</label>
                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Sem</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                        </select>
                    </div>

                    {/* Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Section</label>
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Section</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Row 2: Schedule Details */}
                <div className="grid gap-4 md:grid-cols-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Period</label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Period</option>
                            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">
                            Subject {["ADMIN", "DIRECTOR", "PRINCIPAL", "FACULTY", "HOD"].includes((session?.user?.role || "").toUpperCase()) ? <span className="text-red-500">*</span> : "(Optional)"}
                        </label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-sm"
                        >
                            <option value="">Select Subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Load Button */}
                <div className="flex flex-col items-center justify-center gap-2">
                    <button
                        onClick={handleFetchStudents}
                        disabled={loading}
                        className="flex min-w-[200px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg disabled:bg-slate-300"
                    >
                        {loading ? <LogoSpinner fullScreen={false} /> : <><FaSearch /> Load Student List</>}
                    </button>
                    {message && <span className={`text-sm font-medium ${message.includes("Success") ? "text-green-600" : "text-red-600"}`}>{message}</span>}
                </div>
            </div>

            {/* Attendance Form */}
            {students.length > 0 && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">

                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800">Student List</h2>
                        <div className="flex gap-2">
                            <button onClick={() => markAll("Present")} className="text-xs font-semibold text-green-700 hover:text-green-800 hover:underline">Mark All Present</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => markAll("Absent")} className="text-xs font-semibold text-red-700 hover:text-red-800 hover:underline">Mark All Absent</button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                                <tr>
                                    <th className="px-6 py-4">Roll No</th>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm md:text-base">
                                {students.map((student, idx) => (
                                    <tr key={student.id} onClick={() => toggleStatus(idx)} className="cursor-pointer hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-700">{student.rollNumber}</td>
                                        <td className="px-6 py-3 text-slate-600">{student.name}</td>
                                        <td className="px-6 py-3 text-center">
                                            {student.status === "Present" ? (
                                                <button className="inline-flex items-center gap-1 rounded-full bg-green-100 px-4 py-1.5 text-xs font-bold text-green-700 transition-all hover:bg-green-200">
                                                    <FaCheckCircle /> Present
                                                </button>
                                            ) : (
                                                <button className="inline-flex items-center gap-1 rounded-full bg-red-100 px-4 py-1.5 text-xs font-bold text-red-700 transition-all hover:bg-red-200">
                                                    <FaTimesCircle /> Absent
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-bold text-white shadow-lg hover:bg-green-700 disabled:bg-slate-400"
                        >
                            {submitting ? "Submitting..." : <><FaSave /> Submit Attendance</>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
