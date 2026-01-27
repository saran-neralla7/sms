"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaSave, FaSearch } from "react-icons/fa";
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
        if (!selectedDept || !year || !semester || !selectedSection) {
            setMessage("Please select all required fields.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/students?departmentId=${selectedDept}&year=${year}&semester=${semester}&sectionId=${selectedSection}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                // Initialize status as Present
                setStudents(data.map((s: any) => ({ ...s, status: "Present" })));
                setMessage("");
            } else {
                setStudents([]);
                setMessage("No students found.");
            }
        } catch (error) {
            console.error(error);
            setMessage("Failed to fetch students.");
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = (index: number) => {
        const newStudents = [...students];
        newStudents[index].status = newStudents[index].status === "Present" ? "Absent" : "Present";
        setStudents(newStudents);
    };

    const handleSubmit = async () => {
        if (!selectedPeriod || !date) {
            setMessage("Please select Period and Date.");
            return;
        }

        // Check for duplicate/existing? We can do a quick check API call here if needed, 
        // but for now let's rely on server or just submit.
        // User might want to overwrite? Or block?
        // Let's check first.
        try {
            const checkUrl = `/api/attendance/check?date=${date}&sectionId=${selectedSection}&periodId=${selectedPeriod}&subjectId=${selectedSubject}`;
            const checkRes = await fetch(checkUrl);
            const checkData = await checkRes.json();

            if (checkData.exists) {
                if (!confirm(`Attendance already marked for this period by ${checkData.markedBy}. Overwrite?`)) {
                    return;
                }
            }
        } catch (e) { console.error("Check failed"); }


        setSubmitting(true);
        try {
            const payload = {
                date,
                year,
                semester,
                sectionId: selectedSection,
                departmentId: selectedDept,
                subjectId: selectedSubject || null, // Optional for pure manual entry
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">

                {/* Department - Disabled if not Admin */}
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

                {/* Load Button */}
                <div className="col-span-full">
                    <button
                        onClick={handleFetchStudents}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                    >
                        {loading ? "Loading..." : <><FaSearch /> Fetch Students</>}
                    </button>
                    {message && <span className="ml-4 text-sm text-red-600 font-medium">{message}</span>}
                </div>
            </div>

            {/* Attendance Form */}
            {students.length > 0 && (
                <div className="mt-8">
                    <div className="mb-4 grid gap-4 md:grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Period</label>
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 p-2"
                            >
                                <option value="">Select Period</option>
                                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Subject (Optional)</label>
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-slate-300 p-2"
                            >
                                <option value="">Select Subject</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
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
                                    <tr key={student.id} onClick={() => toggleStatus(idx)} className="cursor-pointer hover:bg-slate-50">
                                        <td className="px-6 py-3 font-medium text-slate-700">{student.rollNumber}</td>
                                        <td className="px-6 py-3 text-slate-600">{student.name}</td>
                                        <td className="px-6 py-3 text-center">
                                            {student.status === "Present" ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                                    <FaCheckCircle /> Present
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                                    <FaTimesCircle /> Absent
                                                </span>
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
