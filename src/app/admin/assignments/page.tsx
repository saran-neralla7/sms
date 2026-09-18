"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  FaTasks,
  FaCalendarAlt,
  FaBuilding,
  FaSearch,
  FaArrowLeft,
  FaCheckCircle,
  FaClock,
  FaEye
} from "react-icons/fa";
import Link from "next/link";
import LogoSpinner from "@/components/LogoSpinner";

export default function AdminAssignmentsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedAy, setSelectedAy] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [selectedAy, selectedDept]);

  const fetchFilters = async () => {
    try {
      const [ayRes, deptRes] = await Promise.all([
        fetch("/api/academic-years"),
        fetch("/api/departments")
      ]);
      if (ayRes.ok) {
        const ays = await ayRes.json();
        setAcademicYears(ays);
        const current = ays.find((a: any) => a.isCurrent) || ays[0];
        if (current) setSelectedAy(current.id);
      }
      if (deptRes.ok) {
        const depts = await deptRes.json();
        setDepartments(depts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      let url = `/api/assignments?`;
      if (selectedAy) url += `academicYearId=${selectedAy}&`;
      if (selectedDept) url += `departmentId=${selectedDept}&`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAssignments(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.subject?.name?.toLowerCase().includes(q) ||
      a.subject?.code?.toLowerCase().includes(q) ||
      a.department?.code?.toLowerCase().includes(q) ||
      a.section?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl animate-in fade-in duration-300 py-6 px-4">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FaArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <FaTasks className="text-purple-600" /> Institutional Assignments Control
            </h1>
            <p className="text-sm text-slate-500">
              Overview of all course assignments, questions, deadlines, and submissions across departments.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Academic Year
          </label>
          <select
            value={selectedAy}
            onChange={e => setSelectedAy(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Academic Years</option>
            {academicYears.map(ay => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isCurrent ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Department
          </label>
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by subject, title, or section..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 pl-9 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" size={14} />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LogoSpinner fullScreen={false} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          No assignments found matching the selected filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">Assignment Title</th>
                  <th className="px-6 py-4 text-center">Total Marks</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-center">Submissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => {
                  let dueDateFormatted = "No Deadline";
                  let isExpired = false;
                  if (a.dueDate) {
                    const due = new Date(a.dueDate);
                    isExpired = due < new Date();
                    dueDateFormatted = due.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                  }

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{a.subject?.name}</div>
                        <div className="text-xs font-mono text-slate-500">{a.subject?.code}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {a.department?.code} · Yr {a.year} Sem {a.semester} · Sec {a.section?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{a.title}</div>
                        {a.questions && Array.isArray(a.questions) && (
                          <div className="text-xs text-purple-600 font-medium mt-0.5">
                            {a.questions.length} Question(s)
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-900">
                        {a.totalMarks}M
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            isExpired ? "text-red-600" : "text-slate-700"
                          }`}
                        >
                          <FaCalendarAlt size={12} className={isExpired ? "text-red-400" : "text-slate-400"} />
                          {dueDateFormatted}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                          {a._count?.marks || 0} Graded
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
